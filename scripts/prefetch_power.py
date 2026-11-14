#!/usr/bin/env python3
"""
Offline prefetch of NASA POWER daily data for the four presets -> public/data/presets/<id>.json

Run:  python -I scripts/prefetch_power.py            (all presets)
      python -I scripts/prefetch_power.py gissar     (one preset)

Standard library only (no third-party packages). Security (OWASP A08/A10):
  * outbound requests only to https://power.larc.nasa.gov (host allowlist, no redirects followed)
  * coordinates come from the fixed PRESETS table below, never from user input
  * response size capped; every value validated (type, physical range, consecutive dates)
The browser validates these files again on load (src/data/power.ts validateSeries).
"""
from __future__ import annotations

import json
import math
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

POWER_HOST = "power.larc.nasa.gov"
PARAMS = ["T2M_MAX", "T2M_MIN", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN", "WS2M", "RH2M"]
FIELD = {"T2M_MAX": "tmax", "T2M_MIN": "tmin", "PRECTOTCORR": "prcp", "ALLSKY_SFC_SW_DWN": "rs", "WS2M": "u2", "RH2M": "rh"}
BOUNDS = {"tmax": (-70, 60), "tmin": (-90, 50), "prcp": (0, 500), "rs": (0, 45), "u2": (0, 50), "rh": (0, 100)}
START_YEAR, END_YEAR = 2001, 2024  # full calendar years only
TIMEOUT_S = 60  # offline batch job; the live browser path uses 10 s
MAX_BYTES = 3_000_000
FILL = -999.0
MAX_MISSING_SHARE = 0.02

# Must match src/data/presets.ts (CLAUDE.md section 4)
PRESETS = {
    "gissar": (38.5598, 68.7870),
    "khatlon": (37.8333, 68.7800),
    "balkh": (36.7581, 66.8972),
    "kansas": (38.8000, -99.3000),
}

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "data" / "presets"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # noqa: D401 - block all redirects (SSRF hardening)
        raise RuntimeError("redirect blocked")


def build_url(lat: float, lon: float) -> str:
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("invalid coordinates")
    q = urllib.parse.urlencode({
        "parameters": ",".join(PARAMS), "community": "AG",
        "longitude": f"{lon:.4f}", "latitude": f"{lat:.4f}",
        "start": f"{START_YEAR}0101", "end": f"{END_YEAR}1231", "format": "CSV",
    })
    url = f"https://{POWER_HOST}/api/temporal/daily/point?{q}"
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != POWER_HOST:
        raise ValueError("blocked host")
    return url


def fetch(url: str) -> str:
    opener = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(url, headers={"User-Agent": "fihrist-prefetch/0.1"})
    with opener.open(req, timeout=TIMEOUT_S) as r:
        body = r.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("response too large")
    return body.decode("utf-8")


def parse_csv(text: str, lat: float, lon: float) -> dict:
    if not text.startswith("-BEGIN HEADER-") or "-END HEADER-" not in text:
        raise ValueError("not a POWER CSV response")
    header, body = text.split("-END HEADER-", 1)
    elevation = math.nan
    for line in header.splitlines():
        if "meters" in line and "=" in line:
            elevation = float(line.split("=")[1].split("meters")[0])
    lines = body.strip().splitlines()
    if lines[0].split(",") != ["YEAR", "DOY", *PARAMS]:
        raise ValueError("unexpected CSV columns")
    cols = {f: [] for f in FIELD.values()}
    prev = None
    start = None
    for line in lines[1:]:
        parts = line.split(",")
        if len(parts) != len(PARAMS) + 2:
            raise ValueError("malformed row")
        y, doy = int(parts[0]), int(parts[1])
        d = date(y, 1, 1) + timedelta(days=doy - 1)
        if prev is None:
            start = d
        elif d != prev + timedelta(days=1):
            raise ValueError(f"dates not consecutive at {d}")
        prev = d
        for p, raw in zip(PARAMS, parts[2:]):
            v = float(raw)
            if not math.isfinite(v):
                raise ValueError("non-finite value")
            cols[FIELD[p]].append(v)
    n = len(cols["tmax"])
    for f, (lo, hi) in BOUNDS.items():
        missing = 0
        for i, v in enumerate(cols[f]):
            if v == FILL:
                cols[f][i] = None  # JSON null; browser interpolates rare gaps
                missing += 1
            elif not (lo <= v <= hi):
                raise ValueError(f"{f} out of range: {v}")
        if missing / n > MAX_MISSING_SHARE:
            raise ValueError(f"too many missing values in {f}")
    if not (-500 <= elevation <= 9000):
        raise ValueError("invalid elevation")
    return {"lat": lat, "lon": lon, "elevation": elevation, "start": start.isoformat(), **cols}


def main(ids: list[str]) -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    failures = 0
    for pid in ids or list(PRESETS):
        if pid not in PRESETS:
            print(f"unknown preset: {pid}", file=sys.stderr)
            failures += 1
            continue
        lat, lon = PRESETS[pid]
        try:
            series = parse_csv(fetch(build_url(lat, lon)), lat, lon)
        except Exception as e:  # report and continue with the other presets
            print(f"[FAIL] {pid}: {e}", file=sys.stderr)
            failures += 1
            continue
        doc = {
            "format": "fihrist-daily-v1",
            "id": pid,
            "source": "NASA POWER daily point API v2, community=AG (MERRA-2 meteorology, CERES SYN1deg radiation)",
            "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "series": series,
        }
        path = OUT_DIR / f"{pid}.json"
        path.write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8")
        print(f"[OK]   {pid}: {len(series['tmax'])} days from {series['start']}, elevation {series['elevation']} m -> {path.name} ({path.stat().st_size // 1024} kB)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

/**
 * NASA POWER daily point client (community=AG), CSV format.
 * https://power.larc.nasa.gov/docs/services/api/temporal/daily/
 *
 * Security (OWASP A03/A04/A08/A10):
 *  - fixed host allowlist + fixed parameter list; coordinates strictly validated before use
 *  - 10 s timeout via AbortController; response size capped
 *  - every row/column validated (type, physical range, date continuity); fill values (-999)
 *    interpolated only if rare, otherwise the payload is rejected
 */
import type { DailySeries } from '../engine/climate.ts';
import { dateAt } from '../engine/climate.ts';
import { isValidLatLon } from '../lib/geo.ts';

export const POWER_HOST = 'power.larc.nasa.gov';
export const POWER_PARAMS = ['T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'WS2M', 'RH2M'] as const;
/** Full calendar years only (2025 is incomplete at build time). */
export const POWER_START_YEAR = 2001;
export const POWER_END_YEAR = 2024;
export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_RESPONSE_BYTES = 3_000_000; // expected ~370 kB for 24 years
const FILL = -999;
/** Reject a column if more than this share of days is missing. */
export const MAX_MISSING_SHARE = 0.02;

/** Physical plausibility bounds per field (inclusive). */
export const BOUNDS: Record<keyof Omit<DailySeries, 'lat' | 'lon' | 'elevation' | 'start'>, [number, number]> = {
  tmax: [-70, 60],
  tmin: [-90, 50],
  prcp: [0, 500],
  rs: [0, 45],
  u2: [0, 50],
  rh: [0, 100],
};
const FIELD_OF: Record<(typeof POWER_PARAMS)[number], keyof typeof BOUNDS> = {
  T2M_MAX: 'tmax', T2M_MIN: 'tmin', PRECTOTCORR: 'prcp', ALLSKY_SFC_SW_DWN: 'rs', WS2M: 'u2', RH2M: 'rh',
};

export class PowerDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PowerDataError';
  }
}

/** Builds the request URL. Only validated numbers reach the query string; host is fixed. */
export function buildPowerUrl(lat: number, lon: number, startYear = POWER_START_YEAR, endYear = POWER_END_YEAR): URL {
  if (!isValidLatLon(lat, lon)) throw new PowerDataError('invalid coordinates');
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear < 1981 || endYear < startYear || endYear > 2100) {
    throw new PowerDataError('invalid year range');
  }
  const u = new URL(`https://${POWER_HOST}/api/temporal/daily/point`);
  u.searchParams.set('parameters', POWER_PARAMS.join(','));
  u.searchParams.set('community', 'AG');
  u.searchParams.set('longitude', lon.toFixed(4));
  u.searchParams.set('latitude', lat.toFixed(4));
  u.searchParams.set('start', `${startYear}0101`);
  u.searchParams.set('end', `${endYear}1231`);
  u.searchParams.set('format', 'CSV');
  return u;
}

/** Linear interpolation over NaN gaps; returns the number of filled values. */
function fillGaps(a: number[]): number {
  let filled = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isNaN(a[i])) continue;
    let j = i;
    while (j < a.length && Number.isNaN(a[j])) j++;
    const left = i > 0 ? a[i - 1] : a[j];
    const right = j < a.length ? a[j] : left;
    if (Number.isNaN(left) || Number.isNaN(right)) throw new PowerDataError('column has no valid values');
    for (let k = i; k < j; k++) {
      a[k] = left + ((right - left) * (k - i + 1)) / (j - i + 1);
      filled++;
    }
    i = j;
  }
  return filled;
}

/**
 * Validates a series in place (bounds, lengths, Tmin ≤ Tmax, fills rare gaps). Used for live CSV
 * and for preset JSON files, so a tampered/poisoned preset is rejected the same way.
 */
export function validateSeries(s: DailySeries): { filled: number } {
  if (!isValidLatLon(s.lat, s.lon)) throw new PowerDataError('invalid coordinates in series');
  if (typeof s.elevation !== 'number' || !Number.isFinite(s.elevation) || s.elevation < -500 || s.elevation > 9000) {
    throw new PowerDataError('invalid elevation');
  }
  if (typeof s.start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.start)) throw new PowerDataError('invalid start date');
  const n = s.tmax?.length;
  if (!Number.isInteger(n) || n < 365 || n > 366 * 60) throw new PowerDataError('invalid series length');
  let filled = 0;
  for (const f of Object.keys(BOUNDS) as (keyof typeof BOUNDS)[]) {
    const col = s[f];
    if (!Array.isArray(col) || col.length !== n) throw new PowerDataError(`column ${f} has wrong length`);
    const [lo, hi] = BOUNDS[f];
    let missing = 0;
    for (let i = 0; i < n; i++) {
      const v = col[i] as unknown;
      if (v === null || v === FILL) { col[i] = NaN; missing++; continue; }
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new PowerDataError(`non-numeric value in ${f}`);
      if (v < lo || v > hi) throw new PowerDataError(`value out of physical range in ${f}: ${v}`);
    }
    if (missing / n > MAX_MISSING_SHARE) throw new PowerDataError(`too many missing values in ${f} (${missing}/${n})`);
    filled += fillGaps(col);
  }
  for (let i = 0; i < n; i++) {
    if (s.tmin[i] > s.tmax[i] + 0.5) throw new PowerDataError(`Tmin > Tmax on day ${i}`);
  }
  return { filled };
}

/** Parses a POWER daily CSV response into a validated DailySeries. */
export function parsePowerCsv(text: string, req: { lat: number; lon: number }): DailySeries {
  if (typeof text !== 'string' || text.length === 0) throw new PowerDataError('empty response');
  if (text.length > MAX_RESPONSE_BYTES) throw new PowerDataError('response too large');
  const endHeader = text.indexOf('-END HEADER-');
  if (!text.startsWith('-BEGIN HEADER-') || endHeader < 0) throw new PowerDataError('not a POWER CSV response');
  const header = text.slice(0, endHeader);
  const elevMatch = header.match(/=\s*(-?\d+(?:\.\d+)?)\s*meters/);
  const elevation = elevMatch ? Number(elevMatch[1]) : NaN;
  const lines = text.slice(endHeader + '-END HEADER-'.length).trim().split(/\r?\n/);
  const cols = lines[0].split(',').map((c) => c.trim());
  const expected = ['YEAR', 'DOY', ...POWER_PARAMS];
  if (cols.length !== expected.length || cols.some((c, i) => c !== expected[i])) throw new PowerDataError('unexpected CSV columns');

  const rows = lines.slice(1);
  const out: DailySeries = { lat: req.lat, lon: req.lon, elevation, start: '', tmax: [], tmin: [], prcp: [], rs: [], u2: [], rh: [] };
  let prev: { y: number; doy: number } | null = null;
  for (const line of rows) {
    const parts = line.split(',');
    if (parts.length !== expected.length) throw new PowerDataError('malformed CSV row');
    const nums = parts.map((p) => (/^-?\d+(\.\d+)?$/.test(p.trim()) ? Number(p) : NaN));
    if (nums.some((v) => Number.isNaN(v))) throw new PowerDataError('non-numeric CSV value');
    const [y, doy] = nums;
    if (prev) {
      // consecutive days only (no gaps, duplicates or reordering)
      const expectNext = dateAt(`${prev.y}-01-01`, prev.doy); // day after prev
      if (y !== expectNext.y || doy !== expectNext.doy) throw new PowerDataError('dates not consecutive');
    } else {
      const d = dateAt(`${y}-01-01`, doy - 1);
      out.start = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
    prev = { y, doy };
    POWER_PARAMS.forEach((p, k) => out[FIELD_OF[p]].push(nums[k + 2]));
  }
  validateSeries(out);
  return out;
}

/** Fetches daily POWER data for a point with a hard timeout. */
export async function fetchPowerDaily(lat: number, lon: number, signal?: AbortSignal): Promise<DailySeries> {
  const url = buildPowerUrl(lat, lon);
  if (url.hostname !== POWER_HOST || url.protocol !== 'https:') throw new PowerDataError('blocked host');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new PowerDataError(`NASA POWER responded ${res.status}`);
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_RESPONSE_BYTES) throw new PowerDataError('response too large');
    const text = await res.text();
    return parsePowerCsv(text, { lat, lon });
  } catch (e) {
    if (e instanceof PowerDataError) throw e;
    if ((e as Error).name === 'AbortError') throw new PowerDataError('NASA POWER timed out');
    throw new PowerDataError('NASA POWER unreachable');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

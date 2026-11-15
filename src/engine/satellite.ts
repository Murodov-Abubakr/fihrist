/**
 * Satellite layers for the presets (prefetched by scripts/prefetch-satellite.mjs) and the cross-dataset
 * signals they enable (CLAUDE.md §5 eq. 11 — Fihrist Compound Stress Index, full 4 signals).
 *
 *  - Vegetation: MODIS Terra MOD13Q1 v061 NDVI (250 m, 16-day), mean over ESA WorldCover 10 m cropland
 *    within 5 km of the preset point (a pixel counts as farmland when ≥ 50 % of it is cropland).
 *  - Soil moisture: NASA POWER monthly GWETROOT (root-zone soil wetness, 0–1, MERRA-2).
 *  - Terrain: NASADEM slope (Horn 1981) over ~400 m.
 *
 * All untrusted file content passes validateSat (exact shape, finite in-range numbers, size caps).
 */
export interface SatComposite { date: string; ndvi: number | null; pixels: number }
export interface SatWetness { y: number; m: number; root: number | null; top: number | null }
export interface SatSlope { item: string; elevationM: number; meanSlopeDeg: number; maxSlopeDeg: number; windowM: number }
export interface SatFile {
  format: 'fihrist-sat-v1';
  id: string; lat: number; lon: number; createdAt: string;
  layers: { ndvi?: { composites: SatComposite[]; landCoverItem: string; croplandShare: number; radiusKm: number; tile?: string }; wetness?: SatWetness[]; slope?: SatSlope };
  gaps: { layer: string; reason: string }[];
}

export class SatError extends Error {}
const num = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const str = (v: unknown, max = 120): v is string => typeof v === 'string' && v.length <= max && !/[\u0000-\u001f<>]/.test(v);

/** Strict validation of a prefetched satellite file (OWASP A08: data integrity). */
export function validateSat(x: unknown, expectId?: string): SatFile {
  const o = x as Partial<SatFile> | null;
  if (!o || typeof o !== 'object' || o.format !== 'fihrist-sat-v1') throw new SatError('format');
  if (!str(o.id, 20) || (expectId && o.id !== expectId)) throw new SatError('id');
  if (!num(o.lat, -90, 90) || !num(o.lon, -180, 180) || !str(o.createdAt, 10)) throw new SatError('header');
  const L = (o.layers ?? {}) as SatFile['layers'];
  const out: SatFile = { format: 'fihrist-sat-v1', id: o.id, lat: o.lat, lon: o.lon, createdAt: o.createdAt, layers: {}, gaps: [] };
  if (L.ndvi) {
    const c = L.ndvi.composites;
    if (!Array.isArray(c) || c.length > 3000) throw new SatError('ndvi');
    out.layers.ndvi = {
      composites: c.map((p) => {
        if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(String(p.date))) throw new SatError('ndvi date');
        if (p.ndvi !== null && !num(p.ndvi, -0.2, 1)) throw new SatError('ndvi value');
        if (!num(p.pixels, 0, 100000)) throw new SatError('ndvi pixels');
        return { date: p.date, ndvi: p.ndvi, pixels: p.pixels };
      }),
      landCoverItem: str(L.ndvi.landCoverItem) ? L.ndvi.landCoverItem : '',
      croplandShare: num(L.ndvi.croplandShare, 0, 1) ? L.ndvi.croplandShare : 0,
      radiusKm: num(L.ndvi.radiusKm, 0, 50) ? L.ndvi.radiusKm : 0,
    };
  }
  if (L.wetness) {
    if (!Array.isArray(L.wetness) || L.wetness.length > 1000) throw new SatError('wetness');
    out.layers.wetness = L.wetness.map((w) => {
      if (!num(w?.y, 1980, 2100) || !num(w.m, 1, 12) || !Number.isInteger(w.y) || !Number.isInteger(w.m)) throw new SatError('wetness date');
      if ((w.root !== null && !num(w.root, 0, 1)) || (w.top !== null && !num(w.top, 0, 1))) throw new SatError('wetness value');
      return { y: w.y, m: w.m, root: w.root, top: w.top };
    });
  }
  if (L.slope) {
    const s = L.slope;
    if (!str(s.item) || !num(s.elevationM, -500, 9000) || !num(s.meanSlopeDeg, 0, 90) || !num(s.maxSlopeDeg, 0, 90) || !num(s.windowM, 0, 10000)) throw new SatError('slope');
    out.layers.slope = { item: s.item, elevationM: s.elevationM, meanSlopeDeg: s.meanSlopeDeg, maxSlopeDeg: s.maxSlopeDeg, windowM: s.windowM };
  }
  if (Array.isArray(o.gaps)) out.gaps = o.gaps.slice(0, 10).filter((g) => str(g?.layer, 20) && str(g?.reason, 200)).map((g) => ({ layer: g.layer, reason: g.reason }));
  return out;
}

/** Monthly mean NDVI ("y-m" → value) from 16-day composites, by composite start date. */
export function monthlyNdvi(c: SatComposite[]): Map<string, number> {
  const acc = new Map<string, { s: number; n: number }>();
  for (const p of c) {
    if (p.ndvi === null || p.pixels < 1) continue;
    const k = `${+p.date.slice(0, 4)}-${+p.date.slice(5, 7)}`;
    const a = acc.get(k) ?? { s: 0, n: 0 };
    a.s += p.ndvi; a.n++;
    acc.set(k, a);
  }
  return new Map([...acc].map(([k, a]) => [k, a.s / a.n]));
}

export function monthlyWetness(w: SatWetness[]): Map<string, number> {
  return new Map(w.filter((x) => x.root !== null).map((x) => [`${x.y}-${x.m}`, x.root as number]));
}

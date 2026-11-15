/**
 * Crop pattern from the greenness curve (MODIS NDVI over cropland, monthly means), per calendar year.
 *
 * For each year: winter base = minimum of Dec (previous year), Jan, Feb; spring peak = max Mar–May;
 * summer peak = max Jul–Sep; dip = June. A peak counts when it rises ≥ PEAK_MIN above the winter base.
 *   winterCereal : spring peak counts, summer does not (or is ≥ DIP below the spring peak)   e.g. winter wheat
 *   summerCrop   : summer peak counts, spring does not (or is ≥ DIP below the summer peak)   e.g. cotton, maize
 *   double       : both peaks count and June dips ≥ DIP below both                           wheat then a summer crop
 *   unclear      : anything else (flat, mixed, or missing months)
 * Thresholds are project choices (SOURCES.md). The NDVI is a 5 km cropland AVERAGE, so the result is the
 * dominant pattern of the area's farmland, not the pattern of one field: an information gap shown in the UI.
 */
export const PEAK_MIN = 0.1;
export const DIP = 0.05;

export type CropPattern = 'winterCereal' | 'summerCrop' | 'double' | 'unclear';
export interface YearPattern { year: number; pattern: CropPattern; base: number | null; spring: number | null; summer: number | null; june: number | null }

const maxOf = (xs: (number | undefined)[]) => { const v = xs.filter((x): x is number => x !== undefined); return v.length ? Math.max(...v) : null; };
const minOf = (xs: (number | undefined)[]) => { const v = xs.filter((x): x is number => x !== undefined); return v.length ? Math.min(...v) : null; };

export function yearPattern(ndvi: Map<string, number>, year: number): YearPattern {
  const g = (y: number, m: number) => ndvi.get(`${y}-${m}`);
  const base = minOf([g(year - 1, 12), g(year, 1), g(year, 2)]);
  const spring = maxOf([g(year, 3), g(year, 4), g(year, 5)]);
  const summer = maxOf([g(year, 7), g(year, 8), g(year, 9)]);
  const june = g(year, 6) ?? null;
  const out = { year, base, spring, summer, june };
  if (base === null || spring === null || summer === null) return { ...out, pattern: 'unclear' };
  const sp = spring - base >= PEAK_MIN, su = summer - base >= PEAK_MIN;
  if (sp && su && june !== null && june <= spring - DIP && june <= summer - DIP) return { ...out, pattern: 'double' };
  if (sp && (!su || summer <= spring - DIP)) return { ...out, pattern: 'winterCereal' };
  if (su && (!sp || spring <= summer - DIP)) return { ...out, pattern: 'summerCrop' };
  return { ...out, pattern: 'unclear' };
}

/** Patterns for every year with data, and the most frequent clear pattern (null if none). */
export function cropPatterns(ndvi: Map<string, number>): { years: YearPattern[]; dominant: CropPattern | null; share: number } {
  const ys = [...new Set([...ndvi.keys()].map((k) => +k.split('-')[0]))].sort((a, b) => a - b);
  const years = ys.map((y) => yearPattern(ndvi, y)).filter((p) => p.base !== null || p.spring !== null || p.summer !== null);
  const counts = new Map<CropPattern, number>();
  for (const p of years) if (p.pattern !== 'unclear') counts.set(p.pattern, (counts.get(p.pattern) ?? 0) + 1);
  let dominant: CropPattern | null = null, n = 0;
  counts.forEach((c, k) => { if (c > n) { n = c; dominant = k; } });
  return { years, dominant, share: years.length ? n / years.length : 0 };
}

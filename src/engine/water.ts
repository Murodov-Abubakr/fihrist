/**
 * Effective rainfall, growing degree-days and frost.
 */

/**
 * Effective rainfall, USDA Soil Conservation Service method on MONTHLY totals (mm), as implemented in
 * FAO CROPWAT 8.0 (Smith 1992, FAO Irrigation and Drainage Paper 46; CROPWAT 8.0 help, "Effective
 * rainfall — USDA S.C. method"):
 *   Peff = P · (125 − 0.2 P) / 125      for P ≤ 250 mm
 *   Peff = 125 + 0.1 P                  for P > 250 mm
 */
export function effectiveRainUSDA(pMonthMm: number): number {
  if (!(pMonthMm > 0)) return 0;
  return pMonthMm <= 250 ? (pMonthMm * (125 - 0.2 * pMonthMm)) / 125 : 125 + 0.1 * pMonthMm;
}

/** Monthly water deficit, m³ ha⁻¹: 10 · max(0, ETc − Peff) (1 mm over 1 ha = 10 m³). */
export function waterDeficitM3(etcMm: number, peffMm: number): number {
  return 10 * Math.max(0, etcMm - peffMm);
}

/** Daily growing degree-days, simple averaging method: max(0, (Tmax + Tmin)/2 − Tbase). */
export function gdd(tmax: number, tmin: number, tbase: number): number {
  return Math.max(0, (tmax + tmin) / 2 - tbase);
}

/** Frost day: daily minimum air temperature at 2 m ≤ 0 °C. */
export const isFrostDay = (tmin: number) => tmin <= 0;

/**
 * Crop coefficient curve and climate adjustment.
 * FAO-56 Chapter 6: Kc curve construction (Fig. 25, Eq. 66) and Kc mid / Kc end adjustment for
 * climates other than RHmin = 45 %, u2 = 2 m s⁻¹ (Eqs. 62 and 65).
 */
import type { CropParams } from './crops.ts';

/** Total season length in days. */
export const seasonLength = (c: CropParams) => c.stages.reduce((a, b) => a + b, 0);

/**
 * FAO-56 Eq. 62 / 65: adjust a tabulated Kc (mid or end, if ≥ 0.45) for local wind and humidity.
 * Kc = Kc_tab + [0.04 (u2 − 2) − 0.004 (RHmin − 45)] (h / 3)^0.3
 * Valid ranges (FAO-56): 1 ≤ u2 ≤ 6 m s⁻¹, 20 ≤ RHmin ≤ 80 %, 0.1 ≤ h ≤ 10 m — inputs are clamped.
 */
export function adjustKc(kcTab: number, u2: number, rhMin: number, heightM: number): number {
  const u = Math.min(6, Math.max(1, u2));
  const rh = Math.min(80, Math.max(20, rhMin));
  const h = Math.min(10, Math.max(0.1, heightM));
  return kcTab + (0.04 * (u - 2) - 0.004 * (rh - 45)) * (h / 3) ** 0.3;
}

export interface KcClimate {
  /** mean u2 and RHmin over the mid-season stage (for Kc mid) */
  mid?: { u2: number; rhMin: number };
  /** mean u2 and RHmin over the late-season stage (for Kc end) */
  end?: { u2: number; rhMin: number };
}

/**
 * Kc on a given day after planting (0-based) following the FAO-56 piecewise-linear curve.
 * Returns 0 outside the season (bare soil / fallow handled elsewhere).
 */
export function kcOnDay(crop: CropParams, day: number, climate: KcClimate = {}): number {
  const [li, ld, lm, ll] = crop.stages;
  const kcMid = climate.mid ? adjustKc(crop.kcMid, climate.mid.u2, climate.mid.rhMin, crop.heightM) : crop.kcMid;
  const kcEnd = climate.end && crop.kcEnd >= 0.45 ? adjustKc(crop.kcEnd, climate.end.u2, climate.end.rhMin, crop.heightM) : crop.kcEnd;
  if (day < 0) return 0;
  if (day < li) return crop.kcIni;
  if (day < li + ld) return crop.kcIni + ((day - li) / ld) * (kcMid - crop.kcIni); // Eq. 66
  if (day < li + ld + lm) return kcMid;
  if (day < li + ld + lm + ll) return kcMid + ((day - li - ld - lm) / ll) * (kcEnd - kcMid); // Eq. 66
  return 0;
}

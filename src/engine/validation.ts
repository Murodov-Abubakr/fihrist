/**
 * Kansas validation (CLAUDE.md §2 item 4, §10: "validated in Kansas where ground truth exists").
 *
 * Observed: USDA NASS Kansas winter wheat yield, STATEWIDE, 2015–2024 (bu/ac), as republished by
 * Kansas Wheat ("Kansas Wheat History", source: USDA National Agricultural Statistics Service),
 * https://kswheat.com/growers/average-kansas-wheat-production (read 2026-11-15).
 * Caveats (shown in the UI):
 *  - statewide, all practices (includes a small irrigated share); the model point is one ~50 km NASA
 *    POWER cell near Hays (Ellis County), in the drier west-central part of the state;
 *  - Ellis County values need the NASS Quick Stats API (key) — not yet retrieved;
 *  - the page's column says "Yield (bushels)" without naming winter wheat; Kansas wheat is
 *    overwhelmingly winter wheat.
 * Model: rainfed continuous winter wheat at the Kansas preset with the soil-water model, Ym = 3.30 t/ha
 * (irrigated Kansas average, CSSA — independent of these NASS numbers, so this is a real out-of-sample check).
 */
import type { DailyDerived, DailySeries } from './climate.ts';
import { rotationDefs, simulateRotation } from './rotation.ts';
import type { Soil } from './soilwater.ts';

export const BU_AC_TO_T_HA = 27.2155 / 0.404686 / 1000; // 60-lb bushel of wheat per acre → t/ha

export const NASS_KS_STATE_WHEAT_BU_AC: Record<number, number> = {
  2015: 37, 2016: 57, 2017: 48, 2018: 38, 2019: 52, 2020: 45, 2021: 52, 2022: 37, 2023: 35, 2024: 43,
};
export const NASS_SOURCE = 'USDA NASS Kansas winter wheat yield, statewide, all practices — via Kansas Wheat, kswheat.com/growers/average-kansas-wheat-production';

export interface ValidationRow { year: number; observed: number; modelled: number }
export interface ValidationResult {
  rows: ValidationRow[]; // t/ha
  meanObserved: number;
  meanModelled: number;
  biasPct: number; // (model − observed) / observed
  mae: number; // t/ha
  r: number; // Pearson correlation of year-to-year variation
  directionHits: number; // years where model and NASS moved the same direction vs the previous year
  directionYears: number;
}

const mean = (a: number[]) => a.reduce((t, x) => t + x, 0) / a.length;

export function pearson(x: number[], y: number[]): number {
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}

export function validateKansasWheat(s: DailySeries, dd: DailyDerived, soil: Soil = 'loam'): ValidationResult {
  const r = simulateRotation(s, dd, rotationDefs('wheat').baseline, { irrigation: 'rainfed', region: 'kansas', soil });
  const rows: ValidationRow[] = r.seasons
    .filter((x) => x.crop === 'wheat' && NASS_KS_STATE_WHEAT_BU_AC[x.harvestYear] !== undefined)
    .map((x) => ({ year: x.harvestYear, observed: NASS_KS_STATE_WHEAT_BU_AC[x.harvestYear] * BU_AC_TO_T_HA, modelled: x.yieldT }));
  const obs = rows.map((x) => x.observed);
  const mod = rows.map((x) => x.modelled);
  let hits = 0;
  for (let i = 1; i < rows.length; i++) if (Math.sign(mod[i] - mod[i - 1]) === Math.sign(obs[i] - obs[i - 1])) hits++;
  return {
    rows,
    meanObserved: mean(obs),
    meanModelled: mean(mod),
    biasPct: (100 * (mean(mod) - mean(obs))) / mean(obs),
    mae: mean(rows.map((x) => Math.abs(x.modelled - x.observed))),
    r: pearson(mod, obs),
    directionHits: hits,
    directionYears: rows.length - 1,
  };
}

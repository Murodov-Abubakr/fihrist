import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveDaily, type DailySeries } from './climate';
import { BU_AC_TO_T_HA, NASS_KS_STATE_WHEAT_BU_AC, pearson, validateKansasWheat } from './validation';

const kansas: DailySeries = JSON.parse(readFileSync(join(__dirname, '../../public/data/presets/kansas.json'), 'utf8')).series;

describe('Kansas validation (model vs USDA NASS)', () => {
  it('converts bushels per acre to t/ha (60 lb wheat bushel)', () => {
    expect(40 * BU_AC_TO_T_HA).toBeCloseTo(2.69, 2);
  });
  it('pearson correlation basics', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 9);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 9);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
  });
  it('covers all ten NASS years 2015–2024', () => {
    const v = validateKansasWheat(kansas, deriveDaily(kansas));
    expect(v.rows.map((r) => r.year)).toEqual(Object.keys(NASS_KS_STATE_WHEAT_BU_AC).map(Number));
  });
  it('regression guard: the model keeps following real good and bad years', () => {
    // Recorded 2026-11-15 (loam): r = 0.77, direction 8/9, level −45 %. A change to the engine that
    // destroys the year-to-year agreement must fail here; the level bias is reported, not hidden.
    const v = validateKansasWheat(kansas, deriveDaily(kansas), 'loam');
    expect(v.r).toBeGreaterThan(0.6);
    expect(v.directionHits).toBeGreaterThanOrEqual(7);
    expect(v.biasPct).toBeLessThan(0); // known: modelled rainfed level is below the statewide average
  });
  it('records the stage-specific Ky test: it does not beat the seasonal Ky (so seasonal stays the default)', () => {
    const dd = deriveDaily(kansas);
    const season = validateKansasWheat(kansas, dd, 'loam', 'season');
    const stage = validateKansasWheat(kansas, dd, 'loam', 'stage');
    expect(stage.rows.map((x) => x.modelled)).not.toEqual(season.rows.map((x) => x.modelled)); // the stage path is really used
    expect(stage.r).toBeLessThan(season.r);
    expect(validateKansasWheat(kansas, dd).r).toBeCloseTo(season.r, 12); // default = seasonal
  });
});

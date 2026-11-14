/**
 * Rotation simulation: replays each 3-year rotation on the field's real NASA POWER weather,
 * 2015–2024 (crops accounted to their harvest year), and reports water, food, nitrogen and money.
 *
 * Water: daily ETc = Kc·ET0 (FAO-56); monthly effective rain (USDA-SCS) shared by days on field;
 *   irrigated → net irrigation = Σ max(0, ETc − Peff) and no water stress;
 *   rainfed  → ETa = Σ min(ETc, Peff) per month, yield via FAO-33 Ky.
 *   Soil-water storage between months is NOT modelled yet (listed as an information gap).
 * Yield: Ya = Ym · max(0, 1 − Ky (1 − ETa/ETc))  (FAO-33).
 * Nitrogen: removal = grain yield × protein / 6.25; legume fixation = N_FIXED × Ya/Ym;
 *   N debt = max(0, removal − fixation); hidden cost = debt / 0.46 × urea price (CLAUDE.md §5).
 *   N losses (leaching, volatilisation) are not modelled yet (information gap).
 */
import type { DailyDerived, DailySeries } from './climate.ts';
import { CROPS, type CropId, type CropParams } from './crops.ts';
import { kcOnDay, seasonLength } from './kc.ts';
import {
  IRRIGATION_EFFICIENCY, KCAL_PER_PERSON_DAY, KY, N_FIXED, N_TO_PROTEIN, NUTRITION, PRICE_USD_T,
  UREA_N_SHARE, UREA_USD_T, YM, type Param, type RegionId,
} from './params.ts';
import { effectiveRainUSDA } from './water.ts';

export type RotationId = 'baseline' | 'waterSaving' | 'regenerative';
export type Irrigation = 'rainfed' | 'canal' | 'drip';
type PlantingCrop = CropId | 'cover';

interface Planting {
  crop: PlantingCrop;
  plant: [number, number]; // month, day
  yearOffset: number; // within the cycle
  lengthDays?: number; // for the winter cover (terminated, not harvested)
}
export interface RotationDef { id: RotationId; cycleYears: number; plantings: Planting[]; display: PlantingCrop[] }

/** Winter cover: modelled with the winter-wheat Kc curve, terminated after 170 days (15 Oct → ~2 Apr). TODO verify species/termination. */
const COVER_DAYS = 170;

/**
 * Rotation calendars (Central Asian sowing dates — TODO verify with local agronomists).
 * Cycles are arranged so plantings never overlap.
 */
export function rotationDefs(baseline: 'wheat' | 'wheatCotton'): Record<RotationId, RotationDef> {
  return {
    baseline: baseline === 'wheat'
      ? { id: 'baseline', cycleYears: 1, plantings: [{ crop: 'wheat', plant: [10, 15], yearOffset: 0 }], display: ['wheat', 'wheat', 'wheat'] }
      : {
          id: 'baseline', cycleYears: 2,
          // cotton Apr 10 → ~Oct 22; wheat sown after cotton, Nov 1 → ~Jun 28 next year
          plantings: [{ crop: 'cotton', plant: [4, 10], yearOffset: 0 }, { crop: 'wheat', plant: [11, 1], yearOffset: 0 }],
          display: ['wheat', 'cotton', 'wheat'],
        },
    waterSaving: {
      id: 'waterSaving', cycleYears: 3,
      // sorghum Apr 20 → Aug 28; wheat Oct 15 → Jun 11; chickpea Mar 15 (yr 2) → Jul 3
      plantings: [{ crop: 'sorghum', plant: [4, 20], yearOffset: 0 }, { crop: 'wheat', plant: [10, 15], yearOffset: 0 }, { crop: 'chickpea', plant: [3, 15], yearOffset: 2 }],
      display: ['wheat', 'chickpea', 'sorghum'],
    },
    regenerative: {
      id: 'regenerative', cycleYears: 2,
      // sorghum Apr 20 → Aug 28; wheat Oct 15 → Jun 11; mung Jun 20 → Sep 28; cover Oct 5 → ~Mar 24
      plantings: [
        { crop: 'sorghum', plant: [4, 20], yearOffset: 0 }, { crop: 'wheat', plant: [10, 15], yearOffset: 0 },
        { crop: 'mung', plant: [6, 20], yearOffset: 1 }, { crop: 'cover', plant: [10, 5], yearOffset: 1, lengthDays: COVER_DAYS },
      ],
      display: ['wheat', 'mung', 'cover'],
    },
  };
}

const paramsOf = (c: PlantingCrop): CropParams => (c === 'cover' ? CROPS.wheat : CROPS[c]);

export interface SeasonResult {
  crop: PlantingCrop;
  sowIdx: number;
  harvestYear: number;
  days: number;
  etc: number; // mm
  eta: number; // mm (rainfed) or etc (irrigated)
  netIrrigation: number; // mm
  et0: number; // mm (season sum)
  rain: number; // mm (season sum)
  yieldT: number; // t/ha
}

export interface YearResult {
  year: number;
  kcal: number; // per ha
  proteinKg: number;
  peopleFed: number;
  revenueUsd: number;
  nRemovedKg: number;
  nFixedKg: number;
  nDebtKg: number;
  nCostUsd: number;
  trueProfitUsd: number;
  netIrrigationM3: number;
  grossIrrigationM3: number;
  unmetM3: number; // rainfed water shortfall Σ(ETc − ETa)·10
  bareDays: number;
  bareRainMm: number; // rain falling on bare soil (erosion proxy)
  livingRootDays: number;
  forageSeasons: number; // cereal straw/stover + cover seasons
}

export interface RotationResult {
  id: RotationId;
  def: RotationDef;
  seasons: SeasonResult[];
  years: YearResult[];
  mean: Omit<YearResult, 'year'>;
  /** percentiles of rotation-cycle-mean people fed across 2015–2024 weather (not Monte Carlo — that is step 4) */
  peopleFedP: { p10: number; p50: number; p90: number };
  nBalance10yKg: number; // cumulative fixed − removed over the simulated years
  paramsUsed: Param[];
}

export interface SimOptions {
  irrigation: Irrigation;
  region: RegionId;
  /** first and last harvest year to report (inclusive) */
  fromYear?: number;
  toYear?: number;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function simulateRotation(s: DailySeries, dd: DailyDerived, def: RotationDef, opt: SimOptions): RotationResult {
  const fromYear = opt.fromYear ?? 2015;
  const toYear = opt.toYear ?? 2024;
  const n = s.tmax.length;
  const irrigated = opt.irrigation !== 'rainfed';

  // monthly rain and day counts, keyed "y-m"
  const rainByMonth = new Map<string, number>();
  dd.dates.forEach((d, i) => rainByMonth.set(`${d.y}-${d.m}`, (rainByMonth.get(`${d.y}-${d.m}`) ?? 0) + s.prcp[i]));
  const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const idxOf = new Map<string, number>();
  dd.dates.forEach((d, i) => idxOf.set(`${d.y}-${d.m}-${d.d}`, i));

  const occupied = new Uint8Array(n); // 1 = living crop/cover on field
  const seasons: SeasonResult[] = [];

  const firstYear = dd.dates[0].y;
  for (let cyc = firstYear - def.cycleYears; cyc <= toYear; cyc += def.cycleYears) {
    for (const p of def.plantings) {
      const y = cyc + p.yearOffset;
      const sowIdx = idxOf.get(`${y}-${p.plant[0]}-${p.plant[1]}`);
      if (sowIdx === undefined) continue;
      const params = paramsOf(p.crop);
      const len = p.lengthDays ?? seasonLength(params);
      if (sowIdx + len > n) continue;
      const harvestYear = dd.dates[sowIdx + len - 1].y;
      for (let k = 0; k < len; k++) occupied[sowIdx + k] = 1;
      if (harvestYear < fromYear || harvestYear > toYear) continue;

      // season water balance by calendar month
      const months = new Map<string, { y: number; m: number; etc: number; days: number }>();
      let et0 = 0;
      let rain = 0;
      for (let k = 0; k < len; k++) {
        const i = sowIdx + k;
        const d = dd.dates[i];
        const key = `${d.y}-${d.m}`;
        const row = months.get(key) ?? { y: d.y, m: d.m, etc: 0, days: 0 };
        row.etc += kcOnDay(params, k) * dd.et0[i];
        row.days++;
        months.set(key, row);
        et0 += dd.et0[i];
        rain += s.prcp[i];
      }
      let etc = 0;
      let eta = 0;
      let netIrr = 0;
      for (const [key, row] of months) {
        const peffShare = effectiveRainUSDA(rainByMonth.get(key) ?? 0) * (row.days / daysInMonth(row.y, row.m));
        etc += row.etc;
        eta += Math.min(row.etc, peffShare);
        netIrr += Math.max(0, row.etc - peffShare);
      }
      if (irrigated) eta = etc;

      let yieldT = 0;
      if (p.crop !== 'cover') {
        const ym = YM[opt.region][p.crop].value;
        const ky = KY[p.crop].value;
        yieldT = etc > 0 ? ym * Math.max(0, 1 - ky * (1 - eta / etc)) : 0;
      }
      seasons.push({ crop: p.crop, sowIdx, harvestYear, days: len, etc, eta, netIrrigation: irrigated ? netIrr : 0, et0, rain, yieldT });
    }
  }

  // annual accounting
  const eff = opt.irrigation === 'drip' ? IRRIGATION_EFFICIENCY.drip.value : IRRIGATION_EFFICIENCY.canal.value;
  const years: YearResult[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    const ys = seasons.filter((x) => x.harvestYear === y);
    let kcal = 0, proteinKg = 0, revenue = 0, nRem = 0, nFix = 0, netIrr = 0, unmet = 0, forage = 0;
    for (const x of ys) {
      if (x.crop === 'cover') { forage++; unmet += irrigated ? 0 : 10 * (x.etc - x.eta); netIrr += x.netIrrigation; continue; }
      const kg = x.yieldT * 1000;
      const nut = NUTRITION[x.crop];
      kcal += kg * nut.kcal.value * 10; // kcal/100 g → kcal/kg ×10
      proteinKg += (kg * nut.protein.value) / 100;
      nRem += (kg * nut.protein.value) / 100 / N_TO_PROTEIN;
      const fixP = N_FIXED[x.crop];
      if (fixP) nFix += fixP.value * (x.yieldT / YM[opt.region][x.crop].value);
      revenue += x.yieldT * PRICE_USD_T[x.crop].value;
      netIrr += x.netIrrigation;
      unmet += irrigated ? 0 : 10 * (x.etc - x.eta);
      if (x.crop === 'wheat' || x.crop === 'sorghum') forage++;
    }
    // land cover in this calendar year
    let bare = 0, bareRain = 0, living = 0;
    dd.dates.forEach((d, i) => {
      if (d.y !== y) return;
      if (occupied[i]) living++;
      else { bare++; bareRain += s.prcp[i]; }
    });
    const nDebt = Math.max(0, nRem - nFix);
    const nCost = (nDebt / UREA_N_SHARE) * (UREA_USD_T.value / 1000);
    years.push({
      year: y, kcal, proteinKg, peopleFed: kcal / (KCAL_PER_PERSON_DAY * 365), revenueUsd: revenue,
      nRemovedKg: nRem, nFixedKg: nFix, nDebtKg: nDebt, nCostUsd: nCost, trueProfitUsd: revenue - nCost,
      netIrrigationM3: netIrr * 10, grossIrrigationM3: irrigated ? (netIrr * 10) / eff : 0, unmetM3: unmet,
      bareDays: bare, bareRainMm: bareRain, livingRootDays: living, forageSeasons: forage,
    });
  }

  const keys = Object.keys(years[0]).filter((k) => k !== 'year') as (keyof Omit<YearResult, 'year'>)[];
  const mean = Object.fromEntries(keys.map((k) => [k, years.reduce((t, y) => t + y[k], 0) / years.length])) as Omit<YearResult, 'year'>;
  // P10/P50/P90 over rolling means one rotation-cycle long: removes the year-to-year swing caused by
  // WHICH crop is harvested (cycle phase) and leaves the variability caused by weather.
  const w = Math.min(def.cycleYears, years.length);
  const rolling: number[] = [];
  for (let i = 0; i + w <= years.length; i++) rolling.push(years.slice(i, i + w).reduce((t, y) => t + y.peopleFed, 0) / w);
  const pf = rolling.sort((a, b) => a - b);

  const crops = [...new Set(def.plantings.map((p) => p.crop))].filter((c): c is CropId => c !== 'cover');
  const paramsUsed: Param[] = crops.flatMap((c) => [YM[opt.region][c], KY[c], NUTRITION[c].kcal, PRICE_USD_T[c], ...(N_FIXED[c] ? [N_FIXED[c]!] : [])]);
  if (irrigated) paramsUsed.push(opt.irrigation === 'drip' ? IRRIGATION_EFFICIENCY.drip : IRRIGATION_EFFICIENCY.canal);
  paramsUsed.push(UREA_USD_T);

  return {
    id: def.id, def, seasons, years, mean,
    peopleFedP: { p10: quantile(pf, 0.1), p50: quantile(pf, 0.5), p90: quantile(pf, 0.9) },
    nBalance10yKg: years.reduce((t, y) => t + y.nFixedKg - y.nRemovedKg, 0),
    paramsUsed,
  };
}

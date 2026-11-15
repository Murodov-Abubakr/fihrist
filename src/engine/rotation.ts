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
import { seasonLength } from './kc.ts';
import { waterWindow, type Soil, type WaterWindow } from './soilwater.ts';
import {
  IRRIGATION_EFFICIENCY, KCAL_PER_PERSON_DAY, KY, N_FIXED, N_TO_PROTEIN, NUTRITION, PRICE_USD_T,
  UREA_N_SHARE, UREA_USD_T, YM, type Param, type RegionId,
} from './params.ts';

export type RotationId = 'baseline' | 'waterSaving' | 'regenerative';
export type Irrigation = 'rainfed' | 'canal' | 'drip';
export type PlantingCrop = CropId | 'cover';
const CROP_LIST: PlantingCrop[] = ['wheat', 'cotton', 'chickpea', 'sorghum', 'mung', 'cover'];

interface Planting {
  crop: PlantingCrop;
  plant: [number, number]; // month, day
  yearOffset: number; // within the cycle
  lengthDays?: number; // for the winter cover (terminated, not harvested)
}
export interface RotationDef {
  id: RotationId; cycleYears: number; plantings: Planting[]; display: PlantingCrop[];
  /** farmer-defined baseline: crops sown in each year of the cycle (in sowing order) */
  displayYears?: PlantingCrop[][];
}

/* ───────────── Farmer-defined baseline ("my current rotation") ───────────── */
export type SpringCrop = 'cotton' | 'sorghum' | 'chickpea' | 'mung';
export type AutumnCrop = 'wheat' | 'cover';
export interface CustomYear { spring: SpringCrop | null; autumn: AutumnCrop | null }
export interface CustomRotation { kind: 'custom'; years: CustomYear[] }
export type BaselineSpec = 'wheat' | 'wheatCotton' | CustomRotation;
export const SPRING_CROPS: SpringCrop[] = ['cotton', 'sorghum', 'chickpea', 'mung'];
export const AUTUMN_CROPS: AutumnCrop[] = ['wheat', 'cover'];
export const CUSTOM_MAX_YEARS = 3;
/** Sowing dates (Central Asian presets — TODO verify locally), the same ones the suggested rotations use. */
export const SOW_DATE: Record<SpringCrop | AutumnCrop | 'wheatAfterCotton', [number, number]> = {
  chickpea: [3, 15], cotton: [4, 10], sorghum: [4, 20], mung: [6, 20], // mung: summer catch crop after wheat harvest
  wheat: [10, 15], wheatAfterCotton: [11, 1], cover: [10, 5],
};

/** Validates untrusted input (UI state) into a CustomRotation, or returns null. */
export function parseCustom(x: unknown): CustomRotation | null {
  if (!x || typeof x !== 'object' || (x as { kind?: unknown }).kind !== 'custom') return null;
  const years = (x as { years?: unknown }).years;
  if (!Array.isArray(years) || years.length < 1 || years.length > CUSTOM_MAX_YEARS) return null;
  const out: CustomYear[] = [];
  for (const y of years) {
    if (!y || typeof y !== 'object') return null;
    const s = (y as { spring?: unknown }).spring ?? null;
    const a = (y as { autumn?: unknown }).autumn ?? null;
    if (s !== null && !SPRING_CROPS.includes(s as SpringCrop)) return null;
    if (a !== null && !AUTUMN_CROPS.includes(a as AutumnCrop)) return null;
    out.push({ spring: s as SpringCrop | null, autumn: a as AutumnCrop | null });
  }
  return { kind: 'custom', years: out };
}

export type CustomProblem =
  | { kind: 'empty' }
  | { kind: 'overlap'; first: PlantingCrop; firstYear: number; second: PlantingCrop; secondYear: number };

/** Builds the baseline RotationDef from the farmer's cycle, or explains why the calendar is impossible. */
export function customDef(c: CustomRotation): RotationDef | CustomProblem {
  const plantings: Planting[] = [];
  c.years.forEach((y, i) => {
    if (y.spring) plantings.push({ crop: y.spring, plant: SOW_DATE[y.spring], yearOffset: i });
    if (y.autumn) {
      const date = y.autumn === 'wheat' && y.spring === 'cotton' ? SOW_DATE.wheatAfterCotton : SOW_DATE[y.autumn];
      plantings.push({ crop: y.autumn, plant: date, yearOffset: i, ...(y.autumn === 'cover' ? { lengthDays: COVER_DAYS } : {}) });
    }
  });
  if (!plantings.some((p) => p.crop !== 'cover')) return { kind: 'empty' };
  const def: RotationDef = {
    id: 'baseline', cycleYears: c.years.length, plantings,
    display: c.years.map((y) => (y.spring ?? y.autumn ?? 'cover')),
    displayYears: c.years.map((y) => [y.spring, y.autumn].filter((x): x is SpringCrop | AutumnCrop => x !== null)),
  };
  const clash = findOverlap(def);
  return clash ?? def;
}

/** First pair of plantings that would occupy the field on the same day (checked over three cycles). */
export function findOverlap(def: RotationDef): CustomProblem | null {
  const days = new Map<number, { crop: PlantingCrop; year: number }>();
  for (let cyc = 0; cyc < 3; cyc++) {
    for (const p of def.plantings) {
      const start = Date.UTC(2001 + cyc * def.cycleYears + p.yearOffset, p.plant[0] - 1, p.plant[1]) / 864e5;
      const len = p.lengthDays ?? seasonLength(paramsOf(p.crop));
      for (let d = 0; d < len; d++) {
        const prev = days.get(start + d);
        if (prev) return { kind: 'overlap', first: prev.crop, firstYear: prev.year + 1, second: p.crop, secondYear: p.yearOffset + 1 };
        days.set(start + d, { crop: p.crop, year: p.yearOffset });
      }
    }
  }
  return null;
}

/** Winter cover: modelled with the winter-wheat Kc curve, terminated after 170 days (15 Oct → ~2 Apr). TODO verify species/termination. */
const COVER_DAYS = 170;

/**
 * Rotation calendars (Central Asian sowing dates — TODO verify with local agronomists).
 * Cycles are arranged so plantings never overlap.
 */
export function rotationDefs(baseline: BaselineSpec): Record<RotationId, RotationDef> {
  const custom = typeof baseline === 'object' ? customDef(baseline) : null;
  const customOk = custom && 'plantings' in custom ? custom : null;
  return {
    baseline: customOk ?? (baseline === 'wheatCotton' ? fixedBaseline('wheatCotton') : fixedBaseline('wheat')),
    ...suggestedRotations(),
  };
}

function fixedBaseline(baseline: 'wheat' | 'wheatCotton'): RotationDef {
  return baseline === 'wheat'
    ? { id: 'baseline', cycleYears: 1, plantings: [{ crop: 'wheat', plant: [10, 15], yearOffset: 0 }], display: ['wheat', 'wheat', 'wheat'] }
    : {
        id: 'baseline', cycleYears: 2,
        // cotton Apr 10 → ~Oct 22; wheat sown after cotton, Nov 1 → ~Jun 28 next year
        plantings: [{ crop: 'cotton', plant: [4, 10], yearOffset: 0 }, { crop: 'wheat', plant: [11, 1], yearOffset: 0 }],
        display: ['wheat', 'cotton', 'wheat'],
      };
}

function suggestedRotations(): Record<'waterSaving' | 'regenerative', RotationDef> {
  return {
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

export const paramsOf = (c: PlantingCrop): CropParams => (c === 'cover' ? CROPS.wheat : CROPS[c]);

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
  sowDepletion: number; // root-zone depletion at sowing, fraction of TAW (0 = full profile)
  fallowRain: number; // mm since the previous crop ended
}

/** Soil water carried into each planting of the cycle (for the Monte Carlo season tables). */
export interface Antecedent { gapDays: number; dr0: number }

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
  /** field calendar per cycle year (index 0 = first year of the cycle) × 12 months, averaged over the replay years */
  calendar: MonthCover[][];
  /** per planting of the cycle: typical fallow length before it and the depletion it starts from */
  antecedent: Antecedent[];
}

/** Share of a month's days with a living crop, and which crops occupied it (as a share of the month's days). */
export interface MonthCover { live: number; crops: { crop: PlantingCrop; share: number }[] }

export interface SimOptions {
  irrigation: Irrigation;
  region: RegionId;
  /** soil texture for the root-zone water balance (default loam) */
  soil?: Soil;
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

/**
 * One crop season's water balance and yield. Shared by the deterministic replay and the Monte Carlo
 * season tables so both use identical physics.
 */
export function seasonWater(
  s: DailySeries, dd: DailyDerived, crop: PlantingCrop, startIdx: number, sowIdx: number, len: number,
  irrigated: boolean, region: RegionId, soil: Soil, dr0: number,
): WaterWindow & { yieldT: number } {
  const w = waterWindow(s, dd, crop, startIdx, sowIdx, len, irrigated, soil, dr0);
  let yieldT = 0;
  if (crop !== 'cover') {
    const ym = YM[region][crop].value;
    yieldT = w.etc > 0 ? ym * Math.max(0, 1 - KY[crop].value * (1 - w.eta / w.etc)) : 0;
  }
  return { ...w, yieldT };
}

/** Food, nitrogen and money from one harvested season (cover crop → zeros). */
export function seasonEconomics(crop: PlantingCrop, yieldT: number, region: RegionId) {
  if (crop === 'cover') return { kcal: 0, proteinKg: 0, nRemovedKg: 0, nFixedKg: 0, revenueUsd: 0 };
  const kg = yieldT * 1000;
  const nut = NUTRITION[crop];
  const proteinKg = (kg * nut.protein.value) / 100;
  const fixP = N_FIXED[crop];
  return {
    kcal: kg * nut.kcal.value * 10, // kcal/100 g → kcal/kg × 10
    proteinKg,
    nRemovedKg: proteinKg / N_TO_PROTEIN,
    nFixedKg: fixP ? fixP.value * (yieldT / YM[region][crop].value) : 0,
    revenueUsd: yieldT * PRICE_USD_T[crop].value,
  };
}

/** Monthly rain totals and actual day counts per "y-m" (works for real and synthetic calendars). */
export function monthTables(s: DailySeries, dd: DailyDerived) {
  const rainByMonth = new Map<string, number>();
  const dayCount = new Map<string, number>();
  dd.dates.forEach((d, i) => {
    const k = `${d.y}-${d.m}`;
    rainByMonth.set(k, (rainByMonth.get(k) ?? 0) + s.prcp[i]);
    dayCount.set(k, (dayCount.get(k) ?? 0) + 1);
  });
  // whole calendar month length (partial months at series edges still use the full length)
  const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { rainByMonth, dayCount, daysInMonth };
}

export function simulateRotation(s: DailySeries, dd: DailyDerived, def: RotationDef, opt: SimOptions): RotationResult {
  const fromYear = opt.fromYear ?? 2015;
  const toYear = opt.toYear ?? 2024;
  const n = s.tmax.length;
  const irrigated = opt.irrigation !== 'rainfed';

  const soil = opt.soil ?? 'loam';
  const idxOf = new Map<string, number>();
  dd.dates.forEach((d, i) => idxOf.set(`${d.y}-${d.m}-${d.d}`, i));

  const occupied = new Uint8Array(n); // 0 = bare; k = CROP_LIST[k - 1] living on the field
  const seasons: SeasonResult[] = [];

  // Continuous soil water balance over the whole series: each season starts where the previous one
  // ended (through the bare fallow in between). Plantings are visited in chronological order.
  // The first season starts at field capacity; with 2001 as the first year and results reported from
  // 2015, that initial assumption has no influence on the reported years (13+ years of spin-up).
  let prevEnd = -1;
  let prevDepletion = 0;
  const np = def.plantings.length;
  const gaps: number[][] = Array.from({ length: np }, () => []);
  const ends: number[][] = Array.from({ length: np }, () => []);
  const firstYear = dd.dates[0].y;
  for (let cyc = firstYear - def.cycleYears; cyc <= toYear; cyc += def.cycleYears) {
    def.plantings.forEach((p, j) => {
      const y = cyc + p.yearOffset;
      const sowIdx = idxOf.get(`${y}-${p.plant[0]}-${p.plant[1]}`);
      if (sowIdx === undefined) return;
      const len = p.lengthDays ?? seasonLength(paramsOf(p.crop));
      if (sowIdx + len > n) return;
      const harvestYear = dd.dates[sowIdx + len - 1].y;
      const code = CROP_LIST.indexOf(p.crop) + 1;
      for (let k = 0; k < len; k++) occupied[sowIdx + k] = code;

      const startIdx = prevEnd < 0 ? sowIdx : prevEnd + 1;
      const w = seasonWater(s, dd, p.crop, startIdx, sowIdx, len, irrigated, opt.region, soil, prevEnd < 0 ? 0 : prevDepletion);
      if (prevEnd >= 0) gaps[j].push(sowIdx - startIdx);
      ends[j].push(w.endDepletion);
      prevEnd = sowIdx + len - 1;
      prevDepletion = w.endDepletion;
      if (harvestYear < fromYear || harvestYear > toYear) return;
      seasons.push({
        crop: p.crop, sowIdx, harvestYear, days: len, etc: w.etc, eta: w.eta, netIrrigation: w.netIrrigation,
        et0: w.et0, rain: w.rain, yieldT: w.yieldT, sowDepletion: w.sowDepletion, fallowRain: w.fallowRain,
      });
    });
  }
  const med = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
  const avg = (a: number[]) => (a.length ? a.reduce((t, x) => t + x, 0) / a.length : 0);
  // each planting starts from the typical end state of the planting before it in the cycle
  const antecedent: Antecedent[] = def.plantings.map((_, j) => ({ gapDays: med(gaps[j]), dr0: avg(ends[(j - 1 + np) % np]) }));

  // annual accounting
  const eff = opt.irrigation === 'drip' ? IRRIGATION_EFFICIENCY.drip.value : IRRIGATION_EFFICIENCY.canal.value;
  const years: YearResult[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    const ys = seasons.filter((x) => x.harvestYear === y);
    let kcal = 0, proteinKg = 0, revenue = 0, nRem = 0, nFix = 0, netIrr = 0, unmet = 0, forage = 0;
    for (const x of ys) {
      if (x.crop === 'cover') { forage++; unmet += irrigated ? 0 : 10 * (x.etc - x.eta); netIrr += x.netIrrigation; continue; }
      const e = seasonEconomics(x.crop, x.yieldT, opt.region);
      kcal += e.kcal;
      proteinKg += e.proteinKg;
      nRem += e.nRemovedKg;
      nFix += e.nFixedKg;
      revenue += e.revenueUsd;
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

  // Field calendar. Cycles start in years ≡ firstYear (mod cycle), so cycle year = (y − firstYear) mod cycle.
  const cyc = def.cycleYears;
  const acc = Array.from({ length: cyc }, () => Array.from({ length: 12 }, () => ({ days: 0, live: 0, by: new Map<PlantingCrop, number>() })));
  dd.dates.forEach((d, i) => {
    if (d.y < fromYear || d.y > toYear) return;
    const cell = acc[(((d.y - firstYear) % cyc) + cyc) % cyc][d.m - 1];
    cell.days++;
    const code = occupied[i];
    if (!code) return;
    cell.live++;
    const crop = CROP_LIST[code - 1];
    cell.by.set(crop, (cell.by.get(crop) ?? 0) + 1);
  });
  const calendar: MonthCover[][] = acc.map((row) => row.map((c) => ({
    live: c.days ? c.live / c.days : 0,
    crops: [...c.by.entries()].map(([crop, k]) => ({ crop, share: k / c.days })).sort((a, b) => b.share - a.share),
  })));

  return {
    id: def.id, def, seasons, years, mean, calendar, antecedent,
    peopleFedP: { p10: quantile(pf, 0.1), p50: quantile(pf, 0.5), p90: quantile(pf, 0.9) },
    nBalance10yKg: years.reduce((t, y) => t + y.nFixedKg - y.nRemovedKg, 0),
    paramsUsed,
  };
}

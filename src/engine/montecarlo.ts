/**
 * Monte Carlo over plausible decades (CLAUDE.md §5 eq. 12), designed so batches are tiny:
 *
 * 1. Season tables (client side, once per field/settings): every crop planting of every rotation is
 *    simulated on EVERY real sowing year 2001–2023 with the full engine (FAO-56 water balance,
 *    FAO-33 yield, nitrogen, money). Each entry keeps the real, internally consistent weather of
 *    that season.
 * 2. A run = one plausible decade: for each synthetic sowing year draw one real year at random
 *    (with replacement, "year bootstrap"), and assemble the rotation's seasons from the table.
 *    All seasons sown in the same synthetic year share the same real year, and all three
 *    rotations share the same draws within a run (common random numbers → fair comparison).
 * 3. Report P10/P50/P90 across runs of decade-mean people fed, water, N balance, true profit.
 *
 * Climate stress: the sliders shift daily Tmax/Tmin by ΔT and scale daily rain by (1 + ΔP),
 * the "delta change" method; RH, wind and radiation are kept (so vapour pressure rises with T).
 * This samples WEATHER uncertainty only; parameter uncertainty (yields, prices, fixation) is not
 * sampled (listed as an information gap).
 */
import { deriveDaily, type DailyDerived, type DailySeries } from './climate.ts';
import { seasonLength } from './kc.ts';
import { IRRIGATION_EFFICIENCY, UREA_N_SHARE, UREA_USD_T, KCAL_PER_PERSON_DAY, type RegionId } from './params.ts';
import {
  paramsOf, rotationDefs, seasonEconomics, seasonWater, simulateRotation,
  type Irrigation, type RotationDef, type RotationId,
} from './rotation.ts';
import type { Soil } from './soilwater.ts';

/**
 * Horizon is 12 years, not 10 (CLAUDE.md §5 says 10): 12 holds WHOLE cycles of the 1-, 2- and 3-year
 * rotations, so no run is biased by which crop happens to fall in the window (cycle-phase artifact).
 */
export const MC_LIMITS = { maxRunsPerBatch: 500, maxTotalRuns: 5000, maxBatches: 16, decadeYears: 12, maxPayloadBytes: 150_000 };
export const MC_FORMAT = 'fihrist-mc-v1';

/** Apply the climate-stress sliders to a copy of the series (delta-change method). */
export function applyClimateDelta(s: DailySeries, dT: number, dPpct: number): DailySeries {
  if (dT === 0 && dPpct === 0) return s;
  const f = 1 + dPpct / 100;
  return { ...s, tmax: s.tmax.map((v) => v + dT), tmin: s.tmin.map((v) => v + dT), prcp: s.prcp.map((v) => v * f) };
}

/** Per-season result vector: [kcal, proteinKg, nRemovedKg, nFixedKg, revenueUsd, waterM3] */
export type SeasonVec = [number, number, number, number, number, number];

export interface PlantingTable {
  yearOffset: number; // sowing year within the cycle
  harvestLag: number; // harvest calendar year − sowing calendar year (0 or 1)
  bySowYear: Record<string, SeasonVec>; // real sowing year → result
}
export interface RotationTable { id: RotationId; cycleYears: number; plantings: PlantingTable[] }
export interface McPayload {
  format: typeof MC_FORMAT;
  years: number[]; // real sowing years usable for EVERY planting (the bootstrap pool)
  rotations: RotationTable[];
  ureaUsdPerKgN: number; // hidden-N-cost price per kg N
}

/** Builds the season tables for the three rotations (heavy part; runs in the browser). */
export function buildSeasonTables(s: DailySeries, dd: DailyDerived, opt: { irrigation: Irrigation; region: RegionId; baseline: 'wheat' | 'wheatCotton'; soil?: Soil }): McPayload {
  const defs = rotationDefs(opt.baseline);
  const irrigated = opt.irrigation !== 'rainfed';
  const soil = opt.soil ?? 'loam';
  const eff = opt.irrigation === 'drip' ? IRRIGATION_EFFICIENCY.drip.value : IRRIGATION_EFFICIENCY.canal.value;
  const idxOf = new Map<string, number>();
  dd.dates.forEach((d, i) => idxOf.set(`${d.y}-${d.m}-${d.d}`, i));
  const firstYear = dd.dates[0].y;
  const lastYear = dd.dates[dd.dates.length - 1].y;

  const rotations: RotationTable[] = (['baseline', 'waterSaving', 'regenerative'] as RotationId[]).map((id) => {
    const def: RotationDef = defs[id];
    // Soil water at the start of each season: the typical fallow length and end-of-season depletion of
    // the preceding planting, taken from the continuous replay of this rotation on this field.
    const ante = simulateRotation(s, dd, def, { irrigation: opt.irrigation, region: opt.region, soil, fromYear: firstYear, toYear: lastYear }).antecedent;
    return {
      id, cycleYears: def.cycleYears,
      plantings: def.plantings.map((p, j) => {
        const len = p.lengthDays ?? seasonLength(paramsOf(p.crop));
        const bySowYear: Record<string, SeasonVec> = {};
        let harvestLag = 0;
        for (let y = firstYear; y <= lastYear; y++) {
          const sowIdx = idxOf.get(`${y}-${p.plant[0]}-${p.plant[1]}`);
          if (sowIdx === undefined || sowIdx + len > dd.dates.length) continue;
          harvestLag = dd.dates[sowIdx + len - 1].y - y;
          const w = seasonWater(s, dd, p.crop, Math.max(0, sowIdx - ante[j].gapDays), sowIdx, len, irrigated, opt.region, soil, ante[j].dr0);
          const e = seasonEconomics(p.crop, w.yieldT, opt.region);
          const water = irrigated ? (w.netIrrigation * 10) / eff : 10 * (w.etc - w.eta);
          bySowYear[y] = [e.kcal, e.proteinKg, e.nRemovedKg, e.nFixedKg, e.revenueUsd, water];
        }
        return { yearOffset: p.yearOffset, harvestLag, bySowYear };
      }),
    };
  });
  const years: number[] = [];
  for (let y = firstYear; y <= lastYear; y++) {
    if (rotations.every((r) => r.plantings.every((p) => p.bySowYear[y]))) years.push(y);
  }
  return { format: MC_FORMAT, years, rotations, ureaUsdPerKgN: UREA_USD_T.value / 1000 / UREA_N_SHARE };
}

export class McPayloadError extends Error {}

const isNum = (v: unknown, lo = -1e12, hi = 1e12): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/**
 * Strict structural validation of a payload received over the network or via postMessage
 * (OWASP A03/A04/A08). Rejects anything not exactly of the expected shape and size.
 */
export function validatePayload(x: unknown): McPayload {
  const p = x as McPayload;
  if (!p || typeof p !== 'object' || p.format !== MC_FORMAT) throw new McPayloadError('bad format');
  if (!Array.isArray(p.years) || p.years.length < 3 || p.years.length > 200 || !p.years.every((y) => Number.isInteger(y) && y >= 1900 && y <= 2200)) {
    throw new McPayloadError('bad years');
  }
  if (!isNum(p.ureaUsdPerKgN, 0, 100)) throw new McPayloadError('bad price');
  if (!Array.isArray(p.rotations) || p.rotations.length !== 3) throw new McPayloadError('bad rotations');
  const ids = new Set<string>();
  for (const r of p.rotations) {
    if (!['baseline', 'waterSaving', 'regenerative'].includes(r?.id) || ids.has(r.id)) throw new McPayloadError('bad rotation id');
    ids.add(r.id);
    if (!Number.isInteger(r.cycleYears) || r.cycleYears < 1 || r.cycleYears > 5) throw new McPayloadError('bad cycle');
    if (!Array.isArray(r.plantings) || r.plantings.length < 1 || r.plantings.length > 8) throw new McPayloadError('bad plantings');
    for (const pl of r.plantings) {
      if (!Number.isInteger(pl?.yearOffset) || pl.yearOffset < 0 || pl.yearOffset >= r.cycleYears) throw new McPayloadError('bad offset');
      if (pl.harvestLag !== 0 && pl.harvestLag !== 1) throw new McPayloadError('bad lag');
      if (!pl.bySowYear || typeof pl.bySowYear !== 'object' || Object.getPrototypeOf(pl.bySowYear) !== Object.prototype) throw new McPayloadError('bad table');
      for (const y of p.years) {
        const v = Object.prototype.hasOwnProperty.call(pl.bySowYear, String(y)) ? pl.bySowYear[String(y)] : undefined;
        if (!Array.isArray(v) || v.length !== 6 || !v.every((n) => isNum(n, -1e9, 1e9))) throw new McPayloadError('bad season vector');
      }
    }
  }
  return p;
}

/** Small, fast, seedable PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Per-run decade means for each rotation. */
export interface RunMetrics { peopleFed: number[]; waterM3: number[]; nBalanceKg: number[]; profitUsd: number[]; proteinKg: number[] }
export interface BatchResult { runs: number; seed: number; byRotation: Record<RotationId, RunMetrics> }

/** Runs `runs` plausible decades. Pure and deterministic for a given seed. */
export function runBatch(payload: McPayload, runs: number, seed: number): BatchResult {
  if (!Number.isInteger(runs) || runs < 1 || runs > MC_LIMITS.maxRunsPerBatch) throw new McPayloadError('bad run count');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new McPayloadError('bad seed');
  const rand = rng(seed);
  const D = MC_LIMITS.decadeYears;
  const maxCycle = Math.max(...payload.rotations.map((r) => r.cycleYears));
  const pool = payload.years;
  const empty = (): RunMetrics => ({ peopleFed: [], waterM3: [], nBalanceKg: [], profitUsd: [], proteinKg: [] });
  const out = Object.fromEntries(payload.rotations.map((r) => [r.id, empty()])) as Record<RotationId, RunMetrics>;
  const totals = new Float64Array(6);
  const draws = new Int32Array(D + 2 * maxCycle);

  for (let run = 0; run < runs; run++) {
    // synthetic sowing years −maxCycle … D+maxCycle−1 → index + maxCycle
    for (let k = 0; k < draws.length; k++) draws[k] = pool[Math.floor(rand() * pool.length)];
    for (const r of payload.rotations) {
      totals.fill(0);
      let nDebtCost = 0;
      for (let h = 0; h < D; h++) {
        // annual accounting for harvest year h (N debt is computed per year, as in the replay)
        let nRem = 0, nFix = 0;
        for (const pl of r.plantings) {
          const sow = h - pl.harvestLag;
          // is a planting of this kind sown in synthetic year `sow`? (cycle phase)
          if ((((sow - pl.yearOffset) % r.cycleYears) + r.cycleYears) % r.cycleYears !== 0) continue;
          const v = pl.bySowYear[draws[sow + maxCycle]];
          totals[0] += v[0]; totals[1] += v[1]; totals[4] += v[4]; totals[5] += v[5];
          nRem += v[2]; nFix += v[3];
        }
        totals[2] += nRem; totals[3] += nFix;
        nDebtCost += Math.max(0, nRem - nFix) * payload.ureaUsdPerKgN;
      }
      const m = out[r.id];
      m.peopleFed.push(totals[0] / D / (KCAL_PER_PERSON_DAY * 365));
      m.proteinKg.push(totals[1] / D);
      m.nBalanceKg.push(totals[3] - totals[2]); // cumulative over the decade
      m.profitUsd.push((totals[4] - nDebtCost) / D);
      m.waterM3.push(totals[5] / D);
    }
  }
  return { runs, seed, byRotation: out };
}

/** Validates a batch result coming back from a Cloudflare node or a Web Worker (A08). */
export function validateBatchResult(x: unknown, expectedRuns: number): BatchResult {
  const b = x as BatchResult;
  if (!b || typeof b !== 'object' || b.runs !== expectedRuns || !Number.isInteger(b.seed)) throw new McPayloadError('bad batch result');
  for (const id of ['baseline', 'waterSaving', 'regenerative'] as RotationId[]) {
    const m = b.byRotation?.[id];
    if (!m) throw new McPayloadError('missing rotation in result');
    for (const k of ['peopleFed', 'waterM3', 'nBalanceKg', 'profitUsd', 'proteinKg'] as (keyof RunMetrics)[]) {
      const arr = m[k];
      if (!Array.isArray(arr) || arr.length !== expectedRuns || !arr.every((v) => isNum(v, -1e9, 1e9))) throw new McPayloadError(`bad ${k}`);
    }
  }
  return b;
}

/** Request body accepted by /api/simulate and by the Web Worker. */
export interface SimulateRequest { nodeId: number; runs: number; seed: number; payload: McPayload }
export function validateSimulateRequest(x: unknown): SimulateRequest {
  const r = x as SimulateRequest;
  if (!r || typeof r !== 'object') throw new McPayloadError('bad request');
  if (!Number.isInteger(r.nodeId) || r.nodeId < 0 || r.nodeId >= MC_LIMITS.maxBatches) throw new McPayloadError('bad node id');
  if (!Number.isInteger(r.runs) || r.runs < 1 || r.runs > MC_LIMITS.maxRunsPerBatch) throw new McPayloadError('bad run count');
  if (!Number.isInteger(r.seed) || r.seed < 0 || r.seed > 0xffffffff) throw new McPayloadError('bad seed');
  return { nodeId: r.nodeId, runs: r.runs, seed: r.seed, payload: validatePayload(r.payload) };
}

export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface Band { p10: number; p50: number; p90: number }
export type McSummary = Record<RotationId, Record<keyof RunMetrics, Band>> & { runs: number };

/** Merge batch results and compute P10/P50/P90 for every metric and rotation. */
export function summarize(batches: BatchResult[]): McSummary {
  const ids: RotationId[] = ['baseline', 'waterSaving', 'regenerative'];
  const keys: (keyof RunMetrics)[] = ['peopleFed', 'waterM3', 'nBalanceKg', 'profitUsd', 'proteinKg'];
  const res = { runs: batches.reduce((t, b) => t + b.runs, 0) } as McSummary;
  for (const id of ids) {
    const rec = {} as Record<keyof RunMetrics, Band>;
    for (const k of keys) {
      const all = batches.flatMap((b) => b.byRotation[id][k]).sort((a, b) => a - b);
      rec[k] = { p10: quantile(all, 0.1), p50: quantile(all, 0.5), p90: quantile(all, 0.9) };
    }
    res[id] = rec;
  }
  return res;
}

/** Convenience for tests / single-thread use. */
export function deriveForMc(s: DailySeries, dT: number, dP: number) {
  const adj = applyClimateDelta(s, dT, dP);
  return { series: adj, dd: deriveDaily(adj) };
}

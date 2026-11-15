import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DailySeries } from './climate';
import { applyClimateDelta, buildSeasonTables, deriveForMc, MC_FORMAT, runBatch, summarize, validatePayload, McPayloadError } from './montecarlo';
import { rotationDefs, simulateRotation } from './rotation';

const load = (id: string): DailySeries => JSON.parse(readFileSync(join(__dirname, '../../public/data/presets', `${id}.json`), 'utf8')).series;
const gissar = load('gissar');
const kansas = load('kansas');
const opt = { irrigation: 'canal' as const, region: 'centralAsia' as const, baseline: 'wheat' as const };

describe('climate delta', () => {
  it('shifts temperature and scales rain without mutating the input', () => {
    const a = applyClimateDelta(gissar, 2, -20);
    expect(a.tmax[100]).toBeCloseTo(gissar.tmax[100] + 2, 9);
    expect(a.prcp[100]).toBeCloseTo(gissar.prcp[100] * 0.8, 9);
    expect(a.rh).toBe(gissar.rh);
    expect(applyClimateDelta(gissar, 0, 0)).toBe(gissar);
  });
});

describe('season tables + batches', () => {
  const { series, dd } = deriveForMc(gissar, 0, 0);
  const payload = buildSeasonTables(series, dd, opt);

  it('uses sowing years where every planting fits (2001–2023)', () => {
    expect(payload.years[0]).toBe(2001);
    expect(payload.years.at(-1)).toBe(2023);
    expect(() => validatePayload(JSON.parse(JSON.stringify(payload)))).not.toThrow();
  });
  it('is deterministic for a seed and different across seeds', () => {
    const a = runBatch(payload, 50, 42);
    const b = runBatch(payload, 50, 42);
    const c = runBatch(payload, 50, 43);
    expect(a).toEqual(b);
    expect(a.byRotation.regenerative.waterM3).not.toEqual(c.byRotation.regenerative.waterM3);
  });
  it('irrigated people-fed band collapses (yields do not depend on weather) and equals the full-cycle mean', () => {
    const s = summarize([runBatch(payload, 400, 1)]);
    for (const r of payload.rotations) {
      // expected: kcal of one full cycle (irrigated yields are constant across years) / cycle years
      const cycleKcal = r.plantings.reduce((t, pl) => t + pl.bySowYear[payload.years[0]][0], 0);
      const expected = cycleKcal / r.cycleYears / (2200 * 365);
      expect(s[r.id].peopleFed.p90 - s[r.id].peopleFed.p10, r.id).toBeLessThan(1e-6);
      expect(s[r.id].peopleFed.p50, r.id).toBeCloseTo(expected, 6);
    }
  });
  it('irrigated water need varies with weather and is centred on the sampled years', () => {
    const s = summarize([runBatch(payload, 500, 2), runBatch(payload, 500, 3)]);
    const t = payload.rotations[0].plantings[0].bySowYear;
    const poolMean = payload.years.reduce((a, y) => a + t[y][5], 0) / payload.years.length;
    expect(s.baseline.waterM3.p90).toBeGreaterThan(s.baseline.waterM3.p10);
    expect(Math.abs(s.baseline.waterM3.p50 - poolMean) / poolMean).toBeLessThan(0.05);
  });
  it('the deterministic replay agrees with the season tables for the same years', () => {
    const replay = simulateRotation(series, dd, rotationDefs('wheat').baseline, { irrigation: 'canal', region: 'centralAsia' });
    const t = payload.rotations[0].plantings[0].bySowYear;
    // replay harvest years 2015–2024 = wheat sown 2014–2023
    const fromTable = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023].reduce((a, y) => a + t[y][5], 0) / 10;
    // Not identical since the soil water model: the replay carries each year's ACTUAL end-of-season soil
    // state into the next season, while table seasons start from the AVERAGE state (so they can be
    // recombined freely). Same physics, so they must agree closely.
    expect(Math.abs(fromTable - replay.mean.grossIrrigationM3) / replay.mean.grossIrrigationM3).toBeLessThan(0.1);
  });
  it('warming raises irrigation need; less rain lowers rainfed food', () => {
    const hot = deriveForMc(gissar, 3, 0);
    const pHot = buildSeasonTables(hot.series, hot.dd, opt);
    const base = summarize([runBatch(payload, 300, 5)]);
    const warm = summarize([runBatch(pHot, 300, 5)]);
    expect(warm.baseline.waterM3.p50).toBeGreaterThan(base.baseline.waterM3.p50);

    const k0 = deriveForMc(kansas, 0, 0);
    const kDry = deriveForMc(kansas, 0, -30);
    const r = { irrigation: 'rainfed' as const, region: 'kansas' as const, baseline: 'wheat' as const };
    const s0 = summarize([runBatch(buildSeasonTables(k0.series, k0.dd, r), 300, 9)]);
    const sDry = summarize([runBatch(buildSeasonTables(kDry.series, kDry.dd, r), 300, 9)]);
    expect(sDry.baseline.peopleFed.p50).toBeLessThan(s0.baseline.peopleFed.p50);
    expect(s0.baseline.peopleFed.p90).toBeGreaterThan(s0.baseline.peopleFed.p10);
  });
  it('2,400 runs take well under a second (season tables make runs cheap)', () => {
    const t0 = performance.now();
    for (let b = 0; b < 12; b++) runBatch(payload, 200, b);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});

describe('validatePayload (network / postMessage input)', () => {
  const { series, dd } = deriveForMc(gissar, 0, 0);
  const good = () => JSON.parse(JSON.stringify(buildSeasonTables(series, dd, opt)));
  it.each([
    ['null', () => null],
    ['wrong format', (p: ReturnType<typeof good>) => { p.format = 'x'; return p; }],
    ['NaN in a season vector', (p: ReturnType<typeof good>) => { p.rotations[0].plantings[0].bySowYear['2005'][0] = 'NaN'; return p; }],
    ['missing year entry', (p: ReturnType<typeof good>) => { delete p.rotations[1].plantings[0].bySowYear['2010']; return p; }],
    ['duplicate rotation', (p: ReturnType<typeof good>) => { p.rotations[2].id = 'baseline'; return p; }],
    ['huge cycle', (p: ReturnType<typeof good>) => { p.rotations[0].cycleYears = 99; return p; }],
    ['prototype pollution table', (p: ReturnType<typeof good>) => { p.rotations[0].plantings[0].bySowYear = JSON.parse('{"__proto__": {"polluted": true}}'); return p; }],
    ['absurd years', (p: ReturnType<typeof good>) => { p.years = [1, 2, 3]; return p; }],
  ])('rejects %s', (_l, mutate) => {
    expect(() => validatePayload(mutate(good()))).toThrow(McPayloadError);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('rejects run counts and seeds outside limits', () => {
    const p = validatePayload(good());
    expect(() => runBatch(p, 0, 1)).toThrow(McPayloadError);
    expect(() => runBatch(p, 10_000, 1)).toThrow(McPayloadError);
    expect(() => runBatch(p, 10, -1)).toThrow(McPayloadError);
  });
  it('format constant is stable', () => expect(MC_FORMAT).toBe('fihrist-mc-v1'));
});

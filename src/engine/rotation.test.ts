import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveDaily, type DailySeries } from './climate';
import { rotationDefs, simulateRotation } from './rotation';
import { rankRotations, type PriorityKey } from './ranking';
import { CROPS } from './crops';
import { seasonLength } from './kc';
import { YM } from './params';

const load = (id: string): DailySeries => JSON.parse(readFileSync(join(__dirname, '../../public/data/presets', `${id}.json`), 'utf8')).series;
const gissar = load('gissar');
const dd = deriveDaily(gissar);

describe('rotation calendars', () => {
  it.each(['wheat', 'wheatCotton'] as const)('no two plantings overlap within or across cycles (%s baseline)', (b) => {
    for (const def of Object.values(rotationDefs(b))) {
      // lay three cycles on a day line starting 2001-01-01 and check for overlaps
      const occupied = new Map<number, string>();
      for (let c = 0; c < 3; c++) {
        for (const p of def.plantings) {
          const start = Date.UTC(2001 + c * def.cycleYears + p.yearOffset, p.plant[0] - 1, p.plant[1]) / 864e5;
          const len = p.lengthDays ?? seasonLength(p.crop === 'cover' ? CROPS.wheat : CROPS[p.crop]);
          for (let d = 0; d < len; d++) {
            expect(occupied.get(start + d), `${def.id}: ${p.crop} overlaps ${occupied.get(start + d)}`).toBeUndefined();
            occupied.set(start + d, p.crop);
          }
        }
      }
    }
  });
});

describe('simulateRotation on real Gissar data', () => {
  const defs = rotationDefs('wheat');
  const irrigated = simulateRotation(gissar, dd, defs.baseline, { irrigation: 'canal', region: 'centralAsia' });
  const rainfed = simulateRotation(gissar, dd, defs.baseline, { irrigation: 'rainfed', region: 'centralAsia' });

  it('reports 10 harvest years 2015–2024', () => {
    expect(irrigated.years.map((y) => y.year)).toEqual([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
  });
  it('irrigated crops reach the reference yield; rainfed never exceed it', () => {
    for (const s of irrigated.seasons) expect(s.yieldT).toBeCloseTo(YM.centralAsia.wheat.value, 6);
    for (const s of rainfed.seasons) {
      expect(s.yieldT).toBeLessThanOrEqual(YM.centralAsia.wheat.value + 1e-9);
      expect(s.yieldT).toBeGreaterThanOrEqual(0);
      expect(s.eta).toBeLessThanOrEqual(s.etc + 1e-9);
    }
  });
  it('gross irrigation = net / efficiency (canal 0.5)', () => {
    const y = irrigated.years[0];
    expect(y.grossIrrigationM3).toBeCloseTo(y.netIrrigationM3 / 0.5, 6);
  });
  it('people fed follows kcal / (2200·365)', () => {
    const y = irrigated.years[0];
    expect(y.peopleFed).toBeCloseTo(y.kcal / (2200 * 365), 9);
    // 4 t wheat × 3270 kcal/kg = 13.08 Mkcal → 16.29 people
    expect(y.peopleFed).toBeCloseTo((4000 * 3270) / (2200 * 365), 6);
  });
  it('legumes reduce the nitrogen debt', () => {
    const ws = simulateRotation(gissar, dd, defs.waterSaving, { irrigation: 'canal', region: 'centralAsia' });
    expect(ws.mean.nFixedKg).toBeGreaterThan(0);
    expect(irrigated.mean.nFixedKg).toBe(0);
    expect(ws.mean.nFixedKg - ws.mean.nRemovedKg).toBeGreaterThan(irrigated.mean.nFixedKg - irrigated.mean.nRemovedKg);
  });
  it('irrigated P10–P90 has no spurious spread from the rotation cycle phase', () => {
    for (const id of ['baseline', 'waterSaving', 'regenerative'] as const) {
      const r = simulateRotation(gissar, dd, defs[id], { irrigation: 'canal', region: 'centralAsia' });
      expect(r.peopleFedP.p90 - r.peopleFedP.p10, id).toBeLessThan(1e-9);
    }
  });
  it('rainfed P10–P90 reflects weather (a real spread)', () => {
    expect(rainfed.peopleFedP.p90).toBeGreaterThan(rainfed.peopleFedP.p10);
  });
  it('days are either bare or covered', () => {
    for (const y of irrigated.years) expect(y.bareDays + y.livingRootDays).toBe(new Date(Date.UTC(y.year, 1, 29)).getUTCMonth() === 1 ? 366 : 365);
  });
});

describe('rankRotations', () => {
  const defs = rotationDefs('wheat');
  const res = (['baseline', 'waterSaving', 'regenerative'] as const).map((r) => simulateRotation(gissar, dd, defs[r], { irrigation: 'canal', region: 'centralAsia' }));
  const zero: Record<PriorityKey, number> = { water: 0, nitrogen: 0, erosion: 0, organic: 0, forage: 0, income: 0 };

  it('ranks are a permutation of 1..3', () => {
    const r = rankRotations(res, { ...zero, water: 50, income: 50 }, 'canal');
    expect(r.map((x) => x.rank).sort()).toEqual([1, 2, 3]);
  });
  it('water-only priority puts the lowest-water rotation first', () => {
    const r = rankRotations(res, { ...zero, water: 100 }, 'canal');
    const best = res.reduce((a, b) => (a.mean.grossIrrigationM3 <= b.mean.grossIrrigationM3 ? a : b));
    expect(r.find((x) => x.rank === 1)!.id).toBe(best.id);
  });
  it('income-only priority puts the highest true-profit rotation first', () => {
    const r = rankRotations(res, { ...zero, income: 100 }, 'canal');
    const best = res.reduce((a, b) => (a.mean.trueProfitUsd >= b.mean.trueProfitUsd ? a : b));
    expect(r.find((x) => x.rank === 1)!.id).toBe(best.id);
  });
  it('all-zero weights give neutral scores without NaN', () => {
    const r = rankRotations(res, zero, 'canal');
    expect(r.every((x) => x.score === 0.5)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveDaily, type DailySeries } from './climate';
import { ROOT, SOIL, waterWindow } from './soilwater';
import { rotationDefs, simulateRotation } from './rotation';

const load = (id: string): DailySeries => JSON.parse(readFileSync(join(__dirname, '../../public/data/presets', `${id}.json`), 'utf8')).series;

/** constant synthetic weather: n days, given daily rain and ET0-driving values */
function flat(n: number, prcp: (i: number) => number): DailySeries {
  return { lat: 38, lon: 68, elevation: 500, start: '2010-01-01', tmax: Array(n).fill(30), tmin: Array(n).fill(15), prcp: Array.from({ length: n }, (_, i) => prcp(i)), rs: Array(n).fill(25), u2: Array(n).fill(2), rh: Array(n).fill(40) };
}

describe('FAO-56 ch. 8 root-zone water balance', () => {
  it('TAW follows Eq. 82 with Table 19 / Table 22 values', () => {
    expect(1000 * SOIL.loam.awc.value * ROOT.wheat.zr.value).toBeCloseTo(255.75, 2);
    expect(SOIL.sand.awc.value).toBeLessThan(SOIL.loam.awc.value);
  });
  it('closes the water balance: start storage + rain + irrigation = ET + drainage + end storage', () => {
    const s = flat(400, (i) => (i % 9 === 0 ? 22 : 0));
    const dd = deriveDaily(s);
    for (const irrigated of [false, true]) {
      const w = waterWindow(s, dd, 'wheat', 0, 120, 240, irrigated, 'loam', 0.3);
      const taw = 1000 * SOIL.loam.awc.value * ROOT.wheat.zr.value;
      const inflow = w.fallowRain + w.rain + w.netIrrigation;
      const outflow = w.fallowEvap + w.eta + w.deepPerc;
      const storageGain = (0.3 - w.endDepletion) * taw; // less depletion at the end = more water stored
      expect(inflow - outflow).toBeCloseTo(storageGain, 6);
    }
  });
  it('no rain and no irrigation → the crop runs out of water (ETa < ETc); irrigated never stressed', () => {
    const s = flat(300, () => 0);
    const dd = deriveDaily(s);
    const dry = waterWindow(s, dd, 'wheat', 0, 0, 240, false, 'loam', 0);
    expect(dry.eta).toBeLessThan(dry.etc * 0.7);
    expect(dry.endDepletion).toBeGreaterThan(0.9);
    const wet = waterWindow(s, dd, 'wheat', 0, 0, 240, true, 'loam', 0);
    expect(wet.eta).toBeCloseTo(wet.etc, 6);
    expect(wet.netIrrigation).toBeGreaterThan(0);
  });
  it('a full profile at sowing carries the crop further than an empty one (fallow storage matters)', () => {
    const s = flat(300, () => 0);
    const dd = deriveDaily(s);
    const full = waterWindow(s, dd, 'wheat', 0, 0, 240, false, 'loam', 0);
    const empty = waterWindow(s, dd, 'wheat', 0, 0, 240, false, 'loam', 1);
    expect(full.eta - empty.eta).toBeCloseTo(1000 * SOIL.loam.awc.value * ROOT.wheat.zr.value, -1);
  });
  it('sand stores less than loam: from a full profile without rain, the crop on sand runs dry first', () => {
    const s = flat(200, () => 0);
    const dd = deriveDaily(s);
    const sand = waterWindow(s, dd, 'sorghum', 0, 0, 130, false, 'sand', 0);
    const loam = waterWindow(s, dd, 'sorghum', 0, 0, 130, false, 'loam', 0);
    expect(sand.eta).toBeLessThan(loam.eta);
  });
});

describe('soil water in the rotation results', () => {
  it('rainfed Kansas wheat yields rise once stored fallow water counts, and stay below Ym', () => {
    const s = load('kansas');
    const dd = deriveDaily(s);
    const r = simulateRotation(s, dd, rotationDefs('wheat').baseline, { irrigation: 'rainfed', region: 'kansas', soil: 'loam' });
    const wheat = r.seasons.filter((x) => x.crop === 'wheat').map((x) => x.yieldT);
    const mean = wheat.reduce((a, b) => a + b, 0) / wheat.length;
    expect(mean).toBeGreaterThan(1.5);
    expect(Math.max(...wheat)).toBeLessThanOrEqual(3.3 + 1e-9);
  });
  it('every planting has an antecedent soil state in [0, 1]', () => {
    const s = load('gissar');
    const dd = deriveDaily(s);
    for (const def of Object.values(rotationDefs('wheat'))) {
      const r = simulateRotation(s, dd, def, { irrigation: 'rainfed', region: 'centralAsia' });
      expect(r.antecedent).toHaveLength(def.plantings.length);
      for (const a of r.antecedent) { expect(a.dr0).toBeGreaterThanOrEqual(0); expect(a.dr0).toBeLessThanOrEqual(1); expect(a.gapDays).toBeGreaterThanOrEqual(0); }
    }
  });
});

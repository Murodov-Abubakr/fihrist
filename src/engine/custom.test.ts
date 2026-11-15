import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveDaily, type DailySeries } from './climate';
import { customDef, parseCustom, rotationDefs, simulateRotation, type CustomRotation } from './rotation';
import { buildSeasonTables, runBatch, summarize } from './montecarlo';

const gissar: DailySeries = JSON.parse(readFileSync(join(__dirname, '../../public/data/presets/gissar.json'), 'utf8')).series;
const dd = deriveDaily(gissar);
const c = (years: CustomRotation['years']): CustomRotation => ({ kind: 'custom', years });

describe("farmer-defined baseline ('my own rotation')", () => {
  it('continuous wheat entered by hand gives exactly the preset baseline result', () => {
    const def = customDef(c([{ spring: null, autumn: 'wheat' }]));
    expect('plantings' in def).toBe(true);
    if (!('plantings' in def)) return;
    const a = simulateRotation(gissar, dd, def, { irrigation: 'canal', region: 'centralAsia' });
    const b = simulateRotation(gissar, dd, rotationDefs('wheat').baseline, { irrigation: 'canal', region: 'centralAsia' });
    expect(a.mean.peopleFed).toBeCloseTo(b.mean.peopleFed, 9);
    expect(a.mean.grossIrrigationM3).toBeCloseTo(b.mean.grossIrrigationM3, 9);
  });
  it('wheat–cotton entered by hand matches the preset (wheat sown 1 Nov after cotton)', () => {
    const def = customDef(c([{ spring: 'cotton', autumn: 'wheat' }, { spring: null, autumn: null }]));
    if (!('plantings' in def)) throw new Error('expected a valid rotation');
    const a = simulateRotation(gissar, dd, def, { irrigation: 'canal', region: 'centralAsia' });
    const b = simulateRotation(gissar, dd, rotationDefs('wheatCotton').baseline, { irrigation: 'canal', region: 'centralAsia' });
    expect(a.mean.trueProfitUsd).toBeCloseTo(b.mean.trueProfitUsd, 6);
  });
  it('explains an impossible calendar: chickpea in March while last autumn’s wheat is still growing', () => {
    const r = customDef(c([{ spring: null, autumn: 'wheat' }, { spring: 'chickpea', autumn: null }]));
    expect(r).toEqual({ kind: 'overlap', first: 'wheat', firstYear: 1, second: 'chickpea', secondYear: 2 });
  });
  it('allows mung bean straight after the wheat harvest (20 June)', () => {
    const r = customDef(c([{ spring: null, autumn: 'wheat' }, { spring: 'mung', autumn: null }]));
    expect('plantings' in r).toBe(true);
  });
  it('rejects a cycle with nothing to harvest', () => {
    expect(customDef(c([{ spring: null, autumn: 'cover' }]))).toEqual({ kind: 'empty' });
    expect(customDef(c([{ spring: null, autumn: null }]))).toEqual({ kind: 'empty' });
  });
  it.each([
    ['not an object', 'wheat'],
    ['wrong kind', { kind: 'preset', years: [] }],
    ['no years', { kind: 'custom', years: [] }],
    ['too many years', { kind: 'custom', years: Array(4).fill({ spring: null, autumn: 'wheat' }) }],
    ['unknown crop', { kind: 'custom', years: [{ spring: 'opium', autumn: null }] }],
    ['injection string', { kind: 'custom', years: [{ spring: '<img src=x onerror=alert(1)>', autumn: null }] }],
    ['prototype pollution', JSON.parse('{"kind":"custom","years":[{"__proto__":{"x":1},"spring":"cotton","autumn":null}]}')],
  ])('parseCustom rejects %s', (label, x) => {
    const r = parseCustom(x);
    if (label === 'prototype pollution') { expect(r?.years[0]).toEqual({ spring: 'cotton', autumn: null }); expect(({} as Record<string, unknown>).x).toBeUndefined(); }
    else expect(r).toBeNull();
  });
  it('an invalid custom rotation never reaches the model (falls back to continuous wheat)', () => {
    const defs = rotationDefs(c([{ spring: null, autumn: 'wheat' }, { spring: 'chickpea', autumn: null }]));
    expect(defs.baseline.plantings).toEqual(rotationDefs('wheat').baseline.plantings);
  });
  it('the Monte Carlo runs with a 3-year farmer cycle', () => {
    const custom = c([{ spring: 'sorghum', autumn: 'wheat' }, { spring: 'mung', autumn: 'cover' }, { spring: 'cotton', autumn: null }]);
    expect('plantings' in customDef(custom)).toBe(true);
    const payload = buildSeasonTables(gissar, dd, { irrigation: 'canal', region: 'centralAsia', baseline: custom });
    const s = summarize([runBatch(payload, 200, 3)]);
    expect(s.baseline.peopleFed.p50).toBeGreaterThan(0);
  });
});

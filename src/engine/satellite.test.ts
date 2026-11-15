import { describe, expect, it } from 'vitest';
import type { DailySeries } from './climate';
import { monthlyNdvi, monthlyWetness, SatError, validateSat } from './satellite';
import { stressCalendar } from './stress';

/** 15 synthetic years; July normally warm, wet-ish soil, green crops. Two planted anomalies:
 *  2009 July: everything stressed (heat, dry, soil, vegetation) → compound
 *  2012 July: weather and soil normal, vegetation collapsed → "unexplained vegetation stress"
 *  2014 July: dry and soil-dry but vegetation normal → "green despite drought" */
function synthetic() {
  const start = Date.UTC(2001, 0, 1), end = Date.UTC(2016, 0, 1);
  const s: DailySeries = { lat: 38, lon: 68, elevation: 800, start: '2001-01-01', tmax: [], tmin: [], prcp: [], rs: [], u2: [], rh: [] };
  for (let t = start; t < end; t += 864e5) {
    const d = new Date(t); const y = d.getUTCFullYear(); const m = d.getUTCMonth() + 1;
    const odd = (y % 3) * 0.2 - 0.2;
    let tmax = m === 7 ? 33 + odd : 15 + odd;
    let prcp = m === 7 ? 1.2 + odd * 0.5 : 0.2;
    if ((y === 2009 || y === 2014) && m === 7) { prcp = 0; }
    if (y === 2009 && m === 7) tmax = 38;
    s.tmax.push(tmax); s.tmin.push(5); s.prcp.push(prcp); s.rs.push(20); s.u2.push(2); s.rh.push(50);
  }
  const ndvi = new Map<string, number>(); const wet = new Map<string, number>();
  for (let y = 2001; y <= 2015; y++) for (let m = 1; m <= 12; m++) {
    const odd = ((y % 3) - 1) * 0.01;
    ndvi.set(`${y}-${m}`, (m >= 5 && m <= 9 ? 0.6 : 0.15) + odd);
    wet.set(`${y}-${m}`, 0.5 + odd);
  }
  ndvi.set('2009-7', 0.3); wet.set('2009-7', 0.2);
  ndvi.set('2012-7', 0.25);
  wet.set('2014-7', 0.2); // ndvi stays normal (0.6 + odd)
  return { s, ndvi, wet };
}

describe('Fihrist compound stress index — 4 signals', () => {
  const { s, ndvi, wet } = synthetic();
  const r = stressCalendar(s, { ndvi, wetness: wet });
  it('uses all four signals when the satellite layers are present', () => {
    expect(r.signalsUsed).toEqual(['heat', 'dry', 'soil', 'veg']);
    expect(r.months[6].defined).toEqual({ heat: true, dry: true, soil: true, veg: true });
  });
  it('vegetation is undefined in months without crops (NDVI below 0.2)', () => {
    expect(r.months[0].defined.veg).toBe(false);
  });
  it('flags the month where all four signals are abnormal', () => {
    const e = r.events.find((x) => x.year === 2009 && x.month === 7);
    expect(e?.abnormal.sort()).toEqual(['dry', 'heat', 'soil', 'veg']);
  });
  it('decoupling detector: vegetation collapse with normal weather is "unexplained"', () => {
    expect(r.decoupled.find((x) => x.year === 2012 && x.month === 7)?.kind).toBe('unexplained');
    expect(r.events.some((x) => x.year === 2012)).toBe(false); // not a compound-stress month
  });
  it('decoupling detector: dry month with normal vegetation is "buffered" (green despite drought)', () => {
    expect(r.decoupled.find((x) => x.year === 2014 && x.month === 7)?.kind).toBe('buffered');
  });
  it('without satellite layers the index falls back to the 2 weather signals (unchanged behaviour)', () => {
    const w = stressCalendar(s);
    expect(w.signalsUsed).toEqual(['heat', 'dry']);
    expect(w.decoupled).toHaveLength(0);
  });
});

describe('decoupling detector: vegetation stress after a cold spell', () => {
  // Same synthetic years, plus a varying February minimum temperature (cold matters: mean ≤ 5 °C),
  // a very cold February 2011, and spring crops (April NDVI 0.5) that are far less green in April 2011.
  const { s, ndvi, wet } = synthetic();
  const start = Date.UTC(2001, 0, 1);
  s.tmin = s.tmin.map((v, i) => {
    const d = new Date(start + i * 864e5); const y = d.getUTCFullYear(); const m = d.getUTCMonth() + 1;
    if (m !== 2) return v;
    return y === 2011 ? -8 : -1 + ((y % 3) - 1) * 0.5;
  });
  for (let y = 2001; y <= 2015; y++) ndvi.set(`${y}-4`, 0.5 + ((y % 3) - 1) * 0.01);
  ndvi.set('2011-4', 0.2);
  const r = stressCalendar(s, { ndvi, wetness: wet });
  it('classifies the April collapse as "after a cold spell" and names the cold month', () => {
    const e = r.decoupled.find((x) => x.year === 2011 && x.month === 4);
    expect(e?.kind).toBe('afterCold');
    expect(e?.cold).toMatchObject({ year: 2011, month: 2 });
    expect(e!.cold!.z).toBeGreaterThan(1);
  });
  it('leaves a collapse with no preceding cold as "unexplained"', () => {
    expect(r.decoupled.find((x) => x.year === 2012 && x.month === 7)?.kind).toBe('unexplained');
  });
  it('does not change the 4-signal compound index', () => {
    const base = synthetic();
    const r0 = stressCalendar(base.s, { ndvi: base.ndvi, wetness: base.wet });
    expect(r.events.filter((e) => e.month !== 4).map((e) => `${e.year}-${e.month}`)).toEqual(r0.events.filter((e) => e.month !== 4).map((e) => `${e.year}-${e.month}`));
  });
});

describe('satellite file validation (untrusted input)', () => {
  const good = {
    format: 'fihrist-sat-v1', id: 'kansas', lat: 38.8, lon: -99.3, createdAt: '2026-11-15',
    layers: {
      ndvi: { composites: [{ date: '2015-07-12', ndvi: 0.61, pixels: 300 }, { date: '2015-07-28', ndvi: null, pixels: 0 }], landCoverItem: 'ESA_WorldCover_10m_2021_v200_N36W102', croplandShare: 0.66, radiusKm: 5 },
      wetness: [{ y: 2015, m: 7, root: 0.41, top: 0.3 }],
      slope: { item: 'NASADEM_HGT_n38w100', elevationM: 621, meanSlopeDeg: 1.3, maxSlopeDeg: 3.1, windowM: 361 },
    },
    gaps: [],
  };
  it('accepts a well-formed file and aggregates months', () => {
    const v = validateSat(good, 'kansas');
    expect(monthlyNdvi(v.layers.ndvi!.composites).get('2015-7')).toBeCloseTo(0.61);
    expect(monthlyWetness(v.layers.wetness!).get('2015-7')).toBe(0.41);
  });
  it.each([
    ['wrong format', { ...good, format: 'x' }],
    ['wrong preset id', good, 'gissar'],
    ['NDVI out of range', { ...good, layers: { ...good.layers, ndvi: { ...good.layers.ndvi, composites: [{ date: '2015-07-12', ndvi: 7, pixels: 1 }] } } }],
    ['bad date', { ...good, layers: { ...good.layers, ndvi: { ...good.layers.ndvi, composites: [{ date: '<script>', ndvi: 0.5, pixels: 1 }] } } }],
    ['wetness above 1', { ...good, layers: { ...good.layers, wetness: [{ y: 2015, m: 7, root: 1.5, top: 0.2 }] } }],
    ['negative slope', { ...good, layers: { ...good.layers, slope: { ...good.layers.slope, meanSlopeDeg: -3 } } }],
    ['HTML in item name', { ...good, layers: { ...good.layers, slope: { ...good.layers.slope, item: '<img src=x onerror=1>' } } }],
  ])('rejects %s', (_l, x, id?: string) => {
    expect(() => validateSat(x, id ?? 'kansas')).toThrow(SatError);
  });
});

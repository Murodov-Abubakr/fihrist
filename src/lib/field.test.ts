import { describe, expect, it } from 'vitest';
import { FIELD_MAX_HA, makeField, polygonAreaM2, polygonCentroid, type LonLat } from './field';

/** square of side `m` metres centred on (lat, lon), built in a local metric frame */
function square(lat: number, lon: number, m: number): LonLat[] {
  const dLat = (m / 2) / 111_195; // metres per degree latitude on the mean sphere
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  return [[lon - dLon, lat - dLat], [lon + dLon, lat - dLat], [lon + dLon, lat + dLat], [lon - dLon, lat + dLat]];
}

describe('field geometry', () => {
  it('a 100 m × 100 m square is 1 ha (within 0.5 %)', () => {
    expect(polygonAreaM2(square(38.56, 68.79, 100)) / 10_000).toBeCloseTo(1, 2);
    expect(polygonAreaM2(square(0, 0, 100)) / 10_000).toBeCloseTo(1, 2);
    expect(polygonAreaM2(square(60, -99, 100)) / 10_000).toBeCloseTo(1, 2);
  });
  it('area does not depend on winding direction', () => {
    const s = square(38.8, -99.3, 400);
    expect(polygonAreaM2([...s].reverse())).toBeCloseTo(polygonAreaM2(s), 6);
  });
  it('centroid of a square is its centre', () => {
    const c = polygonCentroid(square(37.83, 68.78, 500));
    expect(c.lat).toBeCloseTo(37.83, 6);
    expect(c.lon).toBeCloseTo(68.78, 6);
  });
  it('accepts a normal field', () => {
    const f = makeField(square(38.56, 68.79, 150));
    expect(typeof f).toBe('object');
    if (typeof f === 'object') expect(f.areaHa).toBeCloseTo(2.25, 1);
  });
  it.each([
    ['too few vertices', [[68, 38], [68.001, 38]], 'vertices'],
    ['not an array', 'POLYGON((0 0))', 'vertices'],
    ['NaN coordinate', [[68, 38], [NaN, 38], [68, 38.001]], 'coordinates'],
    ['string coordinate', [[68, 38], ['68.001', 38], [68, 38.001]], 'coordinates'],
    ['out-of-range latitude', [[68, 38], [68.001, 95], [68, 38.001]], 'coordinates'],
    ['antimeridian crossing', [[179.99, 10], [-179.99, 10], [-179.99, 10.01]], 'antimeridian'],
    ['a whole region', square(38, 68, 20_000), 'tooLarge'],
    ['a single point', [[68, 38], [68, 38], [68, 38]], 'tooSmall'],
  ])('rejects %s', (_l, ring, reason) => {
    expect(makeField(ring)).toBe(reason);
  });
  it('the size cap is a farm-scale number', () => {
    expect(FIELD_MAX_HA).toBe(5000);
    expect(makeField(Array.from({ length: 61 }, (_, i) => [68 + i * 1e-4, 38 + (i % 2) * 1e-4]))).toBe('vertices');
  });
});

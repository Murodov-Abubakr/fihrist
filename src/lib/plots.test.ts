import { describe, expect, it } from 'vitest';
import { areaXY, clipSlab, pointInPolygon, splitStrips, squareRing, toLocal, type XY } from './plots.ts';
import { polygonAreaM2, polygonCentroid } from './field.ts';

const square: XY[] = [[0, 0], [100, 0], [100, 100], [0, 100]];
const triangle: XY[] = [[0, 0], [300, 0], [0, 200]];

describe('plots', () => {
  it('clips a slab exactly', () => {
    expect(areaXY(clipSlab(square, 25, 75))).toBeCloseTo(5000, 6);
  });
  it('splits a square into equal strips that sum to the field', () => {
    const s = splitStrips(square, 4);
    expect(s).toHaveLength(4);
    for (const p of s) expect(p.areaHa).toBeCloseTo(0.25, 6);
  });
  it('splits a triangle into equal-area strips (not equal widths)', () => {
    const s = splitStrips(triangle, 3);
    const total = areaXY(triangle) / 10_000;
    for (const p of s) expect(p.areaHa).toBeCloseTo(total / 3, 4);
    expect(s.reduce((t, p) => t + p.areaHa, 0)).toBeCloseTo(total, 6);
  });
  it('clamps the plot count to 1..4', () => {
    expect(splitStrips(square, 0)).toHaveLength(1);
    expect(splitStrips(square, 9)).toHaveLength(4);
  });
  it('finds points inside a polygon', () => {
    expect(pointInPolygon([10, 10], triangle)).toBe(true);
    expect(pointInPolygon([250, 150], triangle)).toBe(false);
  });
  it('local projection keeps the spherical field area within 0.5 %', () => {
    const ring = squareRing({ lat: 38.56, lon: 68.79 }, 12);
    const c = polygonCentroid(ring);
    expect(areaXY(toLocal(ring, c)) / 10_000).toBeCloseTo(12, 1);
    expect(Math.abs(areaXY(toLocal(ring, c)) - polygonAreaM2(ring)) / polygonAreaM2(ring)).toBeLessThan(0.005);
  });
});

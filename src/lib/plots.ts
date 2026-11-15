/**
 * Splitting an outlined field into plots (strips) for the 3D field view.
 *
 * The field ring ([lon, lat]) is projected to local metres around its centroid (equirectangular; fine for
 * field-sized polygons, the same approximation as polygonCentroid). It is cut by vertical lines (east–west
 * position) into N strips of EQUAL AREA: each cut position is found by bisection on the clipped area.
 * Each strip is the field polygon clipped to a slab x0 ≤ x ≤ x1 (Sutherland–Hodgman, two half-planes).
 * Plot areas are reported from the clipped polygons, so they always sum to the field area.
 *
 * Whole-field results for a plot plan are the area-weighted sum of the per-hectare rotation results: the
 * engine simulates each rotation per hectare, and plots are treated as independent (no edge effects).
 */
import type { LonLat } from './field.ts';

export type XY = [number, number];
const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;
export const MAX_PLOTS = 4;

export function toLocal(ring: LonLat[], center: { lat: number; lon: number }): XY[] {
  const k = Math.cos(rad(center.lat));
  return ring.map(([lon, lat]) => [rad(lon - center.lon) * R * k, rad(lat - center.lat) * R]);
}
export function toLonLat(p: XY, center: { lat: number; lon: number }): LonLat {
  const k = Math.cos(rad(center.lat));
  return [center.lon + (p[0] / (R * k)) * (180 / Math.PI), center.lat + (p[1] / R) * (180 / Math.PI)];
}

export function areaXY(poly: XY[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** Keep the part of the polygon where sign·x ≥ sign·c (one half-plane). */
function clipHalf(poly: XY[], c: number, sign: 1 | -1): XY[] {
  const out: XY[] = [];
  const inside = (p: XY) => sign * p[0] >= sign * c;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (c - a[0]) / (b[0] - a[0]);
      out.push([c, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}
export const clipSlab = (poly: XY[], x0: number, x1: number): XY[] => clipHalf(clipHalf(poly, x0, 1), x1, -1);

/** N equal-area strips (west → east). Returns polygons in local metres and their areas in hectares. */
export function splitStrips(poly: XY[], n: number): { poly: XY[]; areaHa: number }[] {
  const count = Math.max(1, Math.min(MAX_PLOTS, Math.floor(n)));
  const xs = poly.map((p) => p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const total = areaXY(poly);
  const cuts = [minX];
  for (let i = 1; i < count; i++) {
    const target = (total * i) / count;
    let lo = cuts[i - 1], hi = maxX;
    for (let k = 0; k < 50; k++) {
      const mid = (lo + hi) / 2;
      if (areaXY(clipSlab(poly, minX, mid)) < target) lo = mid; else hi = mid;
    }
    cuts.push((lo + hi) / 2);
  }
  cuts.push(maxX);
  return cuts.slice(0, -1).map((x0, i) => {
    const p = clipSlab(poly, x0, cuts[i + 1]);
    return { poly: p, areaHa: areaXY(p) / 10_000 };
  });
}

export function pointInPolygon(p: XY, poly: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Square of a given area centred on the point (used when no field was outlined). */
export function squareRing(center: { lat: number; lon: number }, areaHa: number): LonLat[] {
  const h = Math.sqrt(areaHa * 10_000) / 2;
  return ([[-h, -h], [h, -h], [h, h], [-h, h]] as XY[]).map((p) => toLonLat(p, center));
}

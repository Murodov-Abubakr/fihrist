/**
 * Field outline geometry. A field is a simple polygon of [lon, lat] vertices drawn by the user on the globe.
 *
 * Area: spherical polygon area, Chamberlain & Duquette (2007) "Some algorithms for polygons on a sphere",
 * JPL Publication 07-03: A = R² · |Σ (λ₂ − λ₁)(2 + sin φ₁ + sin φ₂)| / 2, with R = 6,371,008.8 m
 * (IUGG mean Earth radius). Accurate to well under 1 % for field-sized polygons.
 *
 * Security/robustness (OWASP A03/A04): only finite, in-range numbers; 3–60 vertices; no antimeridian
 * crossing; area capped (a "field" larger than FIELD_MAX_HA is rejected rather than silently analysed).
 */
import { isValidLatLon } from './geo.ts';

export type LonLat = [number, number];
export interface Field { ring: LonLat[]; areaHa: number; centroid: { lat: number; lon: number } }

export const FIELD_MIN_VERTICES = 3;
export const FIELD_MAX_VERTICES = 60;
export const FIELD_MAX_HA = 5000;
const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function polygonAreaM2(ring: LonLat[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [l1, p1] = ring[i];
    const [l2, p2] = ring[(i + 1) % ring.length];
    sum += rad(l2 - l1) * (2 + Math.sin(rad(p1)) + Math.sin(rad(p2)));
  }
  return Math.abs((sum * R * R) / 2);
}

/** Area-weighted centroid in a local equirectangular frame (fine for field-sized polygons). */
export function polygonCentroid(ring: LonLat[]): { lat: number; lon: number } {
  const lat0 = ring.reduce((t, p) => t + p[1], 0) / ring.length;
  const k = Math.cos(rad(lat0));
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = [ring[i][0] * k, ring[i][1]];
    const [x2, y2] = [ring[(i + 1) % ring.length][0] * k, ring[(i + 1) % ring.length][1]];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(a) < 1e-15) {
    return { lat: lat0, lon: ring.reduce((t, p) => t + p[0], 0) / ring.length };
  }
  return { lat: cy / (3 * a), lon: cx / (3 * a) / k };
}

export type FieldError = 'vertices' | 'coordinates' | 'antimeridian' | 'tooLarge' | 'tooSmall';

/** Validates a drawn ring and returns the field, or the reason it was rejected. */
export function makeField(ring: unknown): Field | FieldError {
  if (!Array.isArray(ring) || ring.length < FIELD_MIN_VERTICES || ring.length > FIELD_MAX_VERTICES) return 'vertices';
  const pts: LonLat[] = [];
  for (const p of ring) {
    if (!Array.isArray(p) || p.length !== 2) return 'coordinates';
    const [lon, lat] = p as unknown[];
    if (typeof lon !== 'number' || typeof lat !== 'number' || !isValidLatLon(lat, lon)) return 'coordinates';
    pts.push([lon, lat]);
  }
  const lons = pts.map((p) => p[0]);
  if (Math.max(...lons) - Math.min(...lons) > 180) return 'antimeridian';
  const areaHa = polygonAreaM2(pts) / 10_000;
  if (areaHa > FIELD_MAX_HA) return 'tooLarge';
  if (areaHa < 0.01) return 'tooSmall';
  return { ring: pts, areaHa, centroid: polygonCentroid(pts) };
}

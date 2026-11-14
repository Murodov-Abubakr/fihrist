/** Coordinate sanitisation shared by the map, URL/state handling and the NASA client (OWASP A03/A08). */

const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

/** Clamp latitude to [-90, 90]; NaN/Infinity → 0. Rounded to 4 dp (~11 m). */
export function clampLat(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return round4(Math.min(90, Math.max(-90, v)));
}

/** Wrap any longitude into [-180, 180); NaN/Infinity → 0. Rounded to 4 dp. */
export function wrapLon(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const w = ((((v + 180) % 360) + 360) % 360) - 180;
  return round4(w);
}

/** Strict validator for externally supplied coordinates: rejects instead of coercing. */
export function isValidLatLon(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === 'number' && typeof lon === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  );
}

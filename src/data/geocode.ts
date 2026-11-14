/**
 * Place search (search-as-you-type) via Photon, an OpenStreetMap-based geocoder built for
 * autocomplete (https://photon.komoot.io). Nominatim is not used: its usage policy forbids
 * client-side autocomplete. Data © OpenStreetMap contributors (ODbL) — attribution shown in the UI.
 *
 * Security / privacy (OWASP A03/A04/A08/A10):
 *  - fixed https host, fixed parameters; the typed text is the only user input and is URL-encoded
 *  - only the query text is sent (no coordinates, no cookies, no referrer)
 *  - ≥ 3 characters, caller debounces and aborts stale requests; 6 s timeout; response size cap
 *  - every feature validated (Point geometry, finite in-range coordinates, string fields capped)
 *  - results are rendered as plain text by React (never as HTML)
 */
import { isValidLatLon, wrapLon, clampLat } from '../lib/geo.ts';

export const GEOCODER_HOST = 'photon.komoot.io';
export const GEOCODE_TIMEOUT_MS = 6000;
export const GEOCODE_MAX_BYTES = 200_000;
export const MAX_RESULTS = 5;
const MAX_QUERY = 100;
const MAX_FIELD = 80;

export interface Place {
  name: string;
  detail: string; // region, country
  kind: string; // OSM value, e.g. city, village
  lat: number;
  lon: number;
}

export class GeocodeError extends Error {}

/**
 * Accepts "38.56, 68.79", "38.56 68.79" or "38.56N 68.79E" / "38.8 N, 99.3 W".
 * Returns null if the text is not a coordinate pair.
 */
export function parseCoordinates(text: string): { lat: number; lon: number } | null {
  const m = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*°?\s*([NS])?\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([EW])?$/i);
  if (!m) return null;
  let lat = Number(m[1]);
  let lon = Number(m[3]);
  if (m[2]?.toUpperCase() === 'S') lat = -Math.abs(lat);
  if (m[4]?.toUpperCase() === 'W') lon = -Math.abs(lon);
  return isValidLatLon(lat, lon) ? { lat: clampLat(lat), lon: wrapLon(lon) } : null;
}

/** Photon supports only a few languages; others get local names ("default"). */
export const photonLang = (appLang: string) => (appLang === 'en' ? 'en' : 'default');

export function buildGeocodeUrl(query: string, appLang: string): URL {
  const q = query.trim().slice(0, MAX_QUERY);
  if (q.length < 3) throw new GeocodeError('query too short');
  const u = new URL(`https://${GEOCODER_HOST}/api/`);
  u.searchParams.set('q', q);
  u.searchParams.set('limit', String(MAX_RESULTS));
  u.searchParams.set('lang', photonLang(appLang));
  return u;
}

const str = (v: unknown) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').slice(0, MAX_FIELD) : '');

/** Validates a Photon GeoJSON response into at most MAX_RESULTS places. */
export function parsePhotonResponse(json: unknown): Place[] {
  const feats = (json as { features?: unknown })?.features;
  if (!Array.isArray(feats)) throw new GeocodeError('unexpected geocoder response');
  const out: Place[] = [];
  const seen = new Set<string>();
  for (const f of feats.slice(0, 20)) {
    const g = (f as { geometry?: { type?: unknown; coordinates?: unknown } })?.geometry;
    const p = (f as { properties?: Record<string, unknown> })?.properties ?? {};
    if (g?.type !== 'Point' || !Array.isArray(g.coordinates) || g.coordinates.length < 2) continue;
    const [lon, lat] = g.coordinates as unknown[];
    if (!isValidLatLon(lat, lon)) continue;
    const name = str(p.name);
    if (!name) continue;
    const detail = [str(p.city) !== name ? str(p.city) : '', str(p.county), str(p.state), str(p.country)].filter(Boolean).join(', ');
    // same name + area within ~0.1° = the same place (e.g. a town and its boundary as two OSM objects)
    const key = `${name}|${detail}|${(lat as number).toFixed(1)}|${(lon as number).toFixed(1)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, detail, kind: str(p.osm_value), lat: clampLat(lat as number), lon: wrapLon(lon as number) });
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}

export async function searchPlaces(query: string, appLang: string, signal?: AbortSignal): Promise<Place[]> {
  const url = buildGeocodeUrl(query, appLang);
  if (url.hostname !== GEOCODER_HOST || url.protocol !== 'https:') throw new GeocodeError('blocked host');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GEOCODE_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new GeocodeError(`geocoder responded ${res.status}`);
    const text = await res.text();
    if (text.length > GEOCODE_MAX_BYTES) throw new GeocodeError('response too large');
    return parsePhotonResponse(JSON.parse(text));
  } catch (e) {
    if (e instanceof GeocodeError) throw e;
    if ((e as Error).name === 'AbortError') throw new GeocodeError(signal?.aborted ? 'aborted' : 'timeout');
    throw new GeocodeError('geocoder unreachable');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

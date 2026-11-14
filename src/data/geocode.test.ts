/** Place search: coordinate parsing, URL building and hostile/malformed geocoder responses. */
import { describe, expect, it } from 'vitest';
import { buildGeocodeUrl, GEOCODER_HOST, GeocodeError, parseCoordinates, parsePhotonResponse, photonLang } from './geocode';

describe('parseCoordinates', () => {
  it.each([
    ['38.56, 68.79', 38.56, 68.79],
    ['38.56 68.79', 38.56, 68.79],
    ['38.8 N, 99.3 W', 38.8, -99.3],
    ['-20.5; 130', -20.5, 130],
    ['38.8°N 99.3°W', 38.8, -99.3],
  ])('parses %s', (text, lat, lon) => {
    expect(parseCoordinates(text)).toEqual({ lat, lon });
  });
  it.each(['Dushanbe', '91, 10', '10, 181', '38.5', '', '1e3, 2', '38.5, 68.7; DROP TABLE'])('rejects %s', (text) => {
    expect(parseCoordinates(text)).toBeNull();
  });
});

describe('buildGeocodeUrl', () => {
  it('uses the fixed https host and URL-encodes the query', () => {
    const u = buildGeocodeUrl('Hisor & <script>', 'ru');
    expect(u.protocol).toBe('https:');
    expect(u.hostname).toBe(GEOCODER_HOST);
    expect(u.searchParams.get('q')).toBe('Hisor & <script>');
    expect(u.search).not.toContain('<script>'); // encoded on the wire
    expect(u.searchParams.get('lang')).toBe('default');
  });
  it('rejects too-short queries and caps long ones', () => {
    expect(() => buildGeocodeUrl('ab', 'en')).toThrow(GeocodeError);
    expect(buildGeocodeUrl('x'.repeat(500), 'en').searchParams.get('q')).toHaveLength(100);
  });
  it('maps app languages to languages Photon accepts', () => {
    expect(photonLang('en')).toBe('en');
    expect(photonLang('ru')).toBe('default');
    expect(photonLang('tg')).toBe('default');
  });
});

describe('parsePhotonResponse', () => {
  const feat = (lon: unknown, lat: unknown, props: Record<string, unknown> = {}) => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { name: 'Hisor', state: 'RRS', country: 'Tajikistan', osm_value: 'city', ...props },
  });
  it('keeps valid places with name, detail and coordinates', () => {
    const r = parsePhotonResponse({ features: [feat(68.558, 38.53)] });
    expect(r).toEqual([{ name: 'Hisor', detail: 'RRS, Tajikistan', kind: 'city', lat: 38.53, lon: 68.558 }]);
  });
  it('drops features with bad geometry or coordinates', () => {
    const r = parsePhotonResponse({ features: [
      feat(200, 10), feat(10, 95), feat('68', '38'), feat(NaN, 1),
      { geometry: { type: 'Polygon', coordinates: [[0, 0]] }, properties: { name: 'x' } }, null, 'junk',
    ] });
    expect(r).toEqual([]);
  });
  it('keeps hostile names as inert text, strips control chars and caps length', () => {
    const [p] = parsePhotonResponse({ features: [feat(68, 38, { name: '<img src=x onerror=alert(1)>\u0000' + 'a'.repeat(200) })] });
    expect(p.name.startsWith('<img src=x onerror=alert(1)>')).toBe(true); // rendered by React as text
    expect(p.name).not.toContain('\u0000');
    expect(p.name.length).toBeLessThanOrEqual(80);
  });
  it('limits results and removes duplicates', () => {
    const many = Array.from({ length: 30 }, (_, i) => feat(60 + i * 0.1, 38, { name: `P${i}` }));
    expect(parsePhotonResponse({ features: many })).toHaveLength(5);
    expect(parsePhotonResponse({ features: [feat(68, 38), feat(68, 38)] })).toHaveLength(1);
  });
  it.each([null, {}, { features: 'x' }, []])('rejects malformed payload %j', (j) => {
    expect(() => parsePhotonResponse(j)).toThrow(GeocodeError);
  });
});

/** NASA POWER client: URL building (SSRF/injection) and parsing of honest vs poisoned payloads (A08). */
import { describe, expect, it } from 'vitest';
import { buildPowerUrl, parsePowerCsv, PowerDataError, validateSeries, POWER_HOST } from './power';
import type { DailySeries } from '../engine/climate';

const HEADER = `-BEGIN HEADER-
NASA/POWER Source Native Resolution Daily Data
elevation from MERRA-2: Average for 0.5 x 0.625 degree lat/lon region = 1326.72 meters
-END HEADER-
YEAR,DOY,T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS2M,RH2M`;

function csv(rows: string[]) {
  return `${HEADER}\n${rows.join('\n')}\n`;
}
function goodRows(n = 400, y = 2023): string[] {
  const out: string[] = [];
  let year = y;
  let doy = 1;
  for (let i = 0; i < n; i++) {
    out.push(`${year},${doy},20.5,8.1,0.4,18.2,1.6,45.0`);
    const days = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
    doy++;
    if (doy > days) { doy = 1; year++; }
  }
  return out;
}
const loc = { lat: 38.5598, lon: 68.787 };

describe('buildPowerUrl', () => {
  it('builds a fixed-host https URL with only validated numbers', () => {
    const u = buildPowerUrl(38.5598, 68.787);
    expect(u.protocol).toBe('https:');
    expect(u.hostname).toBe(POWER_HOST);
    expect(u.searchParams.get('community')).toBe('AG');
    expect(u.searchParams.get('format')).toBe('CSV');
    expect(u.searchParams.get('latitude')).toBe('38.5598');
  });
  it.each([
    [91, 0], [0, 181], [NaN, 0], [0, Infinity],
    ['38.5&url=http://169.254.169.254' as unknown as number, 0],
    ['<script>' as unknown as number, 0],
  ])('rejects bad coordinates %s,%s', (lat, lon) => {
    expect(() => buildPowerUrl(lat, lon)).toThrow(PowerDataError);
  });
  it('rejects absurd year ranges', () => {
    expect(() => buildPowerUrl(0, 0, 2024, 2001)).toThrow(PowerDataError);
    expect(() => buildPowerUrl(0, 0, 1900, 2001)).toThrow(PowerDataError);
  });
});

describe('parsePowerCsv', () => {
  it('parses a valid response', () => {
    const s = parsePowerCsv(csv(goodRows()), loc);
    expect(s.tmax).toHaveLength(400);
    expect(s.start).toBe('2023-01-01');
    expect(s.elevation).toBeCloseTo(1326.72, 2);
    expect(s.rh[0]).toBe(45);
  });
  it('interpolates rare fill values (-999)', () => {
    const rows = goodRows();
    rows[10] = '2023,11,-999,8.1,0.4,18.2,1.6,45.0';
    const s = parsePowerCsv(csv(rows), loc);
    expect(s.tmax[10]).toBeCloseTo(20.5, 6);
  });
  it('rejects too many fill values', () => {
    const rows = goodRows().map((r, i) => (i < 20 ? r.replace(',18.2,', ',-999,') : r));
    expect(() => parsePowerCsv(csv(rows), loc)).toThrow(/too many missing/);
  });
  it.each([
    ['HTML error page', '<html><body>Service unavailable</body></html>'],
    ['empty', ''],
    ['JSON instead of CSV', '{"messages":["error"]}'],
  ])('rejects %s', (_l, text) => {
    expect(() => parsePowerCsv(text, loc)).toThrow(PowerDataError);
  });
  it('rejects wrong / reordered columns', () => {
    const bad = csv(goodRows()).replace('T2M_MAX,T2M_MIN', 'T2M_MIN,T2M_MAX');
    expect(() => parsePowerCsv(bad, loc)).toThrow(/columns/);
  });
  it('rejects non-numeric and script payloads in values', () => {
    const rows = goodRows();
    rows[5] = '2023,6,<script>alert(1)</script>,8.1,0.4,18.2,1.6,45.0';
    expect(() => parsePowerCsv(csv(rows), loc)).toThrow(/non-numeric|malformed/);
  });
  it('rejects physically impossible values', () => {
    const rows = goodRows();
    rows[5] = '2023,6,20.5,8.1,0.4,18.2,1.6,140.0'; // RH 140 %
    expect(() => parsePowerCsv(csv(rows), loc)).toThrow(/physical range/);
    const rows2 = goodRows();
    rows2[5] = '2023,6,5.0,8.1,0.4,18.2,1.6,45.0'; // Tmin > Tmax
    expect(() => parsePowerCsv(csv(rows2), loc)).toThrow(/Tmin > Tmax/);
  });
  it('rejects gaps, duplicates and reordering in dates', () => {
    const gap = goodRows(); gap.splice(30, 1);
    expect(() => parsePowerCsv(csv(gap), loc)).toThrow(/consecutive/);
    const dup = goodRows(); dup.splice(30, 0, dup[30]);
    expect(() => parsePowerCsv(csv(dup), loc)).toThrow(/consecutive/);
  });
  it('rejects oversized payloads (resource exhaustion)', () => {
    expect(() => parsePowerCsv('-BEGIN HEADER-' + 'x'.repeat(3_100_000), loc)).toThrow(/too large/);
  });
});

describe('validateSeries (preset JSON / cache)', () => {
  const base = (): DailySeries => ({
    lat: 38.5, lon: 68.8, elevation: 800, start: '2023-01-01',
    tmax: Array(400).fill(20), tmin: Array(400).fill(8), prcp: Array(400).fill(0.5),
    rs: Array(400).fill(18), u2: Array(400).fill(1.5), rh: Array(400).fill(45),
  });
  it('accepts a valid series and converts JSON nulls', () => {
    const s = base();
    (s.u2 as unknown as (number | null)[])[3] = null;
    expect(validateSeries(s).filled).toBe(1);
  });
  it.each([
    ['string number', (s: DailySeries) => { (s.tmax as unknown[])[0] = '20'; }],
    ['column length mismatch', (s: DailySeries) => { s.rh.pop(); }],
    ['bad start date', (s: DailySeries) => { s.start = "2023-01-01'; DROP"; }],
    ['bad coordinates', (s: DailySeries) => { s.lat = 123; }],
    ['negative rain', (s: DailySeries) => { s.prcp[9] = -1; }],
    ['prototype key as column', (s: DailySeries) => { (s as unknown as Record<string, unknown>).tmax = { length: 400, __proto__: [] }; }],
  ])('rejects %s', (_l, mutate) => {
    const s = base();
    mutate(s);
    expect(() => validateSeries(s)).toThrow(PowerDataError);
  });
});

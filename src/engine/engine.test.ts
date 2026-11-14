/**
 * Engine tests against FAO-56 worked examples (Allen et al. 1998), Chapter 3 & 4:
 *  - Example 2: atmospheric pressure and γ at 1800 m
 *  - Annex 2 Table 2.3: saturation vapour pressure values
 *  - Example 8: Ra at 20°S on 3 September
 *  - Example 18: daily ET0 (Brussels, 6 July) = 3.9 mm/day
 */
import { describe, expect, it } from 'vitest';
import { atmosphericPressure, eaFromRHminmax, et0Hargreaves, et0PenmanMonteith, psychrometricConstant, satVapourPressure } from './et0';
import { dayOfYear, extraterrestrialRadiation, daylightHours } from './solar';
import { adjustKc, kcOnDay, seasonLength } from './kc';
import { CROPS } from './crops';
import { effectiveRainUSDA, gdd, isFrostDay, waterDeficitM3 } from './water';
import { cropWaterClimatology, monthlyClimatology, type DailySeries } from './climate';

describe('FAO-56 supporting equations', () => {
  it('Example 2: P and γ at 1800 m', () => {
    const p = atmosphericPressure(1800);
    expect(p).toBeCloseTo(81.8, 1);
    expect(psychrometricConstant(p)).toBeCloseTo(0.054, 3);
  });
  it('Annex 2 Table 2.3: e°(T)', () => {
    expect(satVapourPressure(15)).toBeCloseTo(1.705, 3);
    expect(satVapourPressure(24.5)).toBeCloseTo(3.075, 3);
  });
  it('day of year', () => {
    expect(dayOfYear(2001, 9, 3)).toBe(246); // FAO-56 Example 8 uses J = 246
    expect(dayOfYear(2001, 7, 6)).toBe(187); // FAO-56 Example 18 uses J = 187
    expect(dayOfYear(2024, 12, 31)).toBe(366);
  });
});

describe('Extraterrestrial radiation (FAO-56 Eq. 21)', () => {
  it('Example 8: Ra = 32.2 MJ/m²/day at 20°S, 3 September', () => {
    expect(extraterrestrialRadiation(-20, 246)).toBeCloseTo(32.2, 1);
  });
  it('Example 18: Ra = 41.09 at 50°48′N, 6 July', () => {
    expect(extraterrestrialRadiation(50.8, 187)).toBeCloseTo(41.09, 1);
  });
  it('Example 9: daylight hours N = 11.7 h at 20°S, 3 September', () => {
    expect(daylightHours(-20, 246)).toBeCloseTo(11.7, 1);
  });
  it('polar night/day do not produce NaN', () => {
    expect(extraterrestrialRadiation(89, 1)).toBe(0);
    expect(Number.isFinite(extraterrestrialRadiation(89, 172))).toBe(true);
  });
});

describe('ET0 Penman–Monteith (FAO-56 Eq. 6)', () => {
  // FAO-56 Example 18: Brussels (50°48′N, 100 m), 6 July. Tmax 21.5, Tmin 12.3, RHmax 84, RHmin 63,
  // u2 = 2.078 m/s, Rs = 22.07 MJ/m²/day → ea = 1.409 kPa, Rn = 13.28, ET0 = 3.9 mm/day.
  const ea = eaFromRHminmax(84, 63, 21.5, 12.3);
  const r = et0PenmanMonteith({ tmax: 21.5, tmin: 12.3, ea, u2: 2.078, rs: 22.07, elevation: 100, lat: 50.8, doy: 187 });
  it('ea = 1.409 kPa', () => expect(ea).toBeCloseTo(1.409, 2));
  it('Rn = 13.28 MJ/m²/day', () => expect(r.rn).toBeCloseTo(13.28, 1));
  it('ET0 = 3.9 mm/day', () => expect(r.et0).toBeCloseTo(3.9, 1));
  it('never negative', () => {
    expect(et0PenmanMonteith({ tmax: -20, tmin: -30, rhMean: 95, u2: 0.5, rs: 1, elevation: 2000, lat: 60, doy: 355 }).et0).toBeGreaterThanOrEqual(0);
  });
});

describe('ET0 Hargreaves (FAO-56 Eq. 52)', () => {
  it('matches the equation with Ra from Eq. 21', () => {
    const ra = extraterrestrialRadiation(50.8, 187);
    const expected = 0.0023 * (16.9 + 17.8) * Math.sqrt(9.2) * 0.408 * ra;
    expect(et0Hargreaves(21.5, 12.3, 50.8, 187)).toBeCloseTo(expected, 6);
  });
  it('is within ~25% of Penman–Monteith for Example 18 conditions', () => {
    const h = et0Hargreaves(21.5, 12.3, 50.8, 187);
    expect(Math.abs(h - 3.9) / 3.9).toBeLessThan(0.25);
  });
});

describe('Crop coefficients', () => {
  it('Kc curve follows FAO-56 stages for winter wheat', () => {
    const w = CROPS.wheat;
    expect(seasonLength(w)).toBe(240);
    expect(kcOnDay(w, 0)).toBe(0.7);
    expect(kcOnDay(w, 29)).toBe(0.7);
    expect(kcOnDay(w, 30 + 70)).toBeCloseTo((0.7 + 1.15) / 2, 6); // middle of development
    expect(kcOnDay(w, 30 + 140 + 10)).toBe(1.15);
    expect(kcOnDay(w, 239)).toBeGreaterThan(0.25);
    expect(kcOnDay(w, 240)).toBe(0);
    expect(kcOnDay(w, -1)).toBe(0);
  });
  it('Eq. 62 adjustment is zero at reference climate (u2 2, RHmin 45)', () => {
    expect(adjustKc(1.15, 2, 45, 1)).toBeCloseTo(1.15, 10);
  });
  it('Eq. 62 raises Kc in dry, windy climates and lowers it in humid, calm ones', () => {
    expect(adjustKc(1.15, 4, 20, 1)).toBeGreaterThan(1.15);
    expect(adjustKc(1.15, 1, 80, 1)).toBeLessThan(1.15);
  });
  it('every crop parameter set is internally consistent', () => {
    for (const c of Object.values(CROPS)) {
      expect(c.kcIni).toBeGreaterThan(0);
      expect(c.kcMid).toBeGreaterThanOrEqual(c.kcIni);
      expect(c.stages.every((s) => s > 0)).toBe(true);
      expect(c.sources.length).toBeGreaterThan(0);
    }
  });
});

describe('Water, GDD, frost', () => {
  it('USDA-SCS effective rainfall', () => {
    expect(effectiveRainUSDA(0)).toBe(0);
    expect(effectiveRainUSDA(100)).toBeCloseTo(84, 6);
    expect(effectiveRainUSDA(250)).toBeCloseTo(150, 6);
    expect(effectiveRainUSDA(300)).toBeCloseTo(155, 6);
    expect(effectiveRainUSDA(NaN)).toBe(0);
  });
  it('deficit converts mm to m³/ha and never goes negative', () => {
    expect(waterDeficitM3(120, 20)).toBe(1000);
    expect(waterDeficitM3(20, 120)).toBe(0);
  });
  it('GDD and frost', () => {
    expect(gdd(20, 10, 0)).toBe(15);
    expect(gdd(5, -5, 10)).toBe(0);
    expect(isFrostDay(0)).toBe(true);
    expect(isFrostDay(0.1)).toBe(false);
  });
});

describe('Climatology on a synthetic series', () => {
  // 2 full years of constant weather: easy to reason about
  const n = 365 + 366; // 2023 + 2024
  const col = (v: number) => Array.from({ length: n }, () => v);
  const s: DailySeries = { lat: 38.5, lon: 68.8, elevation: 800, start: '2023-01-01', tmax: col(20), tmin: col(10), prcp: col(1), rs: col(18), u2: col(2), rh: col(50) };
  const clim = monthlyClimatology(s);
  it('12 months, 2 complete years each', () => {
    expect(clim).toHaveLength(12);
    expect(clim.every((m) => m.years === 2)).toBe(true);
  });
  it('monthly rain = days × 1 mm, GDD0 = days × 15', () => {
    expect(clim[0].rain).toBeCloseTo(31, 6);
    expect(clim[0].gdd0).toBeCloseTo(31 * 15, 6);
    expect(clim[0].frostDays).toBe(0);
  });
  it('crop water balance runs over complete seasons only', () => {
    const w = cropWaterClimatology(s);
    expect(w.seasons).toBe(1); // only the 2023-10-15 season fits fully (ends 2024-06-11)
    expect(w.seasonalDeficit).toBeGreaterThan(0);
  });
});

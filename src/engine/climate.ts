/**
 * Daily climate series → ET0, monthly climatology and crop-season water balance.
 * Pure TypeScript (no DOM) so the same code runs in the browser, Web Workers and Cloudflare Functions.
 */
import { CROPS, type CropParams } from './crops.ts';
import { et0Hargreaves, et0PenmanMonteith, eaFromRHmean, satVapourPressure } from './et0.ts';
import { kcOnDay, seasonLength } from './kc.ts';
import { dayOfYear } from './solar.ts';
import { effectiveRainUSDA, gdd, isFrostDay, waterDeficitM3 } from './water.ts';

/** Columnar daily series; index 0 = `start` date, one entry per consecutive day. */
export interface DailySeries {
  lat: number;
  lon: number;
  elevation: number; // m (POWER: MERRA-2 grid-cell mean)
  start: string; // YYYY-MM-DD
  tmax: number[]; // °C
  tmin: number[]; // °C
  prcp: number[]; // mm day⁻¹ (PRECTOTCORR)
  rs: number[]; // MJ m⁻² day⁻¹ (ALLSKY_SFC_SW_DWN)
  u2: number[]; // m s⁻¹ (WS2M)
  rh: number[]; // % (RH2M, daily mean)
}

export interface DayDate { y: number; m: number; d: number; doy: number }

export function dateAt(start: string, i: number): DayDate {
  const [y0, m0, d0] = start.split('-').map(Number);
  const t = new Date(Date.UTC(y0, m0 - 1, d0 + i));
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth() + 1;
  const d = t.getUTCDate();
  return { y, m, d, doy: dayOfYear(y, m, d) };
}

export interface DailyDerived {
  dates: DayDate[];
  et0: Float64Array; // Penman–Monteith, mm/day
  et0Harg: Float64Array; // Hargreaves, mm/day
  rhMin: Float64Array; // estimated daily RHmin, % (FAO-56 Eq. 63 approach: ea / e°(Tmax))
}

/** Daily ET0 (PM + Hargreaves) and estimated RHmin for every day of the series. */
export function deriveDaily(s: DailySeries): DailyDerived {
  const n = s.tmax.length;
  const dates: DayDate[] = new Array(n);
  const et0 = new Float64Array(n);
  const et0Harg = new Float64Array(n);
  const rhMin = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const dt = dateAt(s.start, i);
    dates[i] = dt;
    const ea = eaFromRHmean(s.rh[i], s.tmax[i], s.tmin[i]);
    et0[i] = et0PenmanMonteith({ tmax: s.tmax[i], tmin: s.tmin[i], ea, u2: s.u2[i], rs: s.rs[i], elevation: s.elevation, lat: s.lat, doy: dt.doy }).et0;
    et0Harg[i] = et0Hargreaves(s.tmax[i], s.tmin[i], s.lat, dt.doy);
    rhMin[i] = Math.min(100, (100 * ea) / satVapourPressure(s.tmax[i]));
  }
  return { dates, et0, et0Harg, rhMin };
}

export interface MonthClimate {
  month: number; // 1–12
  years: number; // complete years averaged
  tmax: number; tmin: number; // mean of daily values, °C
  et0: number; et0Harg: number; // mean monthly total, mm
  rain: number; peff: number; // mean monthly total, mm (Peff computed per year, then averaged)
  gdd0: number; gdd10: number; // mean monthly sum, °C·day
  frostDays: number; // mean count
}

/** Monthly climatology averaged over all complete calendar years in the series. */
export function monthlyClimatology(s: DailySeries, dd: DailyDerived = deriveDaily(s)): MonthClimate[] {
  // accumulate per (year, month)
  const acc = new Map<string, { n: number; tmax: number; tmin: number; et0: number; harg: number; rain: number; g0: number; g10: number; frost: number; days: number }>();
  dd.dates.forEach((dt, i) => {
    const k = `${dt.y}-${dt.m}`;
    const a = acc.get(k) ?? { n: 0, tmax: 0, tmin: 0, et0: 0, harg: 0, rain: 0, g0: 0, g10: 0, frost: 0, days: new Date(Date.UTC(dt.y, dt.m, 0)).getUTCDate() };
    a.n++;
    a.tmax += s.tmax[i];
    a.tmin += s.tmin[i];
    a.et0 += dd.et0[i];
    a.harg += dd.et0Harg[i];
    a.rain += s.prcp[i];
    a.g0 += gdd(s.tmax[i], s.tmin[i], 0);
    a.g10 += gdd(s.tmax[i], s.tmin[i], 10);
    a.frost += isFrostDay(s.tmin[i]) ? 1 : 0;
    acc.set(k, a);
  });
  const out: MonthClimate[] = [];
  for (let m = 1; m <= 12; m++) {
    const rows = [...acc.entries()].filter(([k, a]) => Number(k.split('-')[1]) === m && a.n === a.days).map(([, a]) => a);
    const mean = (f: (a: (typeof rows)[number]) => number) => rows.reduce((t, a) => t + f(a), 0) / rows.length;
    out.push({
      month: m,
      years: rows.length,
      tmax: mean((a) => a.tmax / a.n),
      tmin: mean((a) => a.tmin / a.n),
      et0: mean((a) => a.et0),
      et0Harg: mean((a) => a.harg),
      rain: mean((a) => a.rain),
      peff: mean((a) => effectiveRainUSDA(a.rain)),
      gdd0: mean((a) => a.g0),
      gdd10: mean((a) => a.g10),
      frostDays: mean((a) => a.frost),
    });
  }
  return out;
}

export interface MonthWater {
  month: number;
  seasons: number; // number of seasons contributing
  etc: number; // mean crop ET in month, mm
  peff: number; // mean effective rain in month (only months with crop on field), mm
  deficit: number; // mean net irrigation requirement, m³/ha
}

/**
 * Crop-season water balance averaged over every complete season in the series.
 * Daily ETc = Kc(day) · ET0_PM(day); Kc mid/end adjusted with that season's mean u2 and RHmin
 * (FAO-56 Eq. 62/65). Monthly deficit = 10 · max(0, ΣETc − Peff(ΣP)) for months with the crop present.
 * Returns per-calendar-month means plus the seasonal total.
 */
export function cropWaterClimatology(s: DailySeries, crop: CropParams = CROPS.wheat, dd: DailyDerived = deriveDaily(s)) {
  const L = seasonLength(crop);
  const [li, ld, lm] = crop.stages;
  const n = s.tmax.length;
  const perMonth = Array.from({ length: 12 }, () => ({ etc: 0, peff: 0, deficit: 0, seasons: 0 }));
  const totals: number[] = [];

  const rainByMonth = new Map<string, number>();
  dd.dates.forEach((dt, i) => {
    const key = `${dt.y}-${dt.m}`;
    rainByMonth.set(key, (rainByMonth.get(key) ?? 0) + s.prcp[i]);
  });

  const firstYear = dd.dates[0].y;
  const lastYear = dd.dates[n - 1].y;
  for (let y = firstYear; y <= lastYear; y++) {
    const startIdx = dd.dates.findIndex((d) => d.y === y && d.m === crop.plant[0] && d.d === crop.plant[1]);
    if (startIdx < 0 || startIdx + L > n) continue;
    // season-specific climate for Kc adjustment
    const avg = (from: number, len: number, arr: ArrayLike<number>) => { let t = 0; for (let i = from; i < from + len; i++) t += arr[i]; return t / len; };
    const midFrom = startIdx + li + ld;
    const endFrom = midFrom + lm;
    const climate = {
      mid: { u2: avg(midFrom, lm, s.u2), rhMin: avg(midFrom, lm, dd.rhMin) },
      end: { u2: avg(endFrom, crop.stages[3], s.u2), rhMin: avg(endFrom, crop.stages[3], dd.rhMin) },
    };
    // monthly sums over the season (keyed by y-m so a month is counted once per season)
    const months = new Map<string, { m: number; etc: number; rain: number }>();
    for (let k = 0; k < L; k++) {
      const i = startIdx + k;
      const dt = dd.dates[i];
      const key = `${dt.y}-${dt.m}`;
      const row = months.get(key) ?? { m: dt.m, etc: 0, rain: 0 };
      row.etc += kcOnDay(crop, k, climate) * dd.et0[i];
      months.set(key, row);
    }
    // whole-month rain for each month the crop is on the field (Peff method is monthly)
    for (const [key, row] of months) row.rain = rainByMonth.get(key) ?? 0;
    let total = 0;
    for (const row of months.values()) {
      const peff = effectiveRainUSDA(row.rain);
      const def = waterDeficitM3(row.etc, peff);
      const pm = perMonth[row.m - 1];
      pm.etc += row.etc;
      pm.peff += peff;
      pm.deficit += def;
      pm.seasons++;
      total += def;
    }
    totals.push(total);
  }
  const seasons = totals.length;
  const months: MonthWater[] = perMonth.map((p, i) => ({
    month: i + 1,
    seasons: p.seasons,
    etc: seasons ? p.etc / seasons : 0,
    peff: seasons ? p.peff / seasons : 0,
    deficit: seasons ? p.deficit / seasons : 0,
  }));
  return { crop: crop.id, seasons, months, seasonalDeficit: seasons ? totals.reduce((a, b) => a + b, 0) / seasons : 0 };
}

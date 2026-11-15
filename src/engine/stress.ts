/**
 * Field stress calendar from the location's own NASA POWER history (CLAUDE.md §5 eq. 6 and 11).
 *
 *  - Frost day: Tmin ≤ 0 °C (CLAUDE.md §5 eq. 6).
 *  - Hot day: Tmax ≥ HOT_DAY_C. Reported as a plain count; the threshold is a display convention,
 *    not a crop-specific damage threshold (TODO verify a citable heat-stress threshold per crop).
 *  - Fihrist Compound Stress Index (eq. 11), PARTIAL: z-scores of each month against the same calendar
 *    month in every other year of the series (the location's own 2001–2024 history):
 *        heat  z = (mean daily Tmax − mean) / sd
 *        dry   z = −(rain − mean) / sd
 *    A month is a compound-stress month when BOTH z > 1 (CLAUDE.md: "e.g. z > 1").
 *    Soil-moisture and NDVI signals are NOT included yet (listed as an information gap), so this is
 *    "2 of 4 signals".
 *  - Dryness is only defined for calendar months whose mean rain ≥ MIN_RAIN_FOR_DRY_MM: in a month that
 *    is normally dry, "drier than normal" carries no information (choice documented in SOURCES.md).
 */
import { dateAt, type DailySeries } from './climate.ts';
import { isFrostDay } from './water.ts';

export const HOT_DAY_C = 35;
export const Z_ABNORMAL = 1;
export const MIN_RAIN_FOR_DRY_MM = 10;

export interface MonthStress {
  month: number; // 1–12
  years: number; // complete years used
  hotDays: number; // mean count per year
  frostDays: number; // mean count per year
  dryDefined: boolean;
  /** share of years in which this month was a heat + dry compound-stress month (0–1); null if dryness undefined */
  compoundShare: number | null;
  /** share of years with heat z > 1 alone */
  heatShare: number;
}

export interface CompoundEvent { year: number; month: number; zHeat: number; zDry: number; tmax: number; tmaxNormal: number; rain: number; rainNormal: number }

const mean = (a: number[]) => a.reduce((t, x) => t + x, 0) / a.length;
const sd = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((t, x) => t + (x - m) ** 2, 0) / (a.length - 1));
};

export function stressCalendar(s: DailySeries): { months: MonthStress[]; events: CompoundEvent[] } {
  // per (year, month) accumulators; only complete months are used
  const acc = new Map<string, { y: number; m: number; n: number; full: number; tmax: number; rain: number; hot: number; frost: number }>();
  for (let i = 0; i < s.tmax.length; i++) {
    const d = dateAt(s.start, i);
    const k = `${d.y}-${d.m}`;
    const a = acc.get(k) ?? { y: d.y, m: d.m, n: 0, full: new Date(Date.UTC(d.y, d.m, 0)).getUTCDate(), tmax: 0, rain: 0, hot: 0, frost: 0 };
    a.n++;
    a.tmax += s.tmax[i];
    a.rain += s.prcp[i];
    if (s.tmax[i] >= HOT_DAY_C) a.hot++;
    if (isFrostDay(s.tmin[i])) a.frost++;
    acc.set(k, a);
  }
  const rows = [...acc.values()].filter((a) => a.n === a.full);

  const months: MonthStress[] = [];
  const events: CompoundEvent[] = [];
  for (let m = 1; m <= 12; m++) {
    const r = rows.filter((a) => a.m === m);
    const tm = r.map((a) => a.tmax / a.n);
    const rn = r.map((a) => a.rain);
    const [tMean, tSd, rMean, rSd] = [mean(tm), sd(tm), mean(rn), sd(rn)];
    const dryDefined = rMean >= MIN_RAIN_FOR_DRY_MM && rSd > 0;
    let heat = 0;
    let compound = 0;
    r.forEach((a, j) => {
      const zHeat = tSd > 0 ? (tm[j] - tMean) / tSd : 0;
      const zDry = dryDefined ? -(rn[j] - rMean) / rSd : 0;
      if (zHeat > Z_ABNORMAL) heat++;
      if (dryDefined && zHeat > Z_ABNORMAL && zDry > Z_ABNORMAL) {
        compound++;
        events.push({ year: a.y, month: m, zHeat, zDry, tmax: tm[j], tmaxNormal: tMean, rain: rn[j], rainNormal: rMean });
      }
    });
    months.push({
      month: m,
      years: r.length,
      hotDays: r.length ? mean(r.map((a) => a.hot)) : 0,
      frostDays: r.length ? mean(r.map((a) => a.frost)) : 0,
      dryDefined,
      compoundShare: dryDefined && r.length ? compound / r.length : null,
      heatShare: r.length ? heat / r.length : 0,
    });
  }
  events.sort((a, b) => b.year - a.year || b.month - a.month);
  return { months, events };
}

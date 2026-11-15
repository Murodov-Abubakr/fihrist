/**
 * Field stress calendar from the location's own history (CLAUDE.md §5 eq. 6 and 11).
 *
 *  - Frost day: Tmin ≤ 0 °C (CLAUDE.md §5 eq. 6).
 *  - Hot day: Tmax ≥ HOT_DAY_C. Reported as a plain count; the threshold is a display convention,
 *    not a crop-specific damage threshold (TODO verify a citable heat-stress threshold per crop).
 *  - Fihrist Compound Stress Index (eq. 11): z-scores of each month against the same calendar month in
 *    every other year of the record (the location's own 2001–2024 history), for up to four signals:
 *        heat  z = (mean daily Tmax − mean) / sd                      NASA POWER T2M_MAX
 *        dry   z = −(rain − mean) / sd                                NASA POWER PRECTOTCORR
 *        soil  z = −(root-zone wetness − mean) / sd                   NASA POWER GWETROOT (presets)
 *        veg   z = −(cropland NDVI − mean) / sd                       MODIS Terra MOD13Q1 (presets)
 *    A signal is "abnormal" when z > 1 (CLAUDE.md: "e.g. z > 1"). With n signals defined in a month, the
 *    month is a compound-stress month when at least max(2, n − 1) are abnormal (both of 2; 2 of 3; 3 of 4).
 *  - Signals are only defined where they carry information: dryness if the month's mean rain ≥ 10 mm;
 *    vegetation if the month's mean cropland NDVI ≥ 0.2 (crops present); every signal needs ≥ 10 years.
 *  - Fihrist decoupling detector (cross-dataset; flagged as questions for the farmer, not conclusions):
 *      "unexplained vegetation stress": veg z > 1.5 while every defined weather/soil signal has z < 0.5
 *        → vegetation below normal although weather and soil water were normal (possible causes outside
 *          the climate record: irrigation supply cut, sowing failure, pests, land-use change);
 *      "green despite drought": dry or soil z > 1 while veg z < 0 (vegetation at or above normal)
 *        → crops buffered against a dry month (likely irrigation).
 *    Thresholds are project choices, documented in SOURCES.md.
 */
import { dateAt, type DailySeries } from './climate.ts';
import { isFrostDay } from './water.ts';

export const HOT_DAY_C = 35;
export const Z_ABNORMAL = 1;
export const MIN_RAIN_FOR_DRY_MM = 10;
export const MIN_NDVI_FOR_VEG = 0.2;
export const MIN_YEARS = 10;
export const Z_DECOUPLE_VEG = 1.5;
export const Z_NORMAL = 0.5;

export type Signal = 'heat' | 'dry' | 'soil' | 'veg';
export const SIGNALS: Signal[] = ['heat', 'dry', 'soil', 'veg'];

export interface MonthStress {
  month: number; // 1–12
  years: number; // complete years used
  hotDays: number; // mean count per year
  frostDays: number; // mean count per year
  dryDefined: boolean;
  defined: Record<Signal, boolean>;
  /** share of years in which each signal was abnormal (z > 1); null if undefined */
  share: Record<Signal, number | null>;
  /** share of years in which this month was a compound-stress month; null if fewer than 2 signals defined */
  compoundShare: number | null;
  /** share of years with heat z > 1 alone */
  heatShare: number;
}

export interface CompoundEvent {
  year: number; month: number; zHeat: number; zDry: number; tmax: number; tmaxNormal: number; rain: number; rainNormal: number;
  z: Partial<Record<Signal, number>>; abnormal: Signal[]; n: number;
}
export interface DecoupleEvent { year: number; month: number; kind: 'unexplained' | 'buffered'; z: Partial<Record<Signal, number>>; ndvi?: number; ndviNormal?: number }

export interface ExtraSignals { ndvi?: Map<string, number>; wetness?: Map<string, number> }

const mean = (a: number[]) => a.reduce((t, x) => t + x, 0) / a.length;
const sd = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((t, x) => t + (x - m) ** 2, 0) / (a.length - 1));
};

export function stressCalendar(s: DailySeries, extra: ExtraSignals = {}): { months: MonthStress[]; events: CompoundEvent[]; decoupled: DecoupleEvent[]; signalsUsed: Signal[] } {
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
  const signalsUsed: Signal[] = ['heat', 'dry', ...(extra.wetness?.size ? ['soil' as const] : []), ...(extra.ndvi?.size ? ['veg' as const] : [])];

  const months: MonthStress[] = [];
  const events: CompoundEvent[] = [];
  const decoupled: DecoupleEvent[] = [];
  for (let m = 1; m <= 12; m++) {
    const r = rows.filter((a) => a.m === m);
    const val: Record<Signal, (number | undefined)[]> = {
      heat: r.map((a) => a.tmax / a.n),
      dry: r.map((a) => a.rain),
      soil: r.map((a) => extra.wetness?.get(`${a.y}-${a.m}`)),
      veg: r.map((a) => extra.ndvi?.get(`${a.y}-${a.m}`)),
    };
    const stats = {} as Record<Signal, { mean: number; sd: number; defined: boolean }>;
    for (const sig of SIGNALS) {
      const xs = val[sig].filter((v): v is number => v !== undefined);
      const mu = xs.length ? mean(xs) : 0;
      const sdv = sd(xs);
      let defined = xs.length >= MIN_YEARS && sdv > 0;
      if (sig === 'dry') defined = defined && mu >= MIN_RAIN_FOR_DRY_MM;
      if (sig === 'veg') defined = defined && mu >= MIN_NDVI_FOR_VEG;
      stats[sig] = { mean: mu, sd: sdv, defined };
    }
    // sign: high heat = stress; low rain / soil water / NDVI = stress
    const zOf = (sig: Signal, v: number | undefined) =>
      v === undefined || !stats[sig].defined ? undefined : (sig === 'heat' ? 1 : -1) * (v - stats[sig].mean) / stats[sig].sd;

    const nDefined = SIGNALS.filter((sig) => stats[sig].defined).length;
    const abnormalCount: Record<Signal, number> = { heat: 0, dry: 0, soil: 0, veg: 0 };
    let compound = 0;
    r.forEach((a, j) => {
      const z: Partial<Record<Signal, number>> = {};
      for (const sig of SIGNALS) { const v = zOf(sig, val[sig][j]); if (v !== undefined) z[sig] = v; }
      const present = Object.keys(z) as Signal[];
      const abnormal = present.filter((sig) => (z[sig] as number) > Z_ABNORMAL);
      abnormal.forEach((sig) => abnormalCount[sig]++);
      const need = Math.max(2, present.length - 1);
      if (present.length >= 2 && abnormal.length >= need) {
        compound++;
        events.push({
          year: a.y, month: m, zHeat: z.heat ?? 0, zDry: z.dry ?? 0, tmax: val.heat[j] as number, tmaxNormal: stats.heat.mean,
          rain: val.dry[j] as number, rainNormal: stats.dry.mean, z, abnormal, n: present.length,
        });
      }
      // decoupling detector (needs vegetation and at least one weather/soil signal)
      if (z.veg !== undefined) {
        const others = present.filter((sig) => sig !== 'veg');
        if (others.length && z.veg > Z_DECOUPLE_VEG && others.every((sig) => (z[sig] as number) < Z_NORMAL)) {
          decoupled.push({ year: a.y, month: m, kind: 'unexplained', z, ndvi: val.veg[j], ndviNormal: stats.veg.mean });
        } else if (Math.max(z.dry ?? -Infinity, z.soil ?? -Infinity) > Z_ABNORMAL && z.veg < 0) {
          decoupled.push({ year: a.y, month: m, kind: 'buffered', z, ndvi: val.veg[j], ndviNormal: stats.veg.mean });
        }
      }
    });
    const share = Object.fromEntries(SIGNALS.map((sig) => [sig, stats[sig].defined && r.length ? abnormalCount[sig] / r.length : null])) as Record<Signal, number | null>;
    months.push({
      month: m,
      years: r.length,
      hotDays: r.length ? mean(r.map((a) => a.hot)) : 0,
      frostDays: r.length ? mean(r.map((a) => a.frost)) : 0,
      dryDefined: stats.dry.defined,
      defined: { heat: stats.heat.defined, dry: stats.dry.defined, soil: stats.soil.defined, veg: stats.veg.defined },
      share,
      compoundShare: nDefined >= 2 && r.length ? compound / r.length : null,
      heatShare: r.length ? abnormalCount.heat / r.length : 0,
    });
  }
  events.sort((a, b) => b.year - a.year || b.month - a.month);
  decoupled.sort((a, b) => b.year - a.year || b.month - a.month);
  return { months, events, decoupled, signalsUsed };
}

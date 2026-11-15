import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveDaily, type DailySeries } from './climate';
import { stressCalendar, HOT_DAY_C } from './stress';
import { rotationDefs, simulateRotation } from './rotation';

const load = (id: string): DailySeries => JSON.parse(readFileSync(join(__dirname, '../../public/data/presets', `${id}.json`), 'utf8')).series;

/** 10 synthetic years starting 2001-01-01; July of 2005 is hot and dry, everything else identical. */
function synthetic(): DailySeries {
  const start = Date.UTC(2001, 0, 1);
  const end = Date.UTC(2011, 0, 1);
  const n = (end - start) / 864e5;
  const s: DailySeries = { lat: 38, lon: 68, elevation: 800, start: '2001-01-01', tmax: [], tmin: [], prcp: [], rs: [], u2: [], rh: [] };
  for (let i = 0; i < n; i++) {
    const d = new Date(start + i * 864e5);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const odd = y % 2 ? 0.3 : -0.3; // small year-to-year noise so sd > 0
    let tmax = m === 7 ? 33 + odd : 15 + odd;
    let prcp = m === 7 ? 1 + odd : 0.2; // July normally ~31 mm, other months ~6 mm (dryness undefined)
    if (y === 2005 && m === 7) { tmax = 38; prcp = 0; }
    s.tmax.push(tmax); s.tmin.push(m === 1 ? -2 : 5); s.prcp.push(prcp); s.rs.push(20); s.u2.push(2); s.rh.push(50);
  }
  return s;
}

describe('stress calendar (CLAUDE.md eq. 6 and 11, partial)', () => {
  const { months, events } = stressCalendar(synthetic());
  it('finds the planted hot + dry July and nothing else', () => {
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ year: 2005, month: 7 });
    expect(events[0].zHeat).toBeGreaterThan(1);
    expect(events[0].zDry).toBeGreaterThan(1);
    expect(months[6].compoundShare).toBeCloseTo(1 / 10);
  });
  it('leaves dryness undefined in normally dry months instead of inventing a signal', () => {
    expect(months[0].dryDefined).toBe(false);
    expect(months[0].compoundShare).toBeNull();
  });
  it('counts hot and frost days per month', () => {
    expect(months[6].hotDays).toBeCloseTo(31 / 10); // only July 2005 has Tmax ≥ 35
    expect(HOT_DAY_C).toBe(35);
    expect(months[0].frostDays).toBe(31);
    expect(months[5].frostDays).toBe(0);
  });
  it('runs on a real preset with plausible output', () => {
    const real = stressCalendar(load('khatlon'));
    expect(real.months).toHaveLength(12);
    expect(real.months[6].hotDays).toBeGreaterThan(real.months[0].hotDays); // July hotter than January
    for (const m of real.months) {
      expect(m.years).toBeGreaterThanOrEqual(23);
      if (m.compoundShare !== null) expect(m.compoundShare).toBeLessThanOrEqual(m.heatShare);
    }
  });
});

describe('field calendar (living cover vs bare soil)', () => {
  const s = load('gissar');
  const dd = deriveDaily(s);
  const defs = rotationDefs('wheat');
  const sim = (id: keyof typeof defs) => simulateRotation(s, dd, defs[id], { irrigation: 'canal', region: 'centralAsia' });
  it('has one row per cycle year and 12 months with shares in [0, 1]', () => {
    for (const id of ['baseline', 'waterSaving', 'regenerative'] as const) {
      const r = sim(id);
      expect(r.calendar).toHaveLength(defs[id].cycleYears);
      for (const row of r.calendar) {
        expect(row).toHaveLength(12);
        for (const c of row) {
          expect(c.live).toBeGreaterThanOrEqual(0);
          expect(c.live).toBeLessThanOrEqual(1);
          expect(c.crops.reduce((t, x) => t + x.share, 0)).toBeCloseTo(c.live, 6);
        }
      }
    }
  });
  it('continuous wheat leaves the field bare in late summer; regenerative keeps it covered', () => {
    const base = sim('baseline').calendar[0];
    expect(base[7].live).toBe(0); // August: between wheat harvest (~Jun 11) and sowing (Oct 15)
    expect(base[0].crops[0].crop).toBe('wheat'); // January: wheat
    const regen = sim('regenerative').calendar;
    expect(regen[0][6].crops[0].crop).toBe('sorghum'); // cycle year 1, July
    expect(regen[1][6].crops[0].crop).toBe('mung'); // cycle year 2, July: mung after wheat
    const bareMonths = (cal: { live: number }[][]) => cal.flat().filter((c) => c.live < 0.5).length / cal.length;
    expect(bareMonths(regen)).toBeLessThan(bareMonths([base]));
  });
  it('bare-soil days in the calendar agree with the yearly bare-day accounting', () => {
    const r = sim('baseline');
    const daysIn = (m: number) => new Date(Date.UTC(2015, m, 0)).getUTCDate();
    const bareFromCal = r.calendar[0].reduce((t, c, m) => t + (1 - c.live) * daysIn(m + 1), 0);
    expect(Math.abs(bareFromCal - r.mean.bareDays)).toBeLessThan(2); // leap days
  });
});

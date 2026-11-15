// Stress calendar per preset (checkpoint helper). Run: node scripts/stress-table.mts
import { readFileSync } from 'node:fs';
import { stressCalendar } from '../src/engine/stress.ts';

for (const id of ['gissar', 'khatlon', 'balkh', 'kansas']) {
  const s = JSON.parse(readFileSync(new URL(`../public/data/presets/${id}.json`, import.meta.url), 'utf8')).series;
  const { months, events } = stressCalendar(s);
  console.log(`\n${id}`);
  console.log('month  hot days  frost days  heat z>1  heat+dry');
  for (const m of months) {
    const c = m.compoundShare === null ? '   n/a' : `${(m.compoundShare * 100).toFixed(0).padStart(5)}%`;
    console.log(`${String(m.month).padStart(5)}  ${m.hotDays.toFixed(1).padStart(8)}  ${m.frostDays.toFixed(1).padStart(10)}  ${(m.heatShare * 100).toFixed(0).padStart(7)}%  ${c}`);
  }
  console.log('compound events (newest first):', events.slice(0, 8).map((e) => `${e.year}-${String(e.month).padStart(2, '0')} (T ${e.tmax.toFixed(1)} vs ${e.tmaxNormal.toFixed(1)}, rain ${e.rain.toFixed(0)} vs ${e.rainNormal.toFixed(0)} mm)`).join('; ') || 'none');
}

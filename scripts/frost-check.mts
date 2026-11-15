// Frost days and coldest Tmin per winter month vs the 2001-2024 normal (checks a decoupling hypothesis).
// Run: node scripts/frost-check.mts [presetId] [year]
import { readFileSync } from 'node:fs';
import { dateAt } from '../src/engine/climate.ts';

const id = process.argv[2] ?? 'gissar';
const year = Number(process.argv[3] ?? 2012);
const s = JSON.parse(readFileSync(new URL(`../public/data/presets/${id}.json`, import.meta.url), 'utf8')).series;
const by = new Map<string, { frost: number; minT: number; hardFrost: number }>();
for (let i = 0; i < s.tmin.length; i++) {
  const d = dateAt(s.start, i);
  const k = `${d.y}-${d.m}`;
  const a = by.get(k) ?? { frost: 0, minT: Infinity, hardFrost: 0 };
  if (s.tmin[i] <= 0) a.frost++;
  if (s.tmin[i] <= -10) a.hardFrost++;
  a.minT = Math.min(a.minT, s.tmin[i]);
  by.set(k, a);
}
for (const m of [12, 1, 2, 3]) {
  const y = m === 12 ? year - 1 : year;
  const all = [...by].filter(([k]) => +k.split('-')[1] === m).map(([, v]) => v);
  const norm = (f: (v: { frost: number; minT: number; hardFrost: number }) => number) => all.reduce((t, v) => t + f(v), 0) / all.length;
  const v = by.get(`${y}-${m}`)!;
  console.log(`${id} ${y}-${String(m).padStart(2, '0')}: frost days ${v.frost} (normal ${norm((x) => x.frost).toFixed(1)}), days <= -10 C ${v.hardFrost} (normal ${norm((x) => x.hardFrost).toFixed(1)}), coldest ${v.minT.toFixed(1)} C (normal coldest ${norm((x) => x.minT).toFixed(1)} C)`);
}

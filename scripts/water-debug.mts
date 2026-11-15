// Season-level soil water diagnostics for rainfed Kansas wheat. Run: node scripts/water-debug.mts
import { readFileSync } from 'node:fs';
import { deriveDaily } from '../src/engine/climate.ts';
import { rotationDefs } from '../src/engine/rotation.ts';
import { waterWindow } from '../src/engine/soilwater.ts';

const s = JSON.parse(readFileSync(new URL('../public/data/presets/kansas.json', import.meta.url), 'utf8')).series;
const dd = deriveDaily(s);
const idx = (y: number, m: number, d: number) => dd.dates.findIndex((x) => x.y === y && x.m === m && x.d === d);
let annual = 0;
for (let i = 0; i < s.prcp.length; i++) if (dd.dates[i].y >= 2015 && dd.dates[i].y <= 2024) annual += s.prcp[i];
console.log(`POWER rain 2015-2024 mean: ${(annual / 10).toFixed(0)} mm/yr`);
void rotationDefs;
let dr = 0;
let prevEnd = idx(2013, 6, 11);
for (let y = 2013; y <= 2023; y++) {
  const sow = idx(y, 10, 15);
  const w = waterWindow(s, dd, 'wheat', prevEnd + 1, sow, 240, false, 'loam', dr);
  console.log(`${y + 1}: fallow rain ${w.fallowRain.toFixed(0)} evap ${w.fallowEvap.toFixed(0)} | sow depl ${w.sowDepletion.toFixed(2)} | season rain ${w.rain.toFixed(0)} ETc ${w.etc.toFixed(0)} ETa ${w.eta.toFixed(0)} ratio ${(w.eta / w.etc).toFixed(2)} | drain ${w.deepPerc.toFixed(0)} end ${w.endDepletion.toFixed(2)}`);
  dr = w.endDepletion;
  prevEnd = sow + 239;
}

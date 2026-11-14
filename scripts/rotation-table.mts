// Prints rotation results for presets using the real engine (dev/checkpoint helper).
// Run: node scripts/rotation-table.mts [presetId] [rainfed|canal|drip] [wheat|wheatCotton]
import { readFileSync } from 'node:fs';
import { deriveDaily, type DailySeries } from '../src/engine/climate.ts';
import { rotationDefs, simulateRotation, type Irrigation } from '../src/engine/rotation.ts';
import { rankRotations } from '../src/engine/ranking.ts';
import { regionOf } from '../src/engine/params.ts';

const id = process.argv[2] ?? 'gissar';
const irrigation = (process.argv[3] ?? 'canal') as Irrigation;
const baseline = (process.argv[4] ?? 'wheat') as 'wheat' | 'wheatCotton';
const file = JSON.parse(readFileSync(new URL(`../public/data/presets/${id}.json`, import.meta.url), 'utf8'));
const s: DailySeries = file.series;
const dd = deriveDaily(s);
const { region, outOfRegion } = regionOf(s.lat, s.lon);
const defs = rotationDefs(baseline);
const res = (['baseline', 'waterSaving', 'regenerative'] as const).map((r) => simulateRotation(s, dd, defs[r], { irrigation, region }));
const rank = rankRotations(res, { water: 70, nitrogen: 50, erosion: 40, organic: 40, forage: 30, income: 60 }, irrigation);

console.log(`\n${id} | ${irrigation} | baseline=${baseline} | region=${region}${outOfRegion ? ' (OUT OF REGION)' : ''} | harvest years 2015-2024`);
const f = (v: number, d = 0) => v.toFixed(d).padStart(9);
console.log('rotation        rank  score  water m3  ppl P10  ppl P50  ppl P90  prot kg  Nbal/yr  Ncost$  profit$  bareRain  rootDays forage');
res.forEach((r, i) => {
  const k = rank[i];
  const w = irrigation === 'rainfed' ? r.mean.unmetM3 : r.mean.grossIrrigationM3;
  console.log(`${r.id.padEnd(15)}${String(k.rank).padStart(5)}${f(k.score, 2).slice(2)}${f(w)}${f(r.peopleFedP.p10, 2)}${f(r.peopleFedP.p50, 2)}${f(r.peopleFedP.p90, 2)}${f(r.mean.proteinKg)}${f(r.mean.nFixedKg - r.mean.nRemovedKg)}${f(r.mean.nCostUsd)}${f(r.mean.trueProfitUsd)}${f(r.mean.bareRainMm)}${f(r.mean.livingRootDays)}${f(r.mean.forageSeasons, 1)}`);
});
for (const r of res) {
  console.log(`  ${r.id}: seasons ${r.seasons.length}; ` + r.seasons.slice(0, 6).map((x) => `${x.crop}@${x.harvestYear} y=${x.yieldT.toFixed(2)} etc=${x.etc.toFixed(0)} eta=${x.eta.toFixed(0)} irr=${x.netIrrigation.toFixed(0)}`).join(' | '));
  console.log(`    year1 profit ${r.years[0].trueProfitUsd.toFixed(0)} USD (yr ${r.years[0].year}); 10-yr N balance ${r.nBalance10yKg.toFixed(0)} kg N/ha`);
}

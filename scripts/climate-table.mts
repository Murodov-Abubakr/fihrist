// Prints the monthly climatology + winter-wheat water balance for presets, using the real engine.
// Run: node scripts/climate-table.mts [presetId ...]     (Node >= 22.18, native TS type stripping)
import { readFileSync } from 'node:fs';
import { cropWaterClimatology, deriveDaily, monthlyClimatology, type DailySeries } from '../src/engine/climate.ts';
import { CROPS } from '../src/engine/crops.ts';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['gissar', 'kansas'];
const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const f = (v: number, d = 0, w = 6) => v.toFixed(d).padStart(w);

for (const id of ids) {
  const file = JSON.parse(readFileSync(new URL(`../public/data/presets/${id}.json`, import.meta.url), 'utf8'));
  const s: DailySeries = file.series;
  for (const k of ['tmax', 'tmin', 'prcp', 'rs', 'u2', 'rh'] as const) s[k] = s[k].map((v) => (v === null ? NaN : v));
  const dd = deriveDaily(s);
  const clim = monthlyClimatology(s, dd);
  const wheat = cropWaterClimatology(s, CROPS.wheat, dd);
  console.log(`\n=== ${id.toUpperCase()}  lat ${s.lat}, lon ${s.lon}, grid elevation ${s.elevation} m, ${clim[0].years} years (2001-2024) ===`);
  console.log('Month   Tmax   Tmin  ET0pm  ET0hg   Rain   Peff  WhtETc  WhtDef  GDD0  GDD10  Frost');
  console.log('         C      C     mm     mm     mm     mm     mm    m3/ha   C.d    C.d   days');
  const t = { et0: 0, harg: 0, rain: 0, peff: 0, etc: 0, def: 0, g0: 0, g10: 0, frost: 0 };
  clim.forEach((c, i) => {
    const w = wheat.months[i];
    t.et0 += c.et0; t.harg += c.et0Harg; t.rain += c.rain; t.peff += c.peff; t.etc += w.etc; t.def += w.deficit; t.g0 += c.gdd0; t.g10 += c.gdd10; t.frost += c.frostDays;
    console.log(`${M[i].padEnd(5)}${f(c.tmax, 1, 7)}${f(c.tmin, 1, 7)}${f(c.et0, 0, 7)}${f(c.et0Harg, 0, 7)}${f(c.rain, 0, 7)}${f(w.seasons ? w.peff : c.peff, 0, 7)}${f(w.etc, 0, 8)}${f(w.deficit, 0, 8)}${f(c.gdd0, 0, 6)}${f(c.gdd10, 0, 7)}${f(c.frostDays, 1, 7)}`);
  });
  console.log(`Year ${' '.repeat(14)}${f(t.et0, 0, 7)}${f(t.harg, 0, 7)}${f(t.rain, 0, 7)}${' '.repeat(7)}${f(t.etc, 0, 8)}${f(t.def, 0, 8)}${f(t.g0, 0, 6)}${f(t.g10, 0, 7)}${f(t.frost, 0, 7)}`);
  console.log(`Winter wheat (sown 15 Oct, 240 d): ${wheat.seasons} seasons; mean seasonal net irrigation need ${wheat.seasonalDeficit.toFixed(0)} m3/ha (${(wheat.seasonalDeficit / 10).toFixed(0)} mm)`);
}

// Kansas validation table (checkpoint helper). Run: node scripts/validation-table.mts
import { readFileSync } from 'node:fs';
import { deriveDaily } from '../src/engine/climate.ts';
import { validateKansasWheat } from '../src/engine/validation.ts';

const s = JSON.parse(readFileSync(new URL('../public/data/presets/kansas.json', import.meta.url), 'utf8')).series;
const dd = deriveDaily(s);
for (const kyMode of ['season', 'stage'] as const) {
  for (const soil of ['sand', 'loam', 'clay'] as const) {
    const v = validateKansasWheat(s, dd, soil, kyMode);
    console.log(`\nKy=${kyMode} soil=${soil}: mean model ${v.meanModelled.toFixed(2)} vs NASS ${v.meanObserved.toFixed(2)} t/ha, bias ${v.biasPct.toFixed(1)}%, MAE ${v.mae.toFixed(2)}, r ${v.r.toFixed(2)}, direction ${v.directionHits}/${v.directionYears}`);
    console.log(v.rows.map((r) => `${r.year}: ${r.modelled.toFixed(2)} vs ${r.observed.toFixed(2)}`).join(' | '));
  }
}

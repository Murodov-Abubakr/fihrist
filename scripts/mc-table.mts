// Monte Carlo bands under climate-stress settings (checkpoint helper).
// Run: node scripts/mc-table.mts
import { readFileSync } from 'node:fs';
import { buildSeasonTables, deriveForMc, runBatch, summarize } from '../src/engine/montecarlo.ts';
import { regionOf } from '../src/engine/params.ts';
import type { Irrigation } from '../src/engine/rotation.ts';

const cases: [string, Irrigation, 'wheat' | 'wheatCotton'][] = [['gissar', 'canal', 'wheat'], ['khatlon', 'canal', 'wheatCotton'], ['kansas', 'rainfed', 'wheat']];
const stresses: [number, number][] = [[0, 0], [2, -20]];
const f = (v: number, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

for (const [id, irr, base] of cases) {
  const s = JSON.parse(readFileSync(new URL(`../public/data/presets/${id}.json`, import.meta.url), 'utf8')).series;
  const { region } = regionOf(s.lat, s.lon);
  for (const [dT, dP] of stresses) {
    const t0 = performance.now();
    const { series, dd } = deriveForMc(s, dT, dP);
    const payload = buildSeasonTables(series, dd, { irrigation: irr, region, baseline: base });
    const t1 = performance.now();
    const batches = Array.from({ length: 12 }, (_, i) => runBatch(payload, 200, 1000 + i));
    const t2 = performance.now();
    const m = summarize(batches);
    console.log(`\n${id} ${irr} ΔT=${dT >= 0 ? '+' : ''}${dT}°C ΔP=${dP}% | tables ${(t1 - t0).toFixed(0)} ms, 2,400 futures ${(t2 - t1).toFixed(0)} ms, payload ${(JSON.stringify(payload).length / 1024).toFixed(1)} kB`);
    console.log('rotation       water m3/yr P10 / P50 / P90         people fed P10 / P50 / P90   profit $ P10 / P90');
    for (const r of ['baseline', 'waterSaving', 'regenerative'] as const) {
      const x = m[r];
      console.log(`${r.padEnd(14)} ${f(x.waterM3.p10).padStart(7)} / ${f(x.waterM3.p50).padStart(7)} / ${f(x.waterM3.p90).padStart(7)}     ${f(x.peopleFed.p10, 1).padStart(5)} / ${f(x.peopleFed.p50, 1).padStart(5)} / ${f(x.peopleFed.p90, 1).padStart(5)}     ${f(x.profitUsd.p10).padStart(6)} / ${f(x.profitUsd.p90).padStart(6)}`);
    }
  }
}

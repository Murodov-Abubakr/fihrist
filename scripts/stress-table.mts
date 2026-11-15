// Stress calendar per preset, with satellite layers when prefetched. Run: node scripts/stress-table.mts
import { existsSync, readFileSync } from 'node:fs';
import { stressCalendar, type ExtraSignals } from '../src/engine/stress.ts';
import { monthlyNdvi, monthlyWetness, validateSat } from '../src/engine/satellite.ts';

const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
for (const id of ['gissar', 'khatlon', 'balkh', 'kansas']) {
  const s = JSON.parse(readFileSync(new URL(`../public/data/presets/${id}.json`, import.meta.url), 'utf8')).series;
  const satPath = new URL(`../public/data/presets/${id}-sat.json`, import.meta.url);
  let extra: ExtraSignals = {};
  let note = 'no satellite file';
  if (existsSync(satPath)) {
    const sat = validateSat(JSON.parse(readFileSync(satPath, 'utf8')), id);
    extra = { ...(sat.layers.ndvi ? { ndvi: monthlyNdvi(sat.layers.ndvi.composites) } : {}), ...(sat.layers.wetness ? { wetness: monthlyWetness(sat.layers.wetness) } : {}) };
    const nd = sat.layers.ndvi?.composites ?? [];
    note = `NDVI composites ${nd.filter((c) => c.ndvi !== null).length}/${nd.length}, cropland ${((sat.layers.ndvi?.croplandShare ?? 0) * 100).toFixed(1)} %, slope ${sat.layers.slope?.meanSlopeDeg ?? '-'} deg, gaps ${JSON.stringify(sat.gaps)}`;
  }
  const r = stressCalendar(s, extra);
  console.log(`\n${id}: signals ${r.signalsUsed.join('+')} | ${note}`);
  console.log('month  heat  dry   soil  veg   compound');
  const p = (v: number | null) => (v === null ? '   -  ' : `${(v * 100).toFixed(0).padStart(4)}% `);
  for (const m of r.months) console.log(`${M[m.month - 1]}   ${p(m.share.heat)}${p(m.share.dry)}${p(m.share.soil)}${p(m.share.veg)}${p(m.compoundShare)}`);
  console.log('compound (newest):', r.events.slice(0, 6).map((e) => `${M[e.month - 1]} ${e.year} [${e.abnormal.join(',')}]`).join('; ') || 'none');
  console.log('UNEXPLAINED vegetation stress:', r.decoupled.filter((d) => d.kind === 'unexplained').map((d) => `${M[d.month - 1]} ${d.year} (NDVI ${d.ndvi?.toFixed(2)} vs ${d.ndviNormal?.toFixed(2)})`).join('; ') || 'none');
  console.log('AFTER a cold spell:', r.decoupled.filter((d) => d.kind === 'afterCold').map((d) => `${M[d.month - 1]} ${d.year} (NDVI ${d.ndvi?.toFixed(2)} vs ${d.ndviNormal?.toFixed(2)}; cold ${M[d.cold!.month - 1]} ${d.cold!.year} Tmin ${d.cold!.tmin.toFixed(1)} vs ${d.cold!.tminNormal.toFixed(1)} C, z ${d.cold!.z.toFixed(1)})`).join('; ') || 'none');
  console.log('GREEN despite drought:', r.decoupled.filter((d) => d.kind === 'buffered').map((d) => `${M[d.month - 1]} ${d.year}`).join('; ') || 'none');
}

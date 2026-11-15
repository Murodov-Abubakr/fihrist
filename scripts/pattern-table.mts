// Crop pattern per year from each preset's MODIS NDVI. Run: node scripts/pattern-table.mts
import { readFileSync } from 'node:fs';
import { monthlyNdvi, validateSat } from '../src/engine/satellite.ts';
import { cropPatterns } from '../src/engine/phenology.ts';

const SHORT = { winterCereal: 'W', summerCrop: 'S', double: 'D', unclear: '.' } as const;
for (const id of ['gissar', 'khatlon', 'balkh', 'kansas']) {
  const sat = validateSat(JSON.parse(readFileSync(new URL(`../public/data/presets/${id}-sat.json`, import.meta.url), 'utf8')), id);
  const r = cropPatterns(monthlyNdvi(sat.layers.ndvi!.composites));
  console.log(`${id.padEnd(8)} ${r.years.map((p) => SHORT[p.pattern]).join('')}  dominant ${r.dominant} (${Math.round(r.share * 100)} % of years)  [${r.years[0]?.year}-${r.years.at(-1)?.year}; W winter cereal, S summer crop, D double, . unclear]`);
}

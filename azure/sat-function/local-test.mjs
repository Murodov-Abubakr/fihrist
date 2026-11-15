// Local smoke test of the core (not deployed): node local-test.mjs [lat lon budgetSeconds]
import { satelliteLayers } from './src/core.mjs';

const [lat, lon, budget] = [Number(process.argv[2] ?? 38.8), Number(process.argv[3] ?? -99.3), Number(process.argv[4] ?? 40)];
const t0 = Date.now();
const r = await satelliteLayers(lat, lon, budget * 1000);
const nd = r.layers.ndvi?.composites ?? [];
console.log(JSON.stringify({
  seconds: Math.round((Date.now() - t0) / 1000),
  ndviValid: nd.filter((c) => c.ndvi !== null).length, ndviTotal: nd.length,
  cropland: r.layers.ndvi?.croplandShare, slope: r.layers.slope?.meanSlopeDeg, wetnessRows: r.layers.wetness?.length, gaps: r.gaps,
}));

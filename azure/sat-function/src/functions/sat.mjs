// POST /api/sat  {"lat": number, "lon": number}  ->  fihrist-sat-v1 JSON for that location.
//
// Abuse and cost limits (OWASP A04/A05):
//  - JSON body ≤ 200 bytes, exactly two finite numbers; latitude limited to MODIS/cropland range.
//  - One computation at a time per instance (the platform caps instances); extra requests get 429.
//  - Identical requests in flight share one computation; results are cached in memory for 24 h (≤ 200 entries),
//    keyed on 0.01° (~1 km), far below the 5 km analysis radius.
//  - CORS is restricted to the app's origins in the platform settings; errors never echo internals.
import { app } from '@azure/functions';
import { satelliteLayers } from '../core.mjs';

const CACHE_MS = 24 * 3600 * 1000;
const cache = new Map(); // key -> { at, body }
const inflight = new Map(); // key -> Promise
let busy = 0;
const MAX_BUSY = 1;

const reply = (status, body, extra = {}) => ({
  status,
  jsonBody: body,
  headers: { 'cache-control': status === 200 ? 'public, max-age=86400' : 'no-store', 'x-content-type-options': 'nosniff', ...extra },
});

app.http('sat', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'sat',
  handler: async (req, ctx) => {
    const text = await req.text();
    if (text.length > 200) return reply(413, { error: 'too large' });
    let lat, lon;
    try { ({ lat, lon } = JSON.parse(text)); } catch { return reply(400, { error: 'bad json' }); }
    if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -60 || lat > 75 || lon < -180 || lon > 180) {
      return reply(400, { error: 'lat must be -60..75 and lon -180..180' });
    }
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const hit = cache.get(key);
    // the client compares lat/lon exactly, so a cached result is re-labelled with this request's point
    if (hit && Date.now() - hit.at < CACHE_MS) return reply(200, { ...hit.body, lat, lon }, { 'x-fihrist-cache': 'hit' });

    let job = inflight.get(key);
    if (!job) {
      if (busy >= MAX_BUSY) return reply(429, { error: 'busy, try again in a minute' }, { 'retry-after': '60' });
      busy++;
      const t0 = Date.now();
      job = satelliteLayers(lat, lon).finally(() => { busy--; inflight.delete(key); });
      inflight.set(key, job);
      job.then((body) => {
        const ok = body.layers.ndvi?.composites.filter((c) => c.ndvi !== null).length ?? 0;
        ctx.log(`sat ${key}: ${((Date.now() - t0) / 1000).toFixed(0)} s, ndvi ${ok}, gaps ${body.gaps.length}`);
        if (!body.gaps.length) {
          if (cache.size >= 200) cache.delete(cache.keys().next().value);
          cache.set(key, { at: Date.now(), body });
        }
      }).catch(() => {});
    }
    try {
      const body = await job;
      return reply(200, { ...body, lat, lon });
    } catch (e) {
      ctx.error(`sat ${key} failed: ${e?.message ?? e}`);
      return reply(502, { error: 'satellite analysis failed' });
    }
  },
});

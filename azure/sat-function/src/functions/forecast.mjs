// POST /api/forecast  {"lat": number, "lon": number}  ->  daily forecast (next 10 days) from Meteomatics.
//
// Credentials: METEOMATICS_USER / METEOMATICS_PASSWORD from the Function App settings (never in code, never
// returned, never logged). Quota protection: results cached 3 h per 0.1° cell; at most DAILY_CAP upstream
// calls per instance per UTC day (the platform caps instances at 2; the account allows 1,000/day).
// Input: JSON ≤ 200 bytes, two finite numbers in range. Upstream: fixed host, https, no redirects, 15 s timeout,
// 1 MB cap; upstream error text is never echoed.
import { app } from '@azure/functions';

const HOST = 'https://api.meteomatics.com';
const DAYS = 10;
const CACHE_MS = 3 * 3600 * 1000;
const DAILY_CAP = 300;
const PARAMS = ['t_max_2m_24h:C', 't_min_2m_24h:C', 'precip_24h:mm'];
const cache = new Map();
let day = '', calls = 0;

const reply = (status, body) => ({
  status, jsonBody: body,
  headers: { 'cache-control': status === 200 ? 'public, max-age=1800' : 'no-store', 'x-content-type-options': 'nosniff' },
});

async function fetchForecast(lat, lon) {
  const user = process.env.METEOMATICS_USER, pass = process.env.METEOMATICS_PASSWORD;
  if (!user || !pass) throw Object.assign(new Error('not configured'), { code: 503 });
  const start = new Date(); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + DAYS - 1);
  const iso = (d) => d.toISOString().replace('.000Z', 'Z');
  const url = `${HOST}/${iso(start)}--${iso(end)}:P1D/${PARAMS.join(',')}/${lat.toFixed(4)},${lon.toFixed(4)}/json`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` }, redirect: 'error', signal: ctrl.signal });
    if (!r.ok) throw Object.assign(new Error(`upstream ${r.status}`), { code: 502, upstream: r.status });
    const text = await r.text();
    if (text.length > 1_000_000) throw Object.assign(new Error('upstream too large'), { code: 502 });
    const j = JSON.parse(text);
    const series = Object.fromEntries((j.data ?? []).map((p) => [p.parameter, p.coordinates?.[0]?.dates ?? []]));
    const dates = (series[PARAMS[0]] ?? []).map((d) => d.date.slice(0, 10));
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1000 ? +v.toFixed(1) : null);
    const days = dates.map((date, i) => ({
      // a 24 h value stamped at 00:00 describes the PREVIOUS 24 h, so it belongs to the day before
      date: new Date(Date.parse(date) - 864e5).toISOString().slice(0, 10),
      tmax: num(series[PARAMS[0]]?.[i]?.value), tmin: num(series[PARAMS[1]]?.[i]?.value), precip: num(series[PARAMS[2]]?.[i]?.value),
    }));
    return { format: 'fihrist-forecast-v1', lat, lon, source: 'Meteomatics', fetchedAt: new Date().toISOString(), days };
  } finally { clearTimeout(timer); }
}

app.http('forecast', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'forecast',
  handler: async (req, ctx) => {
    const text = await req.text();
    if (text.length > 200) return reply(413, { error: 'too large' });
    let lat, lon;
    try { ({ lat, lon } = JSON.parse(text)); } catch { return reply(400, { error: 'bad json' }); }
    if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) {
      return reply(400, { error: 'lat must be -85..85 and lon -180..180' });
    }
    const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return reply(200, { ...hit.body, lat, lon, cached: true });
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) { day = today; calls = 0; }
    if (calls >= DAILY_CAP) return reply(429, { error: 'daily forecast quota reached, try tomorrow' });
    calls++;
    try {
      const body = await fetchForecast(lat, lon);
      if (cache.size >= 500) cache.delete(cache.keys().next().value);
      cache.set(key, { at: Date.now(), body });
      return reply(200, body);
    } catch (e) {
      ctx.error(`forecast ${key} failed: ${e?.message ?? e}${e?.upstream ? ` (upstream ${e.upstream})` : ''}`);
      return reply(e?.code === 503 ? 503 : 502, { error: 'forecast unavailable' });
    }
  },
});

// Satellite layers for one location: the same method as scripts/prefetch-satellite.mjs, packaged for the
// Azure Function (runs in West Europe, next to the Planetary Computer storage).
//
//   1. MODIS NDVI (Terra MOD13Q1 v061, 250 m, 16-day), mean over ESA WorldCover cropland within RADIUS_KM.
//   2. NASADEM slope (Horn 1981) over ~400 m.
//   3. NASA POWER monthly GWETROOT / GWETTOP.
//
// Security: fixed host allowlist, https only, no redirects, timeouts, size caps. Inputs are validated by the caller.
import { fromUrl } from 'geotiff';

const PC = 'https://planetarycomputer.microsoft.com';
const ALLOWED = [/^planetarycomputer\.microsoft\.com$/, /^[a-z0-9]+\.blob\.core\.windows\.net$/, /^power\.larc\.nasa\.gov$/];
export const RADIUS_KM = 5;
const YEARS = [2001, 2024];
const CONCURRENCY = 24;

function checkUrl(u) {
  const url = new URL(u);
  if (url.protocol !== 'https:' || !ALLOWED.some((re) => re.test(url.hostname))) throw new Error(`blocked host: ${url.hostname}`);
  return url.href;
}
async function getJson(u, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(checkUrl(u), { ...init, redirect: 'error', signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    if (text.length > 20_000_000) throw new Error('response too large');
    return JSON.parse(text);
  } finally { clearTimeout(t); }
}

const tokens = new Map();
async function sign(href) {
  const u = new URL(checkUrl(href));
  const account = u.hostname.split('.')[0];
  const container = u.pathname.split('/')[1];
  const key = `${account}/${container}`;
  const cached = tokens.get(key);
  if (!cached || Date.now() - cached.at > 30 * 60 * 1000) {
    tokens.set(key, { token: (await getJson(`${PC}/api/sas/v1/token/${account}/${container}`)).token, at: Date.now() });
  }
  return checkUrl(`${u.origin}${u.pathname}?${tokens.get(key).token}`);
}

async function search(collection, bbox, datetime) {
  const items = [];
  let body = { collections: [collection], bbox, limit: 250, ...(datetime ? { datetime } : {}) };
  for (let page = 0; page < 40; page++) {
    const r = await getJson(`${PC}/api/stac/v1/search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    items.push(...r.features);
    const next = r.links?.find((l) => l.rel === 'next');
    if (!next?.body) break;
    body = next.body;
  }
  return items;
}

const R_SIN = 6371007.181;
const toSin = (lat, lon) => [R_SIN * (lon * Math.PI / 180) * Math.cos(lat * Math.PI / 180), R_SIN * (lat * Math.PI / 180)];
const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${label}`)), ms))]);

async function readWindow(href, x, y, halfPx) {
  return withTimeout((async () => {
    const tiff = await fromUrl(href);
    const img = await tiff.getImage();
    const [ox, oy] = img.getOrigin();
    const [rx, ry] = img.getResolution();
    const col = Math.floor((x - ox) / rx);
    const row = Math.floor((y - oy) / ry);
    const win = [Math.max(0, col - halfPx), Math.max(0, row - halfPx), Math.min(img.getWidth(), col + halfPx + 1), Math.min(img.getHeight(), row + halfPx + 1)];
    const [band] = await img.readRasters({ window: win });
    return { data: band, w: win[2] - win[0], h: win[3] - win[1], x0: win[0], y0: win[1], rx, ry, ox, oy };
  })(), 30000, 'readWindow');
}

async function pool(tasks, n) {
  const out = new Array(tasks.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) { const k = i++; out[k] = await tasks[k](); } }));
  return out;
}

async function modisNdvi(lat, lon, deadline) {
  const [x, y] = toSin(lat, lon);
  const dLat = RADIUS_KM / 111.2;
  const dLon = dLat / Math.cos(lat * Math.PI / 180);
  const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
  const wc = (await search('esa-worldcover', bbox)).filter((it) => it.assets?.map).sort((a, b) => b.properties.start_datetime.localeCompare(a.properties.start_datetime))[0];
  if (!wc) throw new Error('no ESA WorldCover item');
  const wimg = await (await fromUrl(await sign(wc.assets.map.href))).getImage();
  const [wox, woy] = wimg.getOrigin();
  const [wrx, wry] = wimg.getResolution();
  const wc0 = Math.max(0, Math.floor((bbox[0] - wox) / wrx)), wr0 = Math.max(0, Math.floor((bbox[3] - woy) / wry));
  const wc1 = Math.min(wimg.getWidth(), Math.ceil((bbox[2] - wox) / wrx)), wr1 = Math.min(wimg.getHeight(), Math.ceil((bbox[1] - woy) / wry));
  const [wmap] = await withTimeout(wimg.readRasters({ window: [wc0, wr0, wc1, wr1] }), 60000, 'worldcover');
  const wW = wc1 - wc0;
  const cropAt = (la, lo) => {
    const c = Math.floor((lo - wox) / wrx) - wc0, r = Math.floor((la - woy) / wry) - wr0;
    return c >= 0 && r >= 0 && c < wW && r < wr1 - wr0 && wmap[r * wW + c] === 40;
  };
  const fromSin = (sx, sy) => { const la = sy / R_SIN; return [la * 180 / Math.PI, (sx / (R_SIN * Math.cos(la))) * 180 / Math.PI]; };
  const cropCache = new Map();
  const isCrop = (sx, sy, rx, ry) => {
    const key = `${sx.toFixed(0)},${sy.toFixed(0)}`;
    if (cropCache.has(key)) return cropCache.get(key);
    let k = 0;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const [la, lo] = fromSin(sx + ((i - 2) / 5) * rx, sy + ((j - 2) / 5) * ry);
      if (cropAt(la, lo)) k++;
    }
    const ok = k >= 13;
    cropCache.set(key, ok);
    return ok;
  };
  let cropShare = 0;
  for (const v of wmap) if (v === 40) cropShare++;
  cropShare /= wmap.length;
  if (cropShare === 0) throw new Error('no cropland within 5 km (ESA WorldCover)');

  const items = (await search('modis-13Q1-061', bbox, `${YEARS[0]}-01-01T00:00:00Z/${YEARS[1]}-12-31T23:59:59Z`)).filter((it) => it.assets?.['250m_16_days_NDVI']);
  const tile = items[0]?.properties?.['modis:tile-id'];
  const sel = items.filter((it) => (!tile || it.properties['modis:tile-id'] === tile) && it.id.startsWith('MOD13Q1'));
  const halfNd = Math.round((RADIUS_KM * 1000) / 231.6564);
  const results = await pool(sel.map((it) => async () => {
    const date = it.properties.start_datetime.slice(0, 10);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() > deadline) return { date, ndvi: null, pixels: 0 };
      try {
        const w = await readWindow(await sign(it.assets['250m_16_days_NDVI'].href), x, y, halfNd);
        let sum = 0, n = 0;
        for (let r = 0; r < w.h; r++) for (let c = 0; c < w.w; c++) {
          const v = w.data[r * w.w + c];
          if (v <= -2000 || v > 10000) continue;
          const sx = w.ox + (w.x0 + c + 0.5) * w.rx;
          const sy = w.oy + (w.y0 + r + 0.5) * w.ry;
          if (!isCrop(sx, sy, w.rx, w.ry)) continue;
          sum += v * 0.0001; n++;
        }
        return { date, ndvi: n ? +(sum / n).toFixed(4) : null, pixels: n };
      } catch { /* retry once, then record a gap */ }
    }
    return { date, ndvi: null, pixels: 0 };
  }), CONCURRENCY);
  results.sort((a, b) => a.date.localeCompare(b.date));
  return { composites: results, landCoverItem: wc.id, croplandShare: +cropShare.toFixed(3), radiusKm: RADIUS_KM, tile };
}

async function nasademSlope(lat, lon) {
  const d = 0.01;
  const it = (await search('nasadem', [lon - d, lat - d, lon + d, lat + d]))[0];
  if (!it) throw new Error('no NASADEM item');
  const img = await (await fromUrl(await sign(it.assets.elevation.href))).getImage();
  const [ox, oy] = img.getOrigin();
  const [rx, ry] = img.getResolution();
  const col = Math.floor((lon - ox) / rx);
  const row = Math.floor((lat - oy) / ry);
  const half = 6;
  const [z] = await withTimeout(img.readRasters({ window: [col - half - 1, row - half - 1, col + half + 2, row + half + 2] }), 30000, 'nasadem');
  const W = 2 * half + 3;
  const mx = Math.abs(rx) * 111_320 * Math.cos(lat * Math.PI / 180);
  const my = Math.abs(ry) * 110_574;
  const at = (r, c) => z[r * W + c];
  const slopes = [];
  for (let r = 1; r < W - 1; r++) for (let c = 1; c < W - 1; c++) {
    const dzdx = ((at(r - 1, c + 1) + 2 * at(r, c + 1) + at(r + 1, c + 1)) - (at(r - 1, c - 1) + 2 * at(r, c - 1) + at(r + 1, c - 1))) / (8 * mx);
    const dzdy = ((at(r + 1, c - 1) + 2 * at(r + 1, c) + at(r + 1, c + 1)) - (at(r - 1, c - 1) + 2 * at(r - 1, c) + at(r - 1, c + 1))) / (8 * my);
    slopes.push(Math.atan(Math.hypot(dzdx, dzdy)) * 180 / Math.PI);
  }
  const mean = slopes.reduce((a, b) => a + b, 0) / slopes.length;
  return { item: it.id, elevationM: at(half + 1, half + 1), meanSlopeDeg: +mean.toFixed(2), maxSlopeDeg: +Math.max(...slopes).toFixed(2), windowM: Math.round(W * mx) };
}

async function powerWetness(lat, lon) {
  const u = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=GWETROOT,GWETTOP&community=AG&longitude=${lon}&latitude=${lat}&start=${YEARS[0]}&end=${YEARS[1]}&format=JSON`;
  const p = (await getJson(u)).properties.parameter;
  const rows = [];
  for (const [k, v] of Object.entries(p.GWETROOT)) {
    const m = +k.slice(4);
    if (m < 1 || m > 12) continue;
    const top = p.GWETTOP[k];
    rows.push({ y: +k.slice(0, 4), m, root: v === -999 ? null : v, top: top === -999 ? null : top });
  }
  return rows;
}

/** All three layers in parallel; a failed layer becomes an information gap. NDVI stops reading at the deadline. */
export async function satelliteLayers(lat, lon, budgetMs = 150000) {
  const deadline = Date.now() + budgetMs;
  const out = { format: 'fihrist-sat-v1', id: 'field', lat, lon, createdAt: new Date().toISOString().slice(0, 10), layers: {}, gaps: [] };
  const jobs = [['wetness', () => powerWetness(lat, lon)], ['slope', () => nasademSlope(lat, lon)], ['ndvi', () => modisNdvi(lat, lon, deadline)]];
  await Promise.all(jobs.map(async ([name, fn]) => {
    try { out.layers[name] = await fn(); } catch (e) { out.gaps.push({ layer: name, reason: String(e?.message ?? e).replace(/[^\w .,:%()/-]/g, '').slice(0, 160) }); }
  }));
  return out;
}

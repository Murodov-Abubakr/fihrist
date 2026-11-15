// Phase-4 runtime verification against `vite preview` (which serves the real security headers).
// Fails (exit 1) on: missing headers, CSP violations, console errors, uncaught page errors,
// requests to non-allowlisted hosts, or a broken UI interaction.
// Usage: node scripts/verify-runtime.mjs [baseUrl]
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://localhost:4174';
const ALLOWED_HOSTS = new Set([new URL(base).host, 'server.arcgisonline.com', 'power.larc.nasa.gov', 'photon.komoot.io']);
const problems = [];

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  // render even if the host display sleeps; software WebGL for the globe in headless Chrome
  args: ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
// Functional checks run with reduced motion so they don't depend on animation timing
// (also exercises the app's reduced-motion path). Pass --motion to test with animations on.
if (!process.argv.includes('--motion')) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

// `vite preview` has no Cloudflare Function: the Compute Grid's single probe to /api/simulate gets a
// 404 per page load and falls back to local workers. That one 404 is expected; anything else fails.
let simulate404 = 0;
page.on('response', (r) => { if (new URL(r.url()).pathname === '/api/simulate' && r.status() === 404) simulate404++; });
let tolerated404 = 0;
page.on('console', (m) => {
  const text = m.text();
  if (m.type() === 'error' && /status of 404/.test(text) && simulate404 > tolerated404) { tolerated404++; return; }
  if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(text)) problems.push(`console.${m.type()}: ${text}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('request', (r) => {
  const u = new URL(r.url());
  if (u.protocol === 'data:' || u.protocol === 'blob:') return;
  if (!ALLOWED_HOSTS.has(u.host)) problems.push(`request to non-allowlisted host: ${u.host}`);
  if (u.protocol === 'http:' && !u.host.startsWith('localhost')) problems.push(`insecure request: ${r.url()}`);
});
await page.evaluateOnNewDocument(() => {
  document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`));
});

const res = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
const h = res.headers();
for (const k of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy']) {
  if (!h[k]) problems.push(`missing header: ${k}`);
}
await new Promise((r) => setTimeout(r, 2500));

const click = async (text) => {
  const ok = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === t);
    b?.click();
    return !!b;
  }, text);
  if (!ok) problems.push(`button not found: ${text}`);
  await new Promise((r) => setTimeout(r, 400));
};

const statusText = () => page.evaluate(() => [...document.querySelectorAll('[role="status"],[role="alert"]')].map((e) => e.textContent).join(' | '));
const waitStatus = async (needle, ms, label) => {
  try {
    await page.waitForFunction((n) => [...document.querySelectorAll('[role="status"],[role="alert"]')].some((e) => e.textContent?.includes(n)), { timeout: ms }, needle);
  } catch {
    problems.push(`${label}: expected "${needle}", got "${await statusText()}"`);
  }
};

// Opening globe (MapLibre, WebGL): canvas renders under the CSP, then "Skip" opens the app
try {
  // cold start downloads the globe chunk and starts software WebGL in headless Chrome: allow 30 s
  await page.waitForSelector('[role="dialog"] .maplibregl-canvas', { timeout: 30000 });
  console.log('globe: canvas rendered');
} catch { problems.push('globe: canvas did not render'); }
await page.evaluate(() => document.querySelector('[data-action="skip-globe"]')?.click());
try {
  await page.waitForFunction(() => !document.querySelector('.maplibregl-canvas'), { timeout: 5000 });
} catch { problems.push('globe: Skip did not close the globe'); }

// Preset data file loads and validates in the browser
await waitStatus('Preset file', 8000, 'preset climate data');
for (const p of ['Khatlon / Panj', 'Balkh / Kunduz', 'Kansas (validation)', 'Gissar valley']) {
  await click(p);
  await waitStatus('Preset file', 8000, `preset ${p}`);
}
// Rotation results render and priorities re-rank the cards (Gissar, canal irrigation)
const cardOrder = () => page.evaluate(() => [...document.querySelectorAll('article h2')].map((h) => h.textContent?.trim()));
const setPriorities = (vals) => page.evaluate((v) => {
  const labels = [...document.querySelectorAll('aside label')];
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  for (const [name, val] of Object.entries(v)) {
    const input = labels.find((l) => l.textContent?.includes(name))?.querySelector('input[type=range]');
    if (!input) return `slider not found: ${name}`;
    setter.call(input, String(val));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  return 'ok';
}, vals);
try {
  await page.waitForFunction(() => /People fed/i.test(document.querySelector('article')?.textContent ?? ''), { timeout: 8000 });
} catch { problems.push('rotation results did not render'); }
const all0 = { 'Save water': 0, 'Soil nitrogen': 0, 'Less erosion': 0, 'Organic matter': 0, 'Animal forage': 0, Income: 0 };
let r1 = await setPriorities({ ...all0, 'Save water': 100 });
await new Promise((r) => setTimeout(r, 900));
const waterFirst = (await cardOrder())[0];
r1 = r1 === 'ok' ? await setPriorities({ ...all0, Income: 100 }) : r1;
await new Promise((r) => setTimeout(r, 900));
const incomeFirst = (await cardOrder())[0];
if (r1 !== 'ok') problems.push(r1);
// Gissar + canal: continuous wheat uses least water; regenerative has highest true profit (engine table)
if (waterFirst !== 'Baseline') problems.push(`water-only priority: expected Baseline first, got ${waterFirst}`);
if (incomeFirst !== 'Fihrist regenerative') problems.push(`income-only priority: expected Fihrist regenerative first, got ${incomeFirst}`);
console.log(`re-ranking: water-only -> ${waterFirst}; income-only -> ${incomeFirst}`);

// 2D field drawing: four corners on the zoomed-out preset map outline far more than 5,000 ha,
// so the outline must be REJECTED (size cap), with the reason shown; then drawing is cancelled.
await click('Draw field');
{
  const m = await page.evaluate(() => { const r = document.querySelector('.leaflet-container').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  for (const [fx, fy] of [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]]) { await page.mouse.click(m.x + m.w * fx, m.y + m.h * fy); await new Promise((r) => setTimeout(r, 250)); }
  const alert = await page.evaluate(() => [...document.querySelectorAll('aside [role="alert"]')].map((e) => e.textContent).join(' '));
  if (!/larger than 5,000 ha/.test(alert)) problems.push(`2D drawing: expected the size-cap rejection, got "${alert}"`);
  console.log(`2D drawing (oversized outline): ${alert}`);
}
await click('Stop drawing');

// Step 5: field-year timeline, charts and methodology content render from real engine output
const step5 = await page.evaluate(() => {
  const sec = (h) => [...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent?.trim() === h);
  const tl = sec('The field year');
  const ch = sec('Ten years on this field');
  return {
    cropRows: tl ? tl.querySelectorAll('[role="row"]').length : 0,
    cells: tl ? [...tl.querySelectorAll('[role="cell"]')].filter((c) => c.textContent?.trim()).length : 0,
    lines: ch ? ch.querySelectorAll('.recharts-line path.recharts-curve').length : 0,
    placeholder: /Chart appears after simulation|computed in step 5/.test(document.body.textContent ?? ''),
  };
});
// Gissar/wheat baseline: header + 1 + 3 + 2 rotation rows + hot + frost + compound = 10 rows
if (step5.cropRows !== 10) problems.push(`timeline: expected 10 rows, got ${step5.cropRows}`);
if (step5.cells < 40) problems.push(`timeline: expected labelled cells, got ${step5.cells}`);
if (step5.lines !== 6) problems.push(`charts: expected 6 lines (2 charts x 3 rotations), got ${step5.lines}`);
if (step5.placeholder) problems.push('placeholder text still visible');
console.log(`step 5: timeline rows ${step5.cropRows}, labelled cells ${step5.cells}, chart lines ${step5.lines}`);

await click('Scientist');
// Compute Grid: 12 batches finish (edge or local fallback) and bands appear on the cards
try {
  await page.waitForFunction(() => /futures · 12 batches/.test(document.body.textContent ?? ''), { timeout: 20000 });
  const grid = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('ol li')].map((li) => li.textContent).filter((x) => x?.startsWith('#'));
    const head = [...document.querySelectorAll('span')].map((s) => s.textContent).find((x) => /futures · 12 batches/.test(x ?? ''));
    const bands = [...document.querySelectorAll('dd')].filter((d) => /^P10 .* · P90 /.test(d.textContent ?? '')).length;
    return { head, tiles: tiles.slice(0, 3), n: tiles.length, bands };
  });
  console.log(`compute grid: ${grid.head} | first tiles: ${grid.tiles.join(' / ')} | band rows: ${grid.bands}`);
  if (grid.bands < 3) problems.push(`expected P10/P90 band rows on the cards, got ${grid.bands}`);
} catch {
  problems.push('compute grid did not finish');
}
const metrics = await page.evaluate(() => document.querySelectorAll('dl dt').length);
if (metrics !== 15) problems.push(`scientist mode: expected 15 metric labels, got ${metrics}`);
await click('Farmer');
await click('RU');
const ru = await page.evaluate(() => document.documentElement.lang);
if (ru !== 'ru') problems.push(`html lang after RU = ${ru}`);
await click('TJ');
await click('EN');
await click('Methodology');
const dialog = await page.evaluate(() => document.querySelector('[role="dialog"]')?.textContent ?? null);
if (dialog === null) problems.push('methodology drawer did not open');
else for (const needle of ['Penman', 'FAO-33', 'GRDC', 'FoodData Central', 'Monte Carlo']) if (!dialog.includes(needle)) problems.push(`methodology drawer missing "${needle}"`);
await page.keyboard.press('Escape');
try {
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5000 });
} catch {
  problems.push('methodology drawer did not close on Escape');
}
// Validation drawer: Kansas preset loads, model vs NASS statistics render
await click('Validation');
try {
  await page.waitForFunction(() => /Year-to-year r/.test(document.querySelector('[role="dialog"]')?.textContent ?? ''), { timeout: 10000 });
  const v = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return { lines: d?.querySelectorAll('.recharts-line').length ?? 0, text: d?.textContent ?? '' };
  });
  if (v.lines !== 2) problems.push(`validation chart: expected 2 lines, got ${v.lines}`);
  if (!/OpenET/.test(v.text) || !/NASS/.test(v.text)) problems.push('validation drawer missing NASS/OpenET sections');
  const r = v.text.match(/Year-to-year r([\d.]+)/);
  console.log(`validation drawer: r = ${r?.[1]}`);
} catch {
  problems.push('validation drawer did not render');
}
await page.keyboard.press('Escape');
await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5000 }).catch(() => problems.push('validation drawer did not close'));

await new Promise((r) => setTimeout(r, 1800)); // let any map fly-to finish before clicking the map

// Map click → coordinates update and stay in range
const box = await page.evaluate(() => {
  const r = document.querySelector('.leaflet-container').getBoundingClientRect();
  return { x: r.x + r.width * 0.8, y: r.y + r.height * 0.3 };
});
await page.mouse.click(box.x, box.y);
await new Promise((r) => setTimeout(r, 800));
const coords = await page.evaluate(() => [...document.querySelectorAll('.num')].map((e) => e.textContent).find((t) => /°\s*[,/]\s*-?\d/.test(t ?? '')));
const m = coords?.match(/(-?\d+\.\d+)°\s*[,/]\s*(-?\d+\.\d+)°/);
if (!m || Math.abs(+m[1]) > 90 || Math.abs(+m[2]) > 180) problems.push(`map click produced bad coordinates: ${coords}`);

// Clicked point → live NASA POWER request through the CSP (connect-src) → parsed + validated
const t0 = Date.now();
await waitStatus('Live from NASA', 15000, 'live NASA POWER fetch');
const liveMs = Date.now() - t0;
console.log(`live NASA POWER fetch + parse: ${liveMs} ms -> ${await statusText()}`);

// Place search: type a village, pick from the dropdown with Enter → map + coordinates move there
await page.click('input[role="combobox"]');
await page.keyboard.type('Hisor', { delay: 40 });
try {
  await page.waitForSelector('[role="option"]', { timeout: 10000 });
  const first = await page.evaluate(() => document.querySelector('[role="option"]')?.textContent);
  await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 800));
  const c2 = await page.evaluate(() => [...document.querySelectorAll('.num')].map((e) => e.textContent).find((t) => /°\s*[,/]\s*-?\d/.test(t ?? '')));
  const mm = c2?.match(/(-?\d+\.\d+)°\s*[,/]\s*(-?\d+\.\d+)°/);
  if (!mm || Math.abs(+mm[1] - 38.53) > 0.1 || Math.abs(+mm[2] - 68.56) > 0.1) problems.push(`place search: expected Hisor (38.53, 68.56), got ${c2} (first option: ${first})`);
  console.log(`place search "Hisor" -> ${first} -> ${c2}`);
} catch {
  problems.push('place search: no suggestions appeared');
}
// typed coordinates work without the network
await page.focus('input[role="combobox"]');
await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
await page.keyboard.type('38.8 N, 99.3 W', { delay: 20 });
await page.waitForSelector('[role="option"]', { timeout: 3000 }).catch(() => problems.push('coordinate search: no option'));
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 500));
const c3 = await page.evaluate(() => [...document.querySelectorAll('.num')].map((e) => e.textContent).find((t) => /°\s*[,/]\s*-?\d/.test(t ?? '')));
if (!c3?.includes('38.800') || !c3.includes('-99.300')) problems.push(`coordinate search: got ${c3}`);

// Tampered storage: XSS payload as language must fall back to en
await page.evaluate(() => localStorage.setItem('fihrist.lang', '"><img src=x onerror=alert(1)>'));
await page.reload({ waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 1500));
const lang = await page.evaluate(() => document.documentElement.lang);
if (lang !== 'en') problems.push(`tampered language not rejected: ${lang}`);

await browser.close();
if (simulate404 > 2) problems.push(`too many /api/simulate 404s (${simulate404}); the probe should stop after one per page load`);
console.log(`map click -> ${coords}`);
console.log(`/api/simulate 404 probes (expected on vite preview): ${simulate404}`);
if (problems.length) {
  console.log(`FAILED (${problems.length}):\n - ` + [...new Set(problems)].join('\n - '));
  process.exit(1);
}
console.log('PASS: headers present, no CSP violations, no console errors, only allowlisted hosts, all interactions OK');

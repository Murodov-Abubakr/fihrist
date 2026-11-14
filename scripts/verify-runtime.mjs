// Phase-4 runtime verification against `vite preview` (which serves the real security headers).
// Fails (exit 1) on: missing headers, CSP violations, console errors, uncaught page errors,
// requests to non-allowlisted hosts, or a broken UI interaction.
// Usage: node scripts/verify-runtime.mjs [baseUrl]
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://localhost:4174';
const ALLOWED_HOSTS = new Set([new URL(base).host, 'server.arcgisonline.com', 'power.larc.nasa.gov']);
const problems = [];

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] /* render even if the host display sleeps */ });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
// Functional checks run with reduced motion so they don't depend on animation timing
// (also exercises the app's reduced-motion path). Pass --motion to test with animations on.
if (!process.argv.includes('--motion')) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

page.on('console', (m) => {
  if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) problems.push(`console.${m.type()}: ${m.text()}`);
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

await click('Scientist');
const metrics = await page.evaluate(() => document.querySelectorAll('dl dt').length);
if (metrics !== 15) problems.push(`scientist mode: expected 15 metric labels, got ${metrics}`);
await click('Farmer');
await click('RU');
const ru = await page.evaluate(() => document.documentElement.lang);
if (ru !== 'ru') problems.push(`html lang after RU = ${ru}`);
await click('TJ');
await click('EN');
await click('Methodology');
const dialog = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
if (!dialog) problems.push('methodology drawer did not open');
await page.keyboard.press('Escape');
try {
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5000 });
} catch {
  problems.push('methodology drawer did not close on Escape');
}
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

// Tampered storage: XSS payload as language must fall back to en
await page.evaluate(() => localStorage.setItem('fihrist.lang', '"><img src=x onerror=alert(1)>'));
await page.reload({ waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 1500));
const lang = await page.evaluate(() => document.documentElement.lang);
if (lang !== 'en') problems.push(`tampered language not rejected: ${lang}`);

await browser.close();
console.log(`map click -> ${coords}`);
if (problems.length) {
  console.log(`FAILED (${problems.length}):\n - ` + [...new Set(problems)].join('\n - '));
  process.exit(1);
}
console.log('PASS: headers present, no CSP violations, no console errors, only allowlisted hosts, all interactions OK');

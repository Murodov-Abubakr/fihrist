// Drives the globe flow and saves screenshots. Usage: node scripts/shot-globe.mjs [baseUrl] [outDir] [--phone]
// globe → Gissar preset → draw a 4-corner field → analyse → main UI with field totals.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
const [base = 'http://localhost:4174', out = 'screenshots'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const phone = process.argv.includes('--phone');
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1440, height: 900 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const tag = phone ? 'phone' : 'desktop';
await page.goto(base, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));
await page.screenshot({ path: `${out}/globe-1-${tag}.png` });

const click = (txt) => page.evaluate((t) => { const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => x.textContent?.trim() === t); b?.click(); return !!b; }, txt);
console.log('preset', await click('Gissar valley'));
await new Promise((r) => setTimeout(r, 4000)); // tiles at zoom 13
console.log('draw', await click('Draw field'));
const box = await page.evaluate(() => { const r = document.querySelector('.maplibregl-canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const cx = box.x + box.w * (phone ? 0.5 : 0.62);
const cy = box.y + box.h * (phone ? 0.25 : 0.42);
for (const [dx, dy] of [[-40, -30], [45, -35], [50, 35], [-35, 40]]) { await page.mouse.click(cx + dx, cy + dy); await new Promise((r) => setTimeout(r, 300)); }
await new Promise((r) => setTimeout(r, 800));
const area = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] [role="status"]')].map((e) => e.textContent).join(' '));
console.log('area text:', area);
await page.screenshot({ path: `${out}/globe-2-${tag}.png` });
console.log('analyse', await click('Analyse this field'));
await new Promise((r) => setTimeout(r, 6000)); // live NASA POWER fetch for the centroid
await page.screenshot({ path: `${out}/globe-3-${tag}.png` });
const totals = await page.evaluate(() => [...document.querySelectorAll('section')].find((s) => /Your field: [\d.]+ ha/.test(s.textContent ?? ''))?.textContent?.slice(0, 260));
console.log('field totals:', totals);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();

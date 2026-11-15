// Drives the "My own rotation" editor. Usage: node scripts/shot-editor.mjs [baseUrl] [outDir]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
const [base = 'http://localhost:4174', out = 'screenshots'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1600 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
await page.goto(new URL('/?app', base).href, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
const click = (txt) => page.evaluate((t) => { const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent?.trim() === t); b?.click(); return !!b; }, txt);
const pick = (n, value) => page.evaluate((i, v) => {
  const s = document.querySelectorAll('aside select')[i];
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(s, v); s.dispatchEvent(new Event('change', { bubbles: true }));
}, n, value);
const msg = () => page.evaluate(() => [...document.querySelectorAll('aside [role="alert"], aside [role="status"]')].map((e) => e.textContent).filter((t) => /rotation|field when|harvested/.test(t ?? '')).join(' | '));
const chain = () => page.evaluate(() => [...document.querySelectorAll('article')].find((a) => /Baseline/.test(a.querySelector('h2')?.textContent ?? ''))?.querySelector('ol')?.textContent);

console.log('custom:', await click('My own rotation'));
await new Promise((r) => setTimeout(r, 400));
console.log('add year:', await click('+ Add a year'));
await pick(2, 'chickpea'); // year 2, spring
await new Promise((r) => setTimeout(r, 400));
console.log('chickpea after wheat ->', await msg());
await pick(2, 'mung');
await new Promise((r) => setTimeout(r, 2500));
console.log('mung after wheat ->', await msg());
console.log('baseline card chain ->', await chain());
// new crops: year 1 potato + barley, year 2 mung → valid
await pick(0, 'potato'); await pick(1, 'barley');
await new Promise((r) => setTimeout(r, 2500));
console.log('potato + barley, then mung ->', await msg(), '| chain:', await chain());
const aside = await page.$('aside');
await aside.screenshot({ path: `${out}/editor.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();

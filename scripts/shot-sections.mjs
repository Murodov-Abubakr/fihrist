// Screenshots of the step-5 sections. Usage: node shot5.mjs <baseUrl> <outDir> [preset button text] [irrigation button text]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
const [base = 'http://localhost:4174', out = '.', preset, irrigation] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(new URL('/?app', base).href, { waitUntil: 'networkidle0', timeout: 60000 }); // ?app skips the opening globe
const click = (txt) => page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === t)?.click(), txt);
if (preset) { await click(preset); await new Promise((r) => setTimeout(r, 2500)); }
if (irrigation) { await click(irrigation); await new Promise((r) => setTimeout(r, 1500)); }
await new Promise((r) => setTimeout(r, 4000)); // let Monte Carlo finish
const tag = (preset ?? 'gissar').split(' ')[0].toLowerCase() + (irrigation ? '-' + irrigation.toLowerCase() : '');
for (const [name, heading] of [['timeline', 'The field year'], ['charts', 'Ten years on this field']]) {
  const el = await page.evaluateHandle((h) => [...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent?.trim() === h), heading);
  if (el.asElement()) { await el.asElement().screenshot({ path: `${out}/${tag}-${name}.png` }); console.log('saved', name); } else console.log('missing', name);
}
await page.evaluate(() => document.querySelector('[data-action="methodology"]')?.click());
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: `${out}/${tag}-methodology.png` });
await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); if (d) d.scrollTop = 1500; });
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: `${out}/${tag}-methodology-2.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();

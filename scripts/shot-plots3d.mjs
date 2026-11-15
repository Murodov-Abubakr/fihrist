// Screenshot + interaction check of the 3D field section. Needs `npx vite preview --port 4174`.
// Run: node scripts/shot-plots3d.mjs
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const outDir = fileURLToPath(new URL('../screenshots/', import.meta.url));
mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const problems = [];
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/404|simulate/.test(m.text()) && errors.push(m.text()));
  await page.goto('http://localhost:4174/?app', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('#plots3d-h', { timeout: 30000 });
  await page.evaluate(() => document.getElementById('plots3d-h').scrollIntoView({ block: 'start' }));
  await new Promise((r) => setTimeout(r, 1500));
  // choose 2 plots, select plot 2, assign the regenerative rotation
  const before = await page.evaluate(() => document.querySelector('[aria-labelledby="plots3d-h"] dl').textContent);
  await page.evaluate(() => [...document.querySelectorAll('[aria-labelledby="plots3d-h"] [role="group"] button')].find((b) => b.textContent.trim() === '2').click());
  await new Promise((r) => setTimeout(r, 300));
  const rows = await page.evaluate(() => document.querySelectorAll('[aria-labelledby="plots3d-h"] ul li').length);
  if (rows !== 2) problems.push(`${w}: expected 2 plot rows, got ${rows}`);
  await page.evaluate(() => document.querySelectorAll('[aria-labelledby="plots3d-h"] ul li button')[1].click());
  await page.evaluate(() => [...document.querySelectorAll('[aria-labelledby="plots3d-h"] [role="group"] button')].filter((b) => b.textContent.includes('egenerative') || b.textContent.includes('Fihrist'))[0]?.click());
  await new Promise((r) => setTimeout(r, 400));
  const after = await page.evaluate(() => document.querySelector('[aria-labelledby="plots3d-h"] dl').textContent);
  if (before === after) problems.push(`${w}: totals did not change after editing plots`);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  if (sw > w) problems.push(`${w}: horizontal overflow ${sw}`);
  const shot = await page.$('[aria-labelledby="plots3d-h"]');
  await shot.screenshot({ path: `${outDir}plots3d-${w}.png` });
  console.log(`${w}: rows ${rows} | before ${before.replace(/\s+/g, ' ').slice(0, 90)} | after ${after.replace(/\s+/g, ' ').slice(0, 90)}${errors.length ? ` | errors ${errors.join(' | ')}` : ''}`);
  if (errors.length) problems.push(`${w}: ${errors.join(' | ')}`);
  await page.close();
}
await browser.close();
console.log(problems.length ? `FAILED:\n - ${problems.join('\n - ')}` : 'PASS');

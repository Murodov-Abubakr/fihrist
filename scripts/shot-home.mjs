// Screenshots + overflow/console check of the static home page. Run: node scripts/shot-home.mjs [url]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const url = process.argv[2] ?? pathToFileURL(fileURLToPath(new URL('../home/index.html', import.meta.url))).href;
const outDir = fileURLToPath(new URL('../screenshots/', import.meta.url));
mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && !/font|preload/i.test(m.text()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: `${outDir}home-hero-${w}.png` });
  // scroll through so every reveal fires, then capture the full page
  for (let y = 0; y < 12000; y += h * 0.6) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await new Promise((r) => setTimeout(r, 120)); }
  await new Promise((r) => setTimeout(r, 1200));
  const info = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, hidden: document.querySelectorAll('[data-reveal]:not(.in)').length, star: !!document.getElementById('starmap') }));
  console.log(`width ${w}: scrollWidth ${info.sw}${info.sw > w ? ' OVERFLOW' : ''}, unrevealed ${info.hidden}, starmap ${info.star}${errors.length ? ` | errors: ${errors.join(' | ')}` : ''}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${outDir}home-full-${w}.png`, fullPage: true });
  await page.close();
}
await browser.close();

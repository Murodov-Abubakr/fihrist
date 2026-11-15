// Screenshots + horizontal-overflow check of the static home page. Run: node scripts/shot-home.mjs
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const url = pathToFileURL(fileURLToPath(new URL('../home/index.html', import.meta.url))).href;
const outDir = fileURLToPath(new URL('../screenshots/', import.meta.url));
mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
for (const [w, h] of [[360, 780], [1280, 800]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('requestfailed', (r) => errors.push(`failed ${r.url()}`));
  await page.goto(url, { waitUntil: 'networkidle0' });
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log(`width ${w}: scrollWidth ${sw}${sw > w ? '  OVERFLOW' : ''}${errors.length ? ` errors ${errors.join(' | ')}` : ''}`);
  await page.screenshot({ path: `${outDir}home-${w}.png`, fullPage: true });
  await page.close();
}
await browser.close();

// Dev helper: captures screenshots of the running app (vite preview) with local Chrome.
// Usage: node scripts/screenshot.mjs [baseUrl] [outDir]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173';
const out = process.argv[3] ?? 'screenshots';
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'], // render even if the host display sleeps
});

async function shot(name, { width, height, lang, mode, drawer, fullPage = true }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((l) => localStorage.setItem('fihrist.lang', l), lang);
  await page.goto(base, { waitUntil: 'networkidle0', timeout: 60000 });
  if (mode === 'scientist') {
    const label = { en: 'Scientist', ru: 'Учёный', tg: 'Олим' }[lang];
    await page.evaluate((txt) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === txt)?.click(), label);
  }
  if (drawer) await page.evaluate(() => document.querySelector('[data-action="methodology"]')?.click());
  await new Promise((r) => setTimeout(r, 2200)); // let reveal + map fly-to settle
  await page.screenshot({ path: `${out}/${name}.png`, fullPage });
  await page.close();
  console.log('saved', `${out}/${name}.png`);
}

await shot('1-desktop-farmer-en', { width: 1440, height: 900, lang: 'en', mode: 'farmer' });
await shot('2-desktop-scientist-ru', { width: 1440, height: 900, lang: 'ru', mode: 'scientist' });
await shot('3-mobile-farmer-tj', { width: 390, height: 844, lang: 'tg', mode: 'farmer' });
await shot('4-methodology-drawer', { width: 1440, height: 900, lang: 'en', mode: 'scientist', drawer: true, fullPage: false });
await browser.close();

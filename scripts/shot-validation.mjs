// Screenshot of the Validation drawer. Usage: node scripts/shot-validation.mjs <baseUrl> <outFile>
import puppeteer from 'puppeteer-core';
const [base = 'http://localhost:4174', out = 'validation.png'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1300 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.goto(new URL('/?app', base).href, { waitUntil: 'networkidle0', timeout: 60000 }); // ?app skips the opening globe
await page.evaluate(() => document.querySelector('[data-action="validation"]')?.click());
await page.waitForFunction(() => /Year-to-year r/.test(document.querySelector('[role="dialog"]')?.textContent ?? ''), { timeout: 10000 });
await new Promise((r) => setTimeout(r, 800));
const d = await page.$('[role="dialog"]');
await d.screenshot({ path: out });
console.log('saved', out);
await browser.close();

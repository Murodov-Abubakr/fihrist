// Phone-size screenshot of the top of the page. Usage: node scripts/shot-mobile.mjs <baseUrl> <outFile> [lang]
import puppeteer from 'puppeteer-core';
const [base = 'http://localhost:4174', out = 'mobile.png', lang = 'en'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.evaluateOnNewDocument((l) => localStorage.setItem('fihrist.lang', l), lang);
await page.goto(base, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();

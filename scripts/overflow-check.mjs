// Finds elements wider than the viewport at phone widths. Usage: node scripts/overflow-check.mjs [baseUrl]
// Exit 1 if the page scrolls horizontally at any tested width.
import puppeteer from 'puppeteer-core';
const base = process.argv[2] ?? 'http://localhost:4174';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
let bad = false;
for (const [width, lang] of [[360, 'en'], [390, 'en'], [412, 'en'], [360, 'ru'], [360, 'tg'], [768, 'ru']]) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument((l) => localStorage.setItem('fihrist.lang', l), lang);
  await page.goto(base, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));
  const res = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      // skip content inside intentional horizontal scrollers
      let p = el.parentElement, scroller = false;
      while (p) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { scroller = true; break; } p = p.parentElement; }
      if (scroller) continue;
      if (r.right > vw + 1 || r.left < -1) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} [${Math.round(r.left)}..${Math.round(r.right)}] "${(el.textContent ?? '').trim().slice(0, 30)}"`);
    }
    return { vw, sw: document.documentElement.scrollWidth, offenders: offenders.slice(0, 12) };
  });
  console.log(`\nwidth ${width} ${lang}: viewport ${res.vw}, scrollWidth ${res.sw}${res.sw > res.vw ? '  <-- OVERFLOW' : ''}`);
  res.offenders.forEach((o) => console.log('  ' + o));
  if (res.sw > res.vw) bad = true;
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);

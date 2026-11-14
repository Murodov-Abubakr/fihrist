// Measures idle main-thread load over 3 s (dev helper for animation cost).
// Vsync is disabled so frames are produced even when the host display is asleep/locked;
// the page itself runs no measurement loop, so only the app's own work is counted.
// Usage: node scripts/fps.mjs [baseUrl] [width] [cpuThrottle] [reduce]
import puppeteer from 'puppeteer-core';
const base = process.argv[2] ?? 'http://localhost:4174';
const width = +(process.argv[3] ?? 1440);
const throttle = +(process.argv[4] ?? 1);
const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
});
const p = await b.newPage();
await p.setViewport({ width, height: width > 600 ? 900 : 844 });
const cdp = await p.createCDPSession();
if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
if (process.argv[5] === 'reduce') await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await p.goto(base, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 3000));
const m0 = await p.metrics();
const tl0 = await p.evaluate(() => document.timeline.currentTime);
await new Promise((r) => setTimeout(r, 3000));
const m1 = await p.metrics();
const tl1 = await p.evaluate(() => document.timeline.currentTime);
console.log(
  `width=${width} throttle=${throttle}x ${process.argv[5] ?? ''}  main-thread busy=${(((m1.TaskDuration - m0.TaskDuration) / 3) * 100).toFixed(0)}%` +
  `  layouts=${m1.LayoutCount - m0.LayoutCount} styleRecalcs=${m1.RecalcStyleCount - m0.RecalcStyleCount}  timeline advanced=${((tl1 - tl0) / 1000).toFixed(1)}s`,
);
await b.close();

// Clicks "Run satellite analysis" for a non-preset point and waits for the cloud result.
// Needs `npx vite preview --port 4174` (CORS allows localhost:4174). Run: node scripts/check-cloud-sat.mjs
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', protocolTimeout: 400000 });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/simulate|404/.test(m.text()) && errors.push(m.text()));
page.on('requestfinished', (r) => { if (/azurewebsites/.test(r.url())) console.log(`  azure ${r.method()} ${r.response()?.status()}`); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t = Date.now();
const log = (s) => console.log(`${String(Math.round((Date.now() - t) / 1000)).padStart(4)} s  ${s}`);
await page.goto('http://localhost:4174/?app', { waitUntil: 'networkidle0', timeout: 60000 });
log('loaded');
await page.click('input[role="combobox"]');
await page.keyboard.type('38.53, 68.56', { delay: 20 });
await sleep(500);
await page.keyboard.press('Enter');
// poll in short evaluate calls so a busy page cannot hang one long call
let clicked = false, done = false;
for (let i = 0; i < 120 && !done; i++) {
  await sleep(2000);
  const s = await page.evaluate(() => {
    const status = [...document.querySelectorAll('[role="status"],[role="alert"]')].map((e) => e.textContent).join(' | ').slice(0, 80);
    const btn = [...document.querySelectorAll('button')].find((b) => /Run satellite analysis|Reading 24 years/.test(b.textContent));
    const doneLine = [...document.querySelectorAll('p')].find((p) => /computed on demand in Azure/.test(p.textContent))?.textContent;
    const err = [...document.querySelectorAll('p')].find((p) => /did not finish|busy with another/.test(p.textContent))?.textContent;
    return { status, btn: btn?.textContent ?? null, doneLine: doneLine ?? null, err: err ?? null, hidden: /Hidden signals/i.test(document.body.textContent) };
  });
  if (i % 5 === 0) log(JSON.stringify(s).slice(0, 220));
  if (!clicked && s.btn && /Run satellite analysis/.test(s.btn)) {
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Run satellite analysis/.test(b.textContent)).click());
    clicked = true; log('clicked Run satellite analysis');
  }
  if (s.doneLine) { log(`DONE: ${s.doneLine} | hidden-signals panel: ${s.hidden}`); done = s.hidden; }
  if (s.err) { log(`ERROR shown: ${s.err}`); break; }
}
await page.screenshot({ path: 'screenshots/cloud-sat.png' });
if (errors.length) console.log('page errors:', errors.join(' | '));
await browser.close();
process.exit(done && !errors.length ? 0 : 1);

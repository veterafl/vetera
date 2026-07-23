// Visual QA driver for the Vetera Quick Check — drives the real inline search
// against the shipped dentists.json using the installed Chromium.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';

const EXEC = process.env.CHROME_PATH || `${os.homedir()}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const BASE = 'http://localhost:8848/index.html';
const OUT = '/tmp/vqa';
fs.mkdirSync(OUT, { recursive: true });

const scenarios = [
  { id: '1_same_name_davis',   q: 'Robert Davis', note: 'true same-name collision — cities must disambiguate' },
  { id: '2_adelson_mixed',     q: 'Adelson',      note: 'severe (revoked) + caution (past discipline) in one list' },
  { id: '3_honorific_patel',   q: 'Dr. Patel',    note: 'honorific stripped; capped at 50; narrow-down note' },
  { id: '4_no_results',        q: 'Zzqx Nobody',  note: 'no-results help + copy-to-portal button' },
  { id: '5_single_last',       q: 'Alzamora',     note: 'single revoked record' },
  { id: '6_oos_no_city',       q: 'Abaji',        note: 'out-of-state address of record → must show NO city, not "City, FL"' },
];

const consoleErrors = [];

const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

async function run(scn, mobile = false) {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  else await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.fill('#providerName', scn.q);
  await page.click('.home-btn[type="submit"]');
  // wait for results to render (heading appears) or no-results
  await page.waitForFunction(() => {
    const r = document.getElementById('searchResults');
    return r && /results-heading|results-status/.test(r.innerHTML) &&
           !/Looking up/.test(r.innerHTML);
  }, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  const file = `${OUT}/${scn.id}${mobile ? '_mobile' : ''}.png`;
  await page.screenshot({ path: file, fullPage: true });
  // scrape a compact summary of what rendered
  const summary = await page.evaluate(() => {
    const r = document.getElementById('searchResults');
    const heading = (r.querySelector('.results-heading')?.textContent || '').trim();
    const cards = [...r.querySelectorAll('.provider-card')].slice(0, 8).map(c => ({
      name: c.querySelector('h4')?.textContent?.trim(),
      city: c.querySelector('.provider-city')?.textContent?.trim() || '(no city)',
      status: c.querySelector('.fact-line span')?.textContent?.trim(),
      cls: c.className,
    }));
    const note = (r.querySelector('.results-note')?.textContent || '').trim();
    return { heading, count: r.querySelectorAll('.provider-card').length, note, cards };
  });
  return { file, summary };
}

const report = {};
for (const scn of scenarios) {
  report[scn.id] = { note: scn.note, ...(await run(scn)) };
}
// one mobile shot of the richest scenario
report['2_adelson_mixed_mobile'] = { note: 'mobile layout', ...(await run(scenarios[1], true)) };

report.consoleErrors = consoleErrors;
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();

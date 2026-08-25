import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright-core';

const PORT = 9235;

function devtoolsAlive(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}/json/version`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.setTimeout(600, () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function waitDevtools(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (await devtoolsAlive()) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('devtools no abrió');
}

if (!(await devtoolsAlive())) {
  const exe = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const dir = path.join(os.homedir(), '.comment-intelligence', 'profiles', 'instagram');
  fs.mkdirSync(dir, { recursive: true });
  spawn(exe, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--no-first-run', '--restore-last-session=false', 'about:blank'], { stdio: 'ignore' });
  await waitDevtools();
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => /instagram\.com\/(p|reel|reels)/.test(p.url()));
if (!page) {
  page = await ctx.newPage();
  await page.goto(process.argv[2] || 'https://www.instagram.com/reel/DaewCOHRnb6/', { timeout: 45000 });
}
if (!/\/(p|reel)\//.test(page.url()) && /\/reels\/$/.test(page.url())) {
  await page.goto('https://www.instagram.com/reel/DaewCOHRnb6/', { timeout: 45000 });
}
try {
  await page.waitForFunction(`document.body.innerText.includes('Responder')`, { timeout: 6000 });
} catch {
  const clicked = await page.evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll('button[aria-label], [role="button"][aria-label]'));
    const b = btns.find(x => /comentar|comment/i.test(x.getAttribute('aria-label') || ''));
    if (b) { b.click(); return b.getAttribute('aria-label'); }
    return null;
  })()`);
  console.error('click comentar:', clicked);
  await page.waitForFunction(`document.body.innerText.includes('Responder')`, { timeout: 20000 }).catch(() => {
    console.error('AVISO: comentarios nunca cargaron');
  });
}
await page.waitForTimeout(1500);

await page.waitForTimeout(2500);

const raw = `(() => {
  const respond = Array.from(document.querySelectorAll('span, div'))
    .filter(el => (el.textContent || '').trim() === 'Responder' && el.children.length === 0)
    .slice(0, 3);
  const rows = [];
  for (const r of respond) {
    let node = r;
    let picked = null;
    for (let i = 0; i < 8 && node.parentElement; i++) {
      node = node.parentElement;
      const t = (node.textContent || '').trim();
      const a = node.querySelectorAll('a[href^="/"]').length;
      if (t.length > 40 && a >= 1 && t.length < 600) { picked = node; }
      if (t.length >= 600) break;
    }
    if (picked) {
      rows.push({
        depthClass: String(picked.className).slice(0, 60),
        text: (picked.textContent || '').trim().slice(0, 200),
        html: picked.outerHTML.slice(0, 1100)
      });
    }
  }
  const likeSpans = Array.from(document.querySelectorAll('span'))
    .map(s => (s.textContent || '').trim())
    .filter(t => /^([\\d.]{1,7}|\\d{1,3}(\\.\\d{3})+|\\d+[.,]\\d+\\s*mil|[\\d.,]+\\s?[km]?)$/i.test(t));
  return JSON.stringify({
    url: location.href,
    respondCount: respond.length,
    rows,
    numericSpans: Array.from(new Set(likeSpans)).slice(0, 20)
  });
})()`;

const result = await page.evaluate(raw);
console.log(result.slice(0, 3400));
await browser.close();
process.exit(0);

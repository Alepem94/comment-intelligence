import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { chromium } from 'playwright-core';

const PORT = 9237;
const url = process.argv[2];

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
  const dir = path.join(os.homedir(), '.comment-intelligence', 'profiles', 'tiktok');
  fs.mkdirSync(dir, { recursive: true });
  spawn(exe, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--no-first-run', '--restore-last-session=false', 'about:blank'], { stdio: 'ignore' });
  await waitDevtools();
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => /tiktok\.com/.test(p.url()));
if (!page) page = await ctx.newPage();
if (url) {
  await page.goto(url, { timeout: 60000, waitUntil: 'domcontentloaded' });
}
try {
  await page.waitForFunction(`document.querySelectorAll('[data-e2e="comment-icon"]').length > 0`, { timeout: 45000 });
} catch {
  console.error('AVISO: comment-icon nunca apareció');
}
const clicked = await page.evaluate(`(() => {
  const icons = document.querySelectorAll('[data-e2e="comment-icon"]');
    if (icons.length) { icons[0].click(); return icons.length; }
  return 0;
})()`);
console.error('click comment-icon:', clicked);
try {
  await page.waitForSelector('[data-e2e="comment-list"]', { timeout: 25000 });
} catch {
  console.error('panel no apareció');
}
await page.waitForTimeout(3000);

const raw = `(() => {
  const e2e = {};
  for (const el of document.querySelectorAll('[data-e2e]')) {
    const k = el.getAttribute('data-e2e');
    e2e[k] = (e2e[k] || 0) + 1;
  }
  const list = document.querySelector('[data-e2e="comment-list"]');
  const items = list ? list.querySelectorAll('[data-e2e="comment-item"], [data-e2e="comment-reply-item"], [class*="CommentItem"]') : [];
  const firstItem = items[0];
  const itemE2E = [];
  const e2eNodes = list ? list.querySelectorAll('[data-e2e]') : [];
  for (let i = 0; i < e2eNodes.length && i < 20; i++) itemE2E.push(e2eNodes[i].getAttribute('data-e2e'));
  return JSON.stringify({
    url: location.href,
    title: document.title.slice(0, 60),
    commentClasses: (() => {
      const out = [];
      for (const x of document.querySelectorAll('[class*="omment"]')) out.push(String(x.className).slice(0, 50));
      return Array.from(new Set(out)).slice(0, 8);
    })(),
    commentList: !!list,
    listScroll: list ? { sh: list.scrollHeight, ch: list.clientHeight } : null,
    itemCount: items.length,
    itemE2E: itemE2E,
    firstItemHtml: firstItem ? firstItem.outerHTML.slice(0, 1100) : null,
    loginModal: !!document.querySelector('[class*="LoginModal"], [data-e2e="login-modal"]'),
    bodyStart: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 200)
  });
})()`;

console.log((await page.evaluate(raw)).slice(0, 2600));
await browser.close();
process.exit(0);

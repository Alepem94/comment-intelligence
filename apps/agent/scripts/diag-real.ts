import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { chromium } from 'playwright-core';

const PORT = 9235;
const url = process.argv[2] || 'https://www.instagram.com/reels/';

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
  const proc = spawn(exe, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  await waitDevtools();
  proc.on('exit', () => {});
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => /instagram\.com/.test(p.url()));
if (!page) {
  page = await ctx.newPage();
}
if (!/instagram\.com\/(p|reel|reels)/.test(page.url())) {
  await page.goto(url, { timeout: 45000 });
}
await page.waitForTimeout(4000);

const raw = `(() => {
  const q = (s) => document.querySelectorAll(s).length;
  const article = document.querySelector('article');
  const main = document.querySelector('main');
  const scrollables = [];
  for (const el of document.querySelectorAll('div, section')) {
    if (el.scrollHeight > el.clientHeight + 60 && el.clientHeight > 150) {
      scrollables.push({
        cls: String(el.className || '').slice(0, 70),
        sh: el.scrollHeight, ch: el.clientHeight,
        time: !!el.querySelector('time'),
        anchor: !!el.querySelector('a[href^="/"]')
      });
    }
  }
  const t0 = document.querySelector('time');
  const chain = [];
  let c = t0 ? t0.parentElement : null;
  for (let i = 0; i < 7 && c; i++) { chain.push(c.tagName + '|' + String(c.className).slice(0, 40)); c = c.parentElement; }
  return JSON.stringify({
    url: location.href,
    counts: {
      article: q('article'), main: q('main'), time: q('time'),
      ulInArticle: article ? article.querySelectorAll('ul').length : -1,
      liInArticle: article ? article.querySelectorAll('ul li').length : -1,
      anchors: q('a[href^="/"]'), dialog: q('[role="dialog"]'),
      svg: q('svg'), h1: q('h1')
    },
    scrollables: scrollables.slice(0, 10),
    timeParentChain: chain,
    snippet: (article || main || document.body).innerHTML.slice(0, 1500)
  });
})()`;

const result = await page.evaluate(raw);
console.log(result.slice(0, 3200));
await browser.close();

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { runHarvest } from '@ci/scraper-core';
import instagram from '../../../packages/scraper-core/src/adapters/instagram.ts';

const PORT = 9235;
const url = process.argv[2] || 'https://www.instagram.com/reel/DcRtEYdiGcu/';
const limit = parseInt(process.argv[3] || '100', 10);

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
  throw new Error('devtools');
}

if (!(await devtoolsAlive())) {
  const exe = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const dir = path.join(os.homedir(), '.comment-intelligence', 'profiles', 'instagram');
  spawn(exe, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--no-first-run', '--restore-last-session=false', 'about:blank'], { stdio: 'ignore' });
  await waitDevtools();
}
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];
const pwPage = await ctx.newPage();

const res = await runHarvest(
  { goto: (u, o) => pwPage.goto(u, { timeout: o?.timeout ?? 45000 }), evaluate: <R,>(f: string) => pwPage.evaluate<R>(f) },
  instagram,
  { url, platform: 'instagram', limit, includeReplies: true },
  { onProgress: (p) => console.error(`  progreso: ${p.found} | scroll ${p.scrolls}`) },
  { roundDelayMs: 500 }
);
await pwPage.close();
console.log('TOTAL:', res.comments.length);
console.log('respuestas:', res.comments.filter((c) => c.is_reply).length);
console.log('primeros:', res.comments.slice(0, 3).map((c) => '@' + c.username).join(', '));
await browser.close();
process.exit(0);

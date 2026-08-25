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

const page = {
  goto: (u: string, o?: { timeout?: number }) => pwPage.goto(u, { timeout: o?.timeout ?? 45000 }),
  evaluate: <R,>(fn: string) => pwPage.evaluate<R>(fn)
};

const result = await runHarvest(
  page,
  instagram,
  { url, platform: 'instagram', limit: 30, includeReplies: true },
  {
    onProgress: (p) => console.error(`progreso: ${p.found} encontrados (${p.duplicates} duplicados, scroll ${p.scrolls})`)
  },
  { roundDelayMs: 600 }
);
await pwPage.close();

console.log('TOTAL:', result.comments.length);
for (const c of result.comments.slice(0, 8)) {
  console.log(`@${c.username} | ${c.time_text ?? '-'} | ${c.likes ?? '-'} likes | resp=${c.reply_count ?? '-'}${c.is_reply ? ' | ES RESPUESTA' : ''} | ${String(c.text).slice(0, 60)}`);
}
await browser.close();
process.exit(0);

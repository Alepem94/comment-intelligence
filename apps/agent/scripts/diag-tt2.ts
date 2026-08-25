import { chromium } from 'playwright-core';
const b = await chromium.connectOverCDP('http://127.0.0.1:9237');
const ctx = b.contexts()[0];
const page = ctx.pages().find((p) => /tiktok/.test(p.url()));
const raw = `(() => {
  const labels = [];
  for (const el of document.querySelectorAll('button, [role="button"]')) {
    const l = el.getAttribute('aria-label');
    if (l) labels.push(l.slice(0, 45));
  }
  const containers = document.querySelectorAll('[data-e2e="recommend-list-item-container"]');
  const active = containers[containers.length - 1];
  const activeE2E = active ? Array.from(active.querySelectorAll('[data-e2e]')).slice(0, 24).map((x) => x.getAttribute('data-e2e')) : null;
  const dataE2EClicked = (() => {
    const icons = document.querySelectorAll('[data-e2e="comment-icon"]');
    if (icons.length) { icons[icons.length - 1].click(); return icons.length; }
    const byLabel = Array.from(document.querySelectorAll('[aria-label]')).find((x) => /comentar|comment/i.test(x.getAttribute('aria-label') || ''));
    if (byLabel) { byLabel.click(); return 'label:' + byLabel.getAttribute('aria-label'); }
    return 0;
  })();
  return JSON.stringify({ labels: labels.slice(0, 25), activeE2E, clicked: dataE2EClicked });
})()`;
console.log(await page.evaluate(raw));
await b.close();
process.exit(0);

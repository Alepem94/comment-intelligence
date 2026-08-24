import { BrowserManager } from '../src/browser';

const m = new BrowserManager();
try {
  const ctx = await m.getContext('instagram');
  console.log('SMOKE: contexto OK, tabs:', ctx.pages().length);
  await m.openForLogin('instagram');
  await new Promise((r) => setTimeout(r, 4000));
  const last = ctx.pages()[ctx.pages().length - 1];
  console.log('SMOKE: url actual =', last?.url());
  const page = await m.getPage('instagram');
  await page.goto('https://www.instagram.com/', { timeout: 30000 });
  const title = await page.title();
  console.log('SMOKE: evaluate/goto OK, titulo =', title.slice(0, 40));
  await page.close();
  await m.closeAll();
  console.log('SMOKE_OK');
} catch (err) {
  console.error('SMOKE_FAIL:', (err as Error).message);
  process.exit(1);
}

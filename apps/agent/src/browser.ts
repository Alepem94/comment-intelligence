import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page
} from 'playwright-core';
import { profilesRoot } from './config';
import type { Platform } from '@ci/shared';

const PLATFORM_HOME: Record<Platform, string> = {
  instagram: 'https://www.instagram.com/',
  facebook: 'https://www.facebook.com/',
  tiktok: 'https://www.tiktok.com/foryou'
};

const USE_PERSONAL = process.env.CI_USE_PERSONAL_CHROME === '1';

function personalUserDataDir(): string | null {
  const lad = process.env['LOCALAPPDATA'];
  if (!lad) return null;
  const candidates =
    process.platform === 'win32'
      ? [
          path.join(lad, 'Google', 'Chrome', 'User Data'),
          path.join(lad, 'Microsoft', 'Edge', 'User Data')
        ]
      : process.platform === 'darwin'
        ? [path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome')]
        : [
            path.join(os.homedir(), '.config', 'google-chrome'),
            path.join(os.homedir(), '.config', 'microsoft-edge')
          ];
  return (
    candidates.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    }) ?? null
  );
}

export type BrowserStatus = 'closed' | 'starting' | 'ready' | 'error';

interface SessionEntry {
  browser: Browser;
  proc: ChildProcess | null;
  port: number | null;
}

function candidateExecutables(): string[] {
  const list: string[] = [];
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const lad = process.env['LOCALAPPDATA'] || path.join(os.homedir(), 'AppData', 'Local');
  if (process.platform === 'win32') {
    list.push(
      path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(lad, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    );
  } else if (process.platform === 'darwin') {
    list.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else {
    list.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/microsoft-edge');
  }
  return list.filter((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}

function isPortFree(port: number, timeoutMs = 250): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    const done = (free: boolean) => {
      socket.destroy();
      resolve(free);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(false));
    socket.once('timeout', () => done(true));
    socket.once('error', () => done(true));
  });
}

function devtoolsAlive(port: number, timeoutMs = 600): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function waitForDevtools(port: number, proc?: ChildProcess | null, timeoutMs = 20000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (proc && proc.exitCode !== null) break;
    const info = await new Promise<{ ws?: string }>((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({});
          }
        });
      });
      req.setTimeout(1200, () => {
        req.destroy();
        resolve({});
      });
      req.on('error', () => resolve({}));
    });
    if (info.ws) return info.ws;
    if (proc && proc.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('El navegador no abrió su puerto de depuración.');
}

export class BrowserManager {
  private sessions = new Map<Platform, SessionEntry>();
  status: BrowserStatus = 'closed';
  lastError: string | null = null;

  private profileDir(platform: Platform): string {
    if (USE_PERSONAL) {
      const dir = personalUserDataDir();
      if (dir) return dir;
    }
    const dir = path.join(profilesRoot(), platform);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  async getContext(platform: Platform): Promise<BrowserContext> {
    const existing = this.sessions.get(platform);
    if (existing && existing.browser.isConnected()) {
      return this.defaultContext(existing.browser);
    }
    this.status = 'starting';
    this.lastError = null;

    try {
      const entry = await this.attachRealBrowser(platform);
      this.sessions.set(platform, entry);
      this.status = 'ready';
      console.log(`[browser] ${platform}: navegador REAL adjunto por CDP (puerto ${entry.port})`);
      entry.browser.on('disconnected', () => {
        this.sessions.delete(platform);
        if (this.sessions.size === 0) this.status = 'closed';
      });
      entry.proc?.on('exit', () => {
        this.sessions.delete(platform);
        if (this.sessions.size === 0) this.status = 'closed';
      });
      return this.defaultContext(entry.browser);
    } catch (err) {
      const attachErr = String((err as Error)?.message || err);
      this.lastError = attachErr;
      try {
        const ctx = await this.launchPlaywrightFallback(platform);
        this.status = 'ready';
        console.log(`[browser] ${platform}: FALLBACK automatizado (¡puede provocar captcha!) — ${attachErr.slice(0, 120)}`);
        return ctx;
      } catch (err2) {
        this.status = 'error';
        this.lastError = attachErr + ' | fallback: ' + String((err2 as Error)?.message || err2);
        throw new Error('BROWSER_ERROR: no se pudo abrir el navegador local. Instala Chrome o Edge. Detalle: ' + this.lastError);
      }
    }
  }

  private async attachRealBrowser(platform: Platform): Promise<SessionEntry> {
    const exe = candidateExecutables()[0];
    if (!exe) throw new Error('STAGE_EXE: Chrome/Edge no encontrados en rutas estándar');

    const userDataDir = this.profileDir(platform);
    const port = USE_PERSONAL ? 9222 : 9235 + ['instagram', 'facebook', 'tiktok'].indexOf(platform);

    if (await devtoolsAlive(port)) {
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 20000 });
      return { browser, proc: null, port };
    }

    if (!USE_PERSONAL) await this.killStaleForProfile(userDataDir);
    let proc = this.spawnBrowser(exe, port, userDataDir);

    try {
      await waitForDevtools(port, proc);
    } catch (firstErr) {
      proc.kill();
      if (USE_PERSONAL) {
        throw new Error(
          'BROWSER_ERROR: tu Chrome est\u00e1 abierto con ese perfil. Cierra TODAS las ventanas de Chrome (revisa la bandeja del sistema) y vuelve a pulsar el bot\u00f3n de la plataforma.'
        );
      }
      await this.killStaleForProfile(userDataDir);
      await new Promise((r) => setTimeout(r, 800));
      proc = this.spawnBrowser(exe, port, userDataDir);
      try {
        await waitForDevtools(port, proc);
      } catch (err) {
        proc.kill();
        throw new Error('STAGE_DEVTOOLS: ' + String((err as Error)?.message || err));
      }
    }

    let browser: Browser;
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
        timeout: 20000
      });
    } catch (err) {
      proc.kill();
      throw new Error('STAGE_CDP: ' + String((err as Error)?.message || err).slice(0, 200));
    }
    return { browser, proc, port };
  }

  private spawnBrowser(exe: string, port: number, userDataDir: string): ChildProcess {
    return spawn(
      exe,
      [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-features=DialMediaRouteProvider',
        '--restore-last-session=false',
        `--window-size=1380,940`,
        'about:blank'
      ],
      { stdio: 'ignore', detached: false }
    );
  }

  private async killStaleForProfile(dir: string): Promise<void> {
    if (process.platform !== 'win32' || USE_PERSONAL) return;
    const safeDir = dir.replace(/'/g, "''");
    const ps =
      `Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" | ` +
      `Where-Object { $_.CommandLine -like '*${safeDir}*' } | ` +
      `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    await new Promise<void>((resolve) => {
      const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore' });
      const t = setTimeout(resolve, 8000);
      p.on('exit', () => {
        clearTimeout(t);
        resolve();
      });
      p.on('error', () => {
        clearTimeout(t);
        resolve();
      });
    });
  }

  private defaultContext(browser: Browser): BrowserContext {
    const ctx = browser.contexts()[0];
    if (ctx) return ctx;
    throw new Error('El navegador no expuso contexto por CDP.');
  }

  private async launchPlaywrightFallback(platform: Platform): Promise<BrowserContext> {
    const channels = ['chrome', 'msedge'] as const;
    for (const channel of channels) {
      try {
        const ctx = await chromium.launchPersistentContext(this.profileDir(platform), {
          channel,
          headless: false,
          viewport: { width: 1380, height: 940 },
          args: ['--disable-blink-features=AutomationControlled'],
          ignoreDefaultArgs: ['--enable-automation']
        });
        ctx.on('close', () => this.sessions.delete(platform));
        return ctx;
      } catch {
        continue;
      }
    }
    throw new Error('fallback fallido');
  }

  async openForLogin(platform: Platform): Promise<void> {
    const ctx = await this.getContext(platform);
    let page = ctx.pages().find((p) => (p.url() === 'about:blank' || p.url() === '')) ?? null;
    if (!page) page = await ctx.newPage();
    await page.goto(PLATFORM_HOME[platform], { timeout: 45000 }).catch(() => undefined);
    await page.bringToFront().catch(() => undefined);
  }

  async getPage(platform: Platform): Promise<Page> {
    const ctx = await this.getContext(platform);
    return ctx.newPage();
  }

  async activePage(platform: Platform): Promise<Page | null> {
    try {
      const ctx = await this.getContext(platform);
      const pages = ctx.pages();
      return pages.length ? pages[pages.length - 1] : null;
    } catch {
      return null;
    }
  }

  async closeAll(): Promise<void> {
    const closed = new Set<Browser>();
    for (const [, entry] of this.sessions) {
      if (!closed.has(entry.browser)) {
        closed.add(entry.browser);
        try {
          await entry.browser.close();
        } catch {
          /* ignore */
        }
      }
      if (!USE_PERSONAL) {
        try {
          entry.proc?.kill();
        } catch {
          /* ignore */
        }
      }
    }
    this.sessions.clear();
    this.status = 'closed';
  }

  has(platform: Platform): boolean {
    return this.sessions.has(platform);
  }
}

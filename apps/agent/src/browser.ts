import path from 'node:path';
import fs from 'node:fs';
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import { profilesRoot } from './config';
import type { Platform } from '@ci/shared';

const PLATFORM_HOME: Record<Platform, string> = {
  instagram: 'https://www.instagram.com/',
  facebook: 'https://www.facebook.com/',
  tiktok: 'https://www.tiktok.com/foryou'
};

export type BrowserStatus = 'closed' | 'starting' | 'ready' | 'error';

const CHANNELS = ['chrome', 'msedge'] as const;

export class BrowserManager {
  private contexts = new Map<Platform, BrowserContext>();
  status: BrowserStatus = 'closed';
  lastError: string | null = null;

  private profileDir(platform: Platform): string {
    const dir = path.join(profilesRoot(), platform);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  async getContext(platform: Platform): Promise<BrowserContext> {
    const existing = this.contexts.get(platform);
    if (existing) return existing;
    this.status = 'starting';
    this.lastError = null;
    let lastErr: unknown = null;
    for (const channel of CHANNELS) {
      try {
        const ctx = await chromium.launchPersistentContext(this.profileDir(platform), {
          channel,
          headless: false,
          viewport: { width: 1380, height: 940 },
          args: ['--disable-blink-features=AutomationControlled']
        });
        this.contexts.set(platform, ctx);
        ctx.on('close', () => this.contexts.delete(platform));
        this.status = 'ready';
        return ctx;
      } catch (err) {
        lastErr = err;
      }
    }
    try {
      const ctx = await chromium.launchPersistentContext(this.profileDir(platform), {
        headless: false,
        viewport: { width: 1380, height: 940 }
      });
      this.contexts.set(platform, ctx);
      ctx.on('close', () => this.contexts.delete(platform));
      this.status = 'ready';
      return ctx;
    } catch (err) {
      lastErr = err;
    }
    this.status = 'error';
    this.lastError = String((lastErr as Error)?.message || lastErr || 'unknown');
    throw new Error('BROWSER_ERROR: no se pudo abrir el navegador local. Instala Chrome o Edge.');
  }

  async openForLogin(platform: Platform): Promise<void> {
    const ctx = await this.getContext(platform);
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(PLATFORM_HOME[platform], { timeout: 45000 }).catch(() => undefined);
    await page.bringToFront().catch(() => undefined);
  }

  async getPage(platform: Platform): Promise<Page> {
    const ctx = await this.getContext(platform);
    return ctx.newPage();
  }

  async activePage(platform: Platform): Promise<Page | null> {
    const ctx = this.contexts.get(platform);
    if (!ctx) return null;
    const pages = ctx.pages();
    return pages.length ? pages[pages.length - 1] : null;
  }

  async closeAll(): Promise<void> {
    for (const [, ctx] of this.contexts) {
      await ctx.close().catch(() => undefined);
    }
    this.contexts.clear();
    this.status = 'closed';
  }

  has(platform: Platform): boolean {
    return this.contexts.has(platform);
  }
}

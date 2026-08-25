import { CIError, extractPostId } from '@ci/shared';
import type { Platform, DiagnosticInfo, ExtractResult, ProgressInfo } from '@ci/shared';
import { getAdapter, runHarvest, rawToComments, type HarvestPageLike, type RawWithPlatform } from '@ci/scraper-core';
import type { BrowserManager } from './browser';

export interface RunnerEvents {
  onProgress: (p: ProgressInfo) => void;
}

export class HarvestRunner {
  private stopRequested = false;
  busy = false;

  constructor(private browsers: BrowserManager) {}

  requestStop(): void {
    this.stopRequested = true;
  }

  async diagnostic(platform: Platform): Promise<DiagnosticInfo> {
    const page = await this.browsers.activePage(platform);
    if (!page) {
      return {
        agent: 'CONNECTED',
        browser: 'CLOSED',
        platform,
        pageDetected: false,
        postDetected: false,
        loggedIn: null,
        commentContainerDetected: false,
        commentsInDom: 0,
        mutationObserverActive: false,
        scrolls: 0,
        status: 'NO_PAGE_OPEN',
        url: null
      };
    }
    const adapter = getAdapter(platform);
    const url = page.url();
    let probe: { pageDetected?: boolean; postDetected?: boolean; loggedIn?: boolean | null; commentContainerDetected?: boolean; commentsInDom?: number };
    try {
      probe = await page.evaluate(
        'typeof __name==="undefined"&&(window.__name=function(f){return f;});(' +
          adapter.pageProbe.toString() +
          ')()'
      );
    } catch (err) {
      throw new CIError('DOM_CHANGED', String((err as Error).message).slice(0, 200));
    }
    return {
      agent: 'CONNECTED',
      browser: 'READY',
      platform,
      pageDetected: !!probe.pageDetected,
      postDetected: !!probe.postDetected,
      loggedIn: probe.loggedIn ?? null,
      commentContainerDetected: !!probe.commentContainerDetected,
      commentsInDom: Number(probe.commentsInDom || 0),
      mutationObserverActive: false,
      scrolls: 0,
      status: this.busy ? 'RUNNING' : 'IDLE',
      url
    };
  }

  async extract(
    opts: { url: string; platform: Platform; limit: number; includeReplies: boolean },
    events: RunnerEvents
  ): Promise<ExtractResult> {
    if (this.busy) throw new CIError('INTERNAL', 'el agente ya est\u00e1 extrayendo');
    this.busy = true;
    this.stopRequested = false;
    try {
      const context = await this.browsers.getContext(opts.platform, { headless: true });
      const page = await context.newPage();
      const harvestPage: HarvestPageLike = {
        goto: (url, options) => page.goto(url, { timeout: options?.timeout ?? 45000 }),
        evaluate: <R,>(fn: string) => page.evaluate<R>(fn)
      };
      const result = await runHarvest(
        harvestPage,
        getAdapter(opts.platform),
        { ...opts, limit: Math.max(1, Math.min(50000, opts.limit)) },
        {
          shouldStop: () => this.stopRequested,
          onProgress: (p) => {
            events.onProgress({
              found: p.found,
              addedTotal: p.addedTotal,
              duplicates: p.duplicates,
              scrolls: p.scrolls,
              lastCommentText: p.lastCommentText,
              status: this.stopRequested ? 'stopping' : 'running'
            });
          }
        },
        { overallTimeoutMs: 240000 }
      );
      await page.close().catch(() => undefined);
      const postId = extractPostId(opts.url, opts.platform);
      return {
        comments: rawToComments(result.comments as RawWithPlatform[], opts.platform, opts.url, postId),
        diagnostics: result.diagnostics
      };
    } catch (err) {
      if (err instanceof CIError && err.code === 'NOT_LOGGED_IN') {
        await this.browsers.closePlatform(opts.platform).catch(() => undefined);
        await this.browsers.openForLogin(opts.platform).catch(() => undefined);
        throw new CIError('NOT_LOGGED_IN', 'ventana de login abierta');
      }
      throw err;
    } finally {
      this.busy = false;
    }
  }

  get stopping(): boolean {
    return this.stopRequested;
  }
}

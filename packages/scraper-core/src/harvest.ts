import { CIError, mergeComments } from '@ci/shared';
import type { Platform, RawComment, DiagnosticInfo } from '@ci/shared';
import type { Adapter, HarvestConfig, ProbeResult } from './adapters/base';
import { toRawWithPlatform, type RawWithPlatform } from './map';

export interface HarvestPageLike {
  goto(url: string, options?: { timeout?: number }): Promise<unknown>;
  evaluate<R>(pageFunction: string): Promise<R>;
}

export interface HarvestHooks {
  onProgress?: (info: {
    found: number;
    addedTotal: number;
    duplicates: number;
    scrolls: number;
    lastCommentText: string | null;
  }) => void;
  shouldStop?: () => boolean;
}

export interface HarvestResult {
  comments: RawWithPlatform[];
  diagnostics: DiagnosticInfo;
  rounds: number;
}

export const DEFAULT_HARVEST_CONFIG: HarvestConfig = {
  limit: 100,
  includeReplies: false,
  maxStallRounds: 6,
  roundDelayMs: 700,
  overallTimeoutMs: 180000
};

function serialize(fn: () => unknown): string {
  return '(' + fn.toString() + ')()';
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runHarvest(
  page: HarvestPageLike,
  adapter: Adapter,
  options: { url: string; platform: Platform; limit: number; includeReplies: boolean },
  hooks: HarvestHooks = {},
  config: Partial<HarvestConfig> = {}
): Promise<HarvestResult> {
  const cfg: HarvestConfig = { ...DEFAULT_HARVEST_CONFIG, ...config, limit: options.limit };
  const startedAt = Date.now();

  await page.goto(options.url, { timeout: 45000 });

  let probe: ProbeResult | null = null;
  const settleTimeoutMs = 30000;
  let settleRounds = 0;
  while (Date.now() - startedAt < settleTimeoutMs) {
    probe = await page.evaluate<Pick<ProbeResult, keyof ProbeResult>>(serialize(adapter.pageProbe));
    if (probe && probe.loggedIn === false) throw new CIError('NOT_LOGGED_IN');
    if (probe && probe.commentContainerDetected && probe.commentsInDom > 0) break;
    if (settleRounds >= 2) {
      const early: RawComment[] = await page.evaluate<RawComment[]>(serialize(adapter.pageExtract));
      if (early && early.length > 0) break;
    }
    settleRounds++;
    if (hooks.shouldStop && hooks.shouldStop()) throw new CIError('EXTRACTION_TIMEOUT', 'detenido antes de cargar comentarios');
    await sleep(800);
  }
  if (!probe) throw new CIError('DOM_CHANGED');
  if (!probe.postDetected && !probe.commentContainerDetected) throw new CIError('POST_NOT_FOUND');
  if (!probe.commentContainerDetected) throw new CIError('COMMENT_CONTAINER_NOT_FOUND');

  let collected: RawWithPlatform[] = [];
  let duplicatesTotal = 0;
  let scrolls = 0;
  let rounds = 0;
  let stallRounds = 0;
  let lastCount = -1;
  let lastCommentText: string | null = null;

  while (collected.length < cfg.limit && Date.now() - startedAt < cfg.overallTimeoutMs) {
    if (hooks.shouldStop && hooks.shouldStop()) break;
    rounds++;

    const raws: RawComment[] = await page.evaluate<RawComment[]>(serialize(adapter.pageExtract));
    const withPlatform = toRawWithPlatform(raws || [], options.platform);
    const res = mergeComments(collected, withPlatform);
    collected = res.merged as RawWithPlatform[];
    duplicatesTotal += res.duplicates;
    if (res.added > 0) {
      stallRounds = 0;
      const last = collected[collected.length - 1];
      lastCommentText = last ? String(last.text || '').slice(0, 120) : null;
    } else {
      stallRounds++;
    }

    if (typeof hooks.onProgress === 'function') {
      hooks.onProgress({
        found: collected.length,
        addedTotal: collected.length,
        duplicates: duplicatesTotal,
        scrolls,
        lastCommentText
      });
    }

    if (collected.length >= cfg.limit) break;

    if (cfg.includeReplies) {
      await page.evaluate<number>(serialize(adapter.pageOpenReplies));
      await sleep(cfg.roundDelayMs / 2);
    }

    const scrolled = await page.evaluate<boolean>(serialize(adapter.pageScrollStep));
    scrolls++;
    if (!scrolled) {
      if (stallRounds >= cfg.maxStallRounds) break;
      await sleep(cfg.roundDelayMs);
      continue;
    }
    await sleep(cfg.roundDelayMs);

    if (stallRounds >= cfg.maxStallRounds && collected.length === lastCount) break;
    lastCount = collected.length;
  }

  if (collected.length === 0 && Date.now() - startedAt >= cfg.overallTimeoutMs) {
    throw new CIError('EXTRACTION_TIMEOUT');
  }

  const endProbe = await page.evaluate<Pick<ProbeResult, keyof ProbeResult>>(serialize(adapter.pageProbe)).catch(() => null);
  const diagnostics: DiagnosticInfo = {
    agent: 'CONNECTED',
    browser: 'READY',
    platform: options.platform,
    pageDetected: endProbe?.pageDetected ?? true,
    postDetected: endProbe?.postDetected ?? true,
    loggedIn: endProbe?.loggedIn ?? null,
    commentContainerDetected: endProbe?.commentContainerDetected ?? true,
    commentsInDom: endProbe?.commentsInDom ?? collected.length,
    mutationObserverActive: false,
    scrolls,
    status: collected.length > 0 ? 'DONE' : 'NO_COMMENTS',
    url: options.url
  };

  return { comments: collected.slice(0, cfg.limit), diagnostics, rounds };
}

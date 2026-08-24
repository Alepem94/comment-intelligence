import type { Platform, RawComment } from '@ci/shared';

export interface ProbeResult {
  pageDetected: boolean;
  postDetected: boolean;
  loggedIn: boolean | null;
  commentContainerDetected: boolean;
  commentsInDom: number;
  mutationObserverActive: boolean;
}

export interface Adapter {
  platform: Platform;
  domains: string[];
  homeUrl: string;
  pageProbe(): ProbeResult;
  pageExtract(): RawComment[];
  pageScrollStep(): boolean;
  pageOpenReplies(): number;
}

export interface HarvestConfig {
  limit: number;
  includeReplies: boolean;
  maxStallRounds: number;
  roundDelayMs: number;
  overallTimeoutMs: number;
}

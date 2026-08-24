import type { Platform } from '@ci/shared';
import type { Adapter } from './base';
import instagram from './instagram';
import facebook from './facebook';
import tiktok from './tiktok';

export const adapters: Record<Platform, Adapter> = {
  instagram,
  facebook,
  tiktok
};

export function getAdapter(platform: Platform): Adapter {
  const a = adapters[platform];
  if (!a) throw new Error('PLATFORM_NOT_SUPPORTED: ' + platform);
  return a;
}

export * from './base';

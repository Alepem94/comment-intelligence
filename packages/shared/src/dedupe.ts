import type { RawComment } from './types';
import type { Platform } from './types';

export function fingerprint(platform: Platform, username: string | null | undefined, text: string | null | undefined, timestamp: string | null | undefined): string {
  const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  return [platform, norm(username), norm(text), norm(timestamp)].join('\u241f');
}

export function commentKey(c: RawComment & { platform: Platform }): string {
  return c.id ? `id\u241f${c.platform}\u241f${c.id}` : `fp\u241f${fingerprint(c.platform, c.username, c.text, c.datetime ?? c.time_text)}`;
}

export interface MergeResult<T> {
  merged: T[];
  added: number;
  duplicates: number;
}

export function mergeComments(existing: Array<RawComment & { platform: Platform }>, incoming: Array<RawComment & { platform: Platform }>): MergeResult<RawComment & { platform: Platform }> {
  const index = new Map<string, number>();
  existing.forEach((c, i) => index.set(commentKey(c), i));
  let added = 0;
  let duplicates = 0;
  for (const c of incoming) {
    const key = commentKey(c);
    const idx = index.get(key);
    if (idx !== undefined) {
      duplicates++;
      const cur = existing[idx];
      if (cur && needsEnrich(cur, c)) existing[idx] = enrich(cur, c);
    } else {
      index.set(key, existing.length);
      existing.push(c);
      added++;
    }
  }
  return { merged: existing, added, duplicates };
}

function needsEnrich(a: RawComment, b: RawComment): boolean {
  return (
    (a.likes == null && b.likes != null) ||
    (a.avatar == null && b.avatar != null) ||
    (!a.id && !!b.id) ||
    (a.likes != null && b.likes != null && b.likes !== a.likes)
  );
}

function enrich(a: RawComment, b: RawComment): RawComment & { platform: Platform } {
  const withPlatform = a as RawComment & { platform: Platform };
  withPlatform.likes = b.likes ?? a.likes ?? null;
  withPlatform.avatar = b.avatar ?? a.avatar ?? null;
  withPlatform.id = b.id ?? a.id ?? null;
  return withPlatform;
}

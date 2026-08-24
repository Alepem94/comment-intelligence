import type { Platform, RawComment } from '@ci/shared';

export interface RawWithPlatform extends RawComment {
  platform: Platform;
}

export function rawToComments(
  raws: RawWithPlatform[],
  platform: Platform,
  postUrl: string,
  postId: string | null
) {
  const now = new Date().toISOString();
  return raws.map((r) => ({
    platform,
    post_url: postUrl,
    post_id: postId,
    comment_id: r.id ?? null,
    username: r.username ?? null,
    display_name: r.display_name ?? null,
    profile_image_url: r.avatar ?? null,
    comment_text: (r.text ?? '').trim(),
    timestamp: r.datetime ?? r.time_text ?? null,
    likes: typeof r.likes === 'number' ? r.likes : null,
    replies_count: typeof r.reply_count === 'number' ? r.reply_count : null,
    parent_comment_id: r.parent_id ?? null,
    is_reply: !!r.is_reply,
    scraped_at: now
  }));
}

export function toRawWithPlatform(raws: RawComment[], platform: Platform): RawWithPlatform[] {
  return raws.map((r) => ({ ...r, platform }));
}

import { COMMENT_CSV_COLUMNS, toCsv } from '@ci/shared';
import type { Comment } from '@ci/shared';

export function commentsToRows(comments: Comment[]): Array<Record<string, unknown>> {
  return comments.map((c) => ({
    platform: c.platform,
    post_url: c.post_url,
    post_id: c.post_id,
    comment_id: c.comment_id,
    username: c.username,
    display_name: c.display_name,
    comment_text: c.comment_text,
    likes: c.likes,
    timestamp: c.timestamp,
    replies_count: c.replies_count,
    parent_comment_id: c.parent_comment_id,
    is_reply: c.is_reply,
    scraped_at: c.scraped_at
  }));
}

export function buildCsv(comments: Comment[], includeBom = true): string {
  return toCsv(commentsToRows(comments), COMMENT_CSV_COLUMNS, includeBom);
}

export function downloadFile(content: string | Blob, filename: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function slugify(s: string, max = 40): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max) || 'export'
  );
}

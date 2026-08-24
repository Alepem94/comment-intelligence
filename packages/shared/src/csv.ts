export const COMMENT_CSV_COLUMNS = [
  'platform',
  'post_url',
  'post_id',
  'comment_id',
  'username',
  'display_name',
  'comment_text',
  'likes',
  'timestamp',
  'replies_count',
  'parent_comment_id',
  'is_reply',
  'scraped_at'
] as const;

export function escapeCsvField(value: unknown): string {
  let s: string;
  if (value == null) s = '';
  else if (typeof value === 'boolean') s = value ? 'true' : 'false';
  else s = String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns?: readonly string[], includeBom = true): string {
  const cols = columns ?? (rows.length ? Object.keys(rows[0]) : []);
  const lines: string[] = [];
  lines.push(cols.map(escapeCsvField).join(','));
  for (const row of rows) {
    lines.push(cols.map((c) => escapeCsvField(row[c])).join(','));
  }
  const body = lines.join('\r\n');
  return includeBom ? '\uFEFF' + body : body;
}

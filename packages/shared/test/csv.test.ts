import { describe, expect, it } from 'vitest';
import { toCsv, escapeCsvField } from '../src/csv';

describe('csv', () => {
  it('escapes commas quotes and newlines', () => {
    expect(escapeCsvField('hola')).toBe('hola');
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('el "mejor"')).toBe('"el ""best"""'.replace('best', 'mejor'));
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvField(null)).toBe('');
  });

  it('builds utf-8 csv with bom, emojis and accents', () => {
    const csv = toCsv([
      { username: 'ana', comment_text: 'Me encant\u00f3 \ud83d\ude0d\u2764\ufe0f' },
      { username: 'jose', comment_text: 'qu\u00e9 bueno' }
    ], ['username', 'comment_text']);
    const rows = csv.split('\r\n');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(rows[0]).toBe('\uFEFFusername,comment_text');
    expect(rows[1]).toContain('\ud83d\ude0d');
  });

  it('serializes booleans and nulls', () => {
    const csv = toCsv([{ is_reply: true, likes: null }], ['is_reply', 'likes'], false);
    expect(csv).toBe('is_reply,likes\r\ntrue,');
  });
});

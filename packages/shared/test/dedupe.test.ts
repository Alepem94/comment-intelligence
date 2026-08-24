import { describe, expect, it } from 'vitest';
import { fingerprint, commentKey, mergeComments } from '../src/dedupe';
import type { RawComment } from '../src/types';

type C = RawComment & { platform: 'instagram' };

const mk = (over: Partial<RawComment>): C => ({ platform: 'instagram', ...over });

describe('fingerprint', () => {
  it('normalizes whitespace and case', () => {
    expect(fingerprint('instagram', 'User', 'Hola  MUNDO', '2 h')).toBe(fingerprint('instagram', ' user ', 'hola mundo', '2 H'));
  });
});

describe('mergeComments', () => {
  it('dedupes by id when present across rerenders', () => {
    let list: C[] = [];
    const a = mk({ id: 'c1', username: 'u1', text: 'hola', likes: 3 });
    const b = mk({ id: 'c1', username: 'u1', text: 'hola', likes: 5 });
    const r1 = mergeComments(list, [a]);
    list = r1.merged as C[];
    const r2 = mergeComments(list, [b]);
    list = r2.merged as C[];
    expect(list.length).toBe(1);
    expect(r2.added).toBe(0);
    expect(r2.duplicates).toBe(1);
    expect(list[0].likes).toBe(5);
  });

  it('dedupes by fingerprint when no id (virtualization duplicates)', () => {
    const x = mk({ username: 'ana', text: 'Me encant\u00f3 \ud83d\ude0d', datetime: '2024-01-01' });
    const y = mk({ username: 'ana', text: 'me encant\u00f3 \ud83d\ude0d ', datetime: '2024-01-01' });
    const res = mergeComments([x], [y]);
    expect(res.merged.length).toBe(1);
  });

  it('keeps distinct comments with same text different users', () => {
    const res = mergeComments([], [mk({ username: 'a', text: 'igual' }), mk({ username: 'b', text: 'igual' })]);
    expect(res.merged.length).toBe(2);
  });

  it('uses key priority for ids over fingerprints', () => {
    expect(commentKey(mk({ id: 'x', username: 'a', text: 't' }))).toContain('id\u241f');
  });
});

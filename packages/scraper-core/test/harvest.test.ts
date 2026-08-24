// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runHarvest, type HarvestPageLike } from '../src/harvest';
import { rawToComments, toRawWithPlatform } from '../src/map';
import instagram from '../src/adapters/instagram';

const FIX = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');

function makeFakePage(html: string): HarvestPageLike & { gotoCalls: string[] } {
  const gotoCalls: string[] = [];
  return {
    gotoCalls,
    async goto(url: string) {
      gotoCalls.push(url);
      document.documentElement.innerHTML = html;
    },
    async evaluate<R>(src: string): Promise<R> {
      return (0, eval)(src) as R;
    }
  };
}

describe('runHarvest with fake page over instagram fixture', () => {
  it('collects comments, dedupes across rounds and reports progress', async () => {
    document.documentElement.innerHTML = FIX('instagram.html');
    const page = makeFakePage(FIX('instagram.html'));
    const progress: number[] = [];
    const res = await runHarvest(
      page,
      instagram,
      { url: 'https://www.instagram.com/reel/CxAbC123/', platform: 'instagram', limit: 100, includeReplies: true },
      { onProgress: (p) => progress.push(p.found) },
      { roundDelayMs: 1, maxStallRounds: 2 }
    );
    expect(page.gotoCalls).toEqual(['https://www.instagram.com/reel/CxAbC123/']);
    expect(res.comments.length).toBe(5);
    expect(progress.length).toBeGreaterThan(0);
    expect(res.diagnostics.platform).toBe('instagram');
  }, 20000);

  it('respects limit', async () => {
    const page = makeFakePage(FIX('instagram.html'));
    const res = await runHarvest(
      page,
      instagram,
      { url: 'https://www.instagram.com/p/Cxyz/', platform: 'instagram', limit: 3, includeReplies: false },
      {},
      { roundDelayMs: 1 }
    );
    expect(res.comments.length).toBe(3);
  }, 20000);

  it('throws NOT_LOGGED_IN when login wall present', async () => {
    const loginHtml = '<html><body><form action="/accounts/login/"><input name="username"></form></body></html>';
    const page = makeFakePage(loginHtml);
    await expect(
      runHarvest(page, instagram, { url: 'https://www.instagram.com/reel/x/', platform: 'instagram', limit: 10, includeReplies: false }, {}, { roundDelayMs: 1 })
    ).rejects.toMatchObject({ code: 'NOT_LOGGED_IN' });
  }, 20000);
});

describe('rawToComments mapping', () => {
  it('fills all canonical fields without inventing data', () => {
    const raw = toRawWithPlatform([{ username: 'ana', text: 'hola', likes: null, avatar: null }], 'instagram');
    const c = rawToComments(raw, 'instagram', 'https://www.instagram.com/p/abc/', 'abc')[0];
    expect(c.comment_id).toBeNull();
    expect(c.likes).toBeNull();
    expect(c.is_reply).toBe(false);
    expect(c.post_url).toBe('https://www.instagram.com/p/abc/');
    expect(c.scraped_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Object.keys(c)).toEqual([
      'platform', 'post_url', 'post_id', 'comment_id', 'username', 'display_name',
      'profile_image_url', 'comment_text', 'timestamp', 'likes', 'replies_count',
      'parent_comment_id', 'is_reply', 'scraped_at'
    ]);
  });
});

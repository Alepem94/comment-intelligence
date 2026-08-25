import type { Platform } from './types';

const PATTERNS: Array<{ platform: Platform; re: RegExp }> = [
  { platform: 'instagram', re: /^https?:\/\/(www\.|m\.)?instagram\.com\/(reel|reels|p)\/[A-Za-z0-9_-]+/i },
  { platform: 'facebook', re: /^https?:\/\/(www\.|m\.|web\.)?facebook\.com\/([^/?]+\/(posts|videos|photos|reel)\/|watch\/?\?v=|photo(\.php)?\/?(\?fbid=)?|story\.php\?|permalink\.php\?|share\/[pvr]\/|groups\/[^/?]+\/(posts|videos)\/)/i },
  { platform: 'tiktok', re: /^https?:\/\/(www\.|m\.)?tiktok\.com\/(@[\w.\-]+\/video\/\d+|v\/\d+)/i }
];

export function detectPlatform(url: string): Platform | null {
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return null;
  for (const p of PATTERNS) {
    if (p.re.test(u)) return p.platform;
  }
  return null;
}

export function normalizePostUrl(rawUrl: string, platform: Platform): string {
  try {
    const u = new URL(rawUrl.trim());
    u.hash = '';
    if (platform === 'instagram') {
      const m = u.pathname.match(/\/(reel|reels|p)\/([A-Za-z0-9_-]+)/);
      if (m) return `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/`;
      return `https://www.instagram.com${u.pathname}`;
    }
    if (platform === 'facebook') return `https://www.facebook.com${u.pathname}${u.search}`;
    if (platform === 'tiktok') {
      const m = u.pathname.match(/(@[\w.\-]+)\/video\/(\d+)/);
      if (m) return `https://www.tiktok.com/${m[1]}/video/${m[2]}`;
      return `https://www.tiktok.com${u.pathname}`;
    }
    return rawUrl.trim();
  } catch {
    return rawUrl.trim();
  }
}

export function extractPostId(rawUrl: string, platform: Platform): string | null {
  try {
    const u = new URL(rawUrl.trim());
    if (platform === 'instagram') {
      const m = u.pathname.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
      return m ? m[1] : null;
    }
    if (platform === 'tiktok') {
      const m = u.pathname.match(/\/video\/(\d+)/);
      return m ? m[1] : null;
    }
    if (platform === 'facebook') {
      const v = u.searchParams.get('v');
      if (v) return v;
      const storyFbid = u.searchParams.get('story_fbid');
      if (storyFbid) return storyFbid;
      const m = u.pathname.match(/\/(?:posts|videos|photos|reel|share\/p|share\/v)\/([^/?]+)/);
      return m ? m[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

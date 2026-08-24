import { describe, expect, it } from 'vitest';
import { detectPlatform, normalizePostUrl, extractPostId } from '../src/urls';

describe('detectPlatform', () => {
  it.each([
    ['https://www.instagram.com/reel/CxAbCdEf123/', 'instagram'],
    ['https://instagram.com/p/Cxyz_-1/', 'instagram'],
    ['https://www.instagram.com/reels/Db12Xy/', 'instagram'],
    ['https://www.facebook.com/100064/posts/pfbid02ABCxyz/', 'facebook'],
    ['https://www.facebook.com/watch/?v=1234567890', 'facebook'],
    ['https://facebook.com/somepage/videos/987654/ ', 'facebook'],
    ['https://www.tiktok.com/@user.name/video/7301234567890123456', 'tiktok'],
    ['https://m.tiktok.com/v/7301234567890123456.html', 'tiktok']
  ])('detects %s as %s', (url, expected) => {
    expect(detectPlatform(url)).toBe(expected);
  });

  it.each([
    '',
    'not a url',
    'https://twitter.com/x/status/1',
    'https://www.google.com'
  ])('rejects %s', (url) => {
    expect(detectPlatform(url)).toBeNull();
  });
});

describe('normalizePostUrl + extractPostId', () => {
  it('normalizes instagram reels', () => {
    expect(normalizePostUrl('https://www.instagram.com/reels/CxAbC123/?igsh=abc#frag', 'instagram')).toBe('https://www.instagram.com/reel/CxAbC123/');
    expect(extractPostId('https://www.instagram.com/reel/CxAbC123/', 'instagram')).toBe('CxAbC123');
  });
  it('normalizes tiktok videos', () => {
    expect(normalizePostUrl('https://www.tiktok.com/@a.b-c/video/7301234567890123456?is_copy=1', 'tiktok')).toBe('https://www.tiktok.com/@a.b-c/video/7301234567890123456');
    expect(extractPostId('https://www.tiktok.com/@a.b-c/video/7301234567890123456', 'tiktok')).toBe('7301234567890123456');
  });
  it('extracts facebook video id from watch urls', () => {
    expect(extractPostId('https://www.facebook.com/watch/?v=1234567890', 'facebook')).toBe('1234567890');
  });
});

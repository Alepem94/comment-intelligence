// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ig from '../src/adapters/instagram';
import * as fb from '../src/adapters/facebook';
import * as tt from '../src/adapters/tiktok';

const FIX = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');

function loadFixture(name: string) {
  const html = FIX(name);
  document.documentElement.innerHTML = html;
}

function evalInPage(fn: () => unknown): unknown {
  const src = '(' + fn.toString() + ')()';
  return (0, eval)(src);
}

describe('InstagramAdapter', () => {
  beforeEach(() => loadFixture('instagram.html'));

  it('extracts top-level comments and replies with real fixture data', () => {
    const out = ig.pageExtract();
    expect(out.length).toBe(5);
    expect(out.find((c) => c.username === 'brand.oficial')?.text).toContain('\u00a1Gracias Mar\u00eda!');
    expect(out.find((c) => c.username === 'maria.gomez')?.text).toContain('Me encant');
    expect(out.filter((c) => c.is_reply).length).toBe(2);
    expect(out.find((c) => c.username === 'carla_ruiz')?.likes).toBe(145);
    expect(out.find((c) => c.username === 'marketing.tips')?.likes).toBe(1204);
  });

  it('parses iso timestamps and avatar urls', () => {
    const out = ig.pageExtract();
    const carla = out.find((c) => c.username === 'carla_ruiz');
    expect(carla?.datetime).toBe('2026-08-21T18:45:00.000Z');
    expect(String(carla?.avatar)).toContain('carla.jpg');
  });

  it('is fully self-contained when serialized', () => {
    const serialized = evalInPage(ig.pageExtract) as ReturnType<typeof ig.pageExtract>;
    expect(serialized.length).toBe(5);
    expect((serialized as Array<{ username: string }>)[0].username).toBeTruthy();
  });
});

describe('FacebookAdapter', () => {
  beforeEach(() => loadFixture('facebook.html'));

  it('extracts comments with comment_id from permalinks', () => {
    const out = fb.pageExtract();
    expect(out.map((c) => c.id).sort()).toEqual(['1001', '1002', '1003', '2001']);
    expect(out.length).toBe(4);
  });

  it('maps replies to parents', () => {
    const out = fb.pageExtract();
    const reply = out.find((c) => c.id === '2001');
    expect(reply?.is_reply).toBe(true);
    expect(reply?.parent_id).toBe('1001');
  });

  it('extracts author, text, likes and avatar without mixing siblings', () => {
    const out = fb.pageExtract();
    const jose = out.find((c) => c.id === '1001');
    expect(jose?.display_name).toBe('Jos\u00e9 P\u00e9rez');
    expect(jose?.text).toContain('Excelente contenido');
    expect(jose?.text).not.toContain('Mar\u00eda');
    expect(jose?.time_text).toBe('5 h');
    expect(jose?.avatar).toContain('jose.jpg');
    const lucia = out.find((c) => c.id === '1003');
    expect(lucia?.likes).toBe(24);
    expect(out.find((c) => c.id === '2001')?.display_name).toBe('Mar\u00eda L\u00f3pez');
  });

  it('is fully self-contained when serialized', () => {
    const serialized = evalInPage(fb.pageExtract) as Array<{ id: string }>;
    expect(serialized.map((c) => c.id).sort()).toEqual(['1001', '1002', '1003', '2001']);
  });
});

describe('TikTokAdapter', () => {
  beforeEach(() => loadFixture('tiktok.html'));

  it('extracts items from data-e2e containers', () => {
    const out = tt.pageExtract();
    expect(out.length).toBe(4);
    expect(out.find((c) => c.username === 'laura.dev')?.text).toContain('justo lo que buscaba');
    expect(out.find((c) => c.username === 'diego_mtz')?.likes).toBe(1200);
  });

  it('marks reply items', () => {
    const out = tt.pageExtract();
    expect(out.filter((c) => c.is_reply).length).toBe(1);
    expect(out.find((c) => c.username === 'brand.oficial')?.is_reply).toBe(true);
  });

  it('parses time text and avatars', () => {
    const out = tt.pageExtract();
    expect(out.find((c) => c.username === 'sofia.tt')?.time_text).toBe('3 h');
    expect(String(out.find((c) => c.username === 'laura.dev')?.avatar)).toContain('tiktokcdn.com');
  });

  it('is fully self-contained when serialized', () => {
    const serialized = evalInPage(tt.pageExtract) as unknown[];
    expect(serialized.length).toBe(4);
  });
});

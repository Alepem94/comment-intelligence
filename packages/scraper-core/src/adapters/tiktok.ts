import type { Adapter, ProbeResult } from './base';
import type { RawComment } from '@ci/shared';

export function pageProbe(): ProbeResult {
  const d = document;
  const loginModal = !!d.querySelector('[class*="LoginModal"], [data-e2e="login-modal"]');
  const hasVideo = !!d.querySelector('video, [data-e2e="video-player"], [class*="video-player"]');
  let container = false;
  const list = d.querySelector('[data-e2e="comment-list"]') as HTMLElement | null;
  if (list) container = true;
  if (!container) {
    const els = Array.prototype.slice.call(d.querySelectorAll('body *')) as HTMLElement[];
    for (const el of els) {
      if (el.scrollHeight > el.clientHeight + 120 && el.clientHeight > 250 && el.clientWidth < window.innerWidth * 0.6) {
        if (el.querySelector('a[href^="/@"], img[src*="tiktokcdn"]')) { container = true; break; }
      }
    }
  }
  const commentsInDom = d.querySelectorAll('[data-e2e="comment-item"]').length;
  return {
    pageDetected: /tiktok\.com$/.test(location.hostname),
    postDetected: hasVideo,
    loggedIn: !loginModal,
    commentContainerDetected: container || commentsInDom > 0,
    commentsInDom,
    mutationObserverActive: false
  };
}

export function pageExtract(): RawComment[] {
  const norm = (s: unknown): string => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
  const parseCount = (s: unknown): number | null => {
    if (!s) return null;
    const t = String(s).replace(/\u00a0/g, ' ').toLowerCase().trim();
    const m = t.match(/^([\d.,]+)\s*(mil|[km])?$/i);
    if (!m) return null;
    let num = m[1].replace(/\s/g, '');
    if (num.indexOf('.') < 0 && /,\d{1,2}(\D|$)/.test(num)) num = num.replace(',', '.');
    num = num.replace(/[.,](?=\d{3}(\D|$))/g, '');
    let n = parseFloat(num);
    if (isNaN(n)) return null;
    const suf = (m[2] || '').toLowerCase();
    if (suf === 'k') n *= 1000;
    else if (suf === 'm') n *= 1000000;
    else if (suf === 'mil') n *= 1000;
    return Math.round(n);
  };

  const items = Array.prototype.slice.call(
    document.querySelectorAll(
      '[data-e2e="comment-item"], [data-e2e="comment-reply-item"], [class*="DivCommentItemContainer"]'
    )
  ) as HTMLElement[];

  const out: RawComment[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (!item || item.nodeType !== 1) continue;

    let username: string | null = null;
    let displayName: string | null = null;
    const userEl = item.querySelector('[data-e2e="comment-user-name"], a[href^="/@"]');
    if (userEl) {
      const href = userEl.getAttribute ? userEl.getAttribute('href') : null;
      if (href && href.indexOf('/@') === 0) username = href.slice(2).split('?')[0];
      displayName = norm(userEl.textContent);
      if (!username && displayName) username = displayName.replace(/^@/, '') || null;
    }

    let text = '';
    const textEl = item.querySelector('[data-e2e="comment-text"]');
    if (textEl) text = norm(textEl.textContent);
    if (!text) {
      const blocks = item.querySelectorAll('[class*="SpanText"], p');
      for (let i = 0; i < blocks.length; i++) {
        const bt = norm(blocks[i].textContent);
        if (!bt || bt === displayName) continue;
        if (/^\d+(\.\d+)?\s*(k|m|mil)?$/i.test(bt)) continue;
        if (bt.length > text.length) text = bt;
      }
    }
    if (!text) continue;

    let avatar: string | null = null;
    const imgs = item.querySelectorAll('img');
    for (let i = 0; i < imgs.length; i++) {
      const im = imgs[i] as HTMLImageElement;
      const src = im.currentSrc || im.getAttribute('src') || '';
      if (src && src.indexOf('http') === 0 && src.indexOf('emoji') < 0) { avatar = src; break; }
    }

    let likes: number | null = null;
    const likeEl = item.querySelector('[data-e2e="comment-like-count"], [class*="LikeCount"] strong, strong');
    if (likeEl) likes = parseCount(norm(likeEl.textContent));
    if (likes == null) {
      const spans = item.querySelectorAll('span');
      for (let i = 0; i < spans.length; i++) {
        const st = norm(spans[i].textContent);
        if (/^\d{1,5}\s*(k|m|mil)?$/i.test(st)) { likes = parseCount(st); break; }
      }
    }

    let timeText: string | null = null;
    const timeSpans = item.querySelectorAll('span');
    for (let i = 0; i < timeSpans.length; i++) {
      const st = norm(timeSpans[i].textContent);
      if (
        /^(\d+\s*(segundos?|minutos?|horas?|d\u00edas?|semanas?|meses|a\u00f1os?|seconds?|minutes?|hours?|days?|weeks?|months?|years?|[smhdw]))(\s+ago|\s*-\s*.*)?$/i.test(st) &&
        st.length <= 40
      ) {
        timeText = st;
        break;
      }
    }

    const e2e = item.getAttribute('data-e2e') || '';
    const cls = typeof item.className === 'string' ? item.className : '';
    const isReply = /reply/i.test(e2e) || /Reply/i.test(cls);

    const key = norm(username) + '\u241f' + norm(text).slice(0, 140) + '\u241f' + norm(timeText);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      id: null,
      parent_id: null,
      is_reply: isReply,
      username: username,
      display_name: displayName,
      avatar: avatar,
      text: text,
      datetime: null,
      time_text: timeText,
      likes: likes,
      reply_count: null
    });
  }
  return out;
}

export function pageScrollStep(): boolean {
  let best: HTMLElement | null = document.querySelector('[data-e2e="comment-list"]');
  if (!best) {
    const els = Array.prototype.slice.call(document.querySelectorAll('body *')) as HTMLElement[];
    let bestScore = 0;
    for (const el of els) {
      const st = getComputedStyle(el);
      const oy = st.overflowY;
      if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') continue;
      const gap = el.scrollHeight - el.clientHeight;
      if (gap < 80 || el.clientHeight < 250) continue;
      if (el.clientWidth >= window.innerWidth * 0.9) continue;
      const score = gap * Math.min(1, el.clientHeight / 700);
      if (score > bestScore) { bestScore = score; best = el; }
    }
  }
  if (!best) return false;
  const before = best.scrollTop;
  best.scrollBy(0, Math.max(300, Math.round(best.clientHeight * 0.85)));
  return best.scrollTop > before + 4;
}

export function pageOpenReplies(): number {
  let clicked = 0;
  const btns = document.querySelectorAll('[data-e2e="comment-expand-btn"], [role="button"], button');
  for (let i = 0; i < btns.length; i++) {
    if (clicked >= 10) break;
    const b = btns[i] as HTMLElement;
    const t = ((b.innerText || b.textContent || '') + '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!t || t.length > 60) continue;
    if (
      /^(ver respuestas|view replies|m\u00e1s respuestas|more replies)/.test(t) ||
      /^(ver|view|see)\s+\d+\s+(respuestas|replies)/.test(t)
    ) {
      b.click();
      clicked++;
    }
  }
  return clicked;
}

const adapter: Adapter = {
  platform: 'tiktok',
  domains: ['tiktok.com'],
  homeUrl: 'https://www.tiktok.com/foryou',
  pageProbe,
  pageExtract,
  pageScrollStep,
  pageOpenReplies
};
export default adapter;

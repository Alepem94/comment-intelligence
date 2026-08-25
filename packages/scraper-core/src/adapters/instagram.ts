import type { Adapter, ProbeResult } from './base';
import type { RawComment } from '@ci/shared';

export function pageProbe(): ProbeResult {
  const d = document;
  const responders = Array.prototype.slice.call(d.querySelectorAll('span, div, button')).filter(
    (el: Element) => el.children.length === 0 && (el.textContent || '').trim() === 'Responder'
  );
  const loginWall =
    !!d.querySelector('input[name="username"], form[action*="/accounts/login/"]') ||
    /iniciar sesi\u00f3n para continuar|log in to continue/i.test((d.body && d.body.innerText.slice(0, 2000)) || '');
  const postDetected = /\/(p|reel|reels|tv)\//.test(location.pathname);
  const commentsInDom = responders.length;
  let container = false;
  const els = Array.prototype.slice.call(d.querySelectorAll('div, section')) as HTMLElement[];
  for (const el of els) {
    if (el.scrollHeight > el.clientHeight + 60 && el.clientHeight > 150) {
      if (responders.some((r) => el.contains(r))) { container = true; break; }
    }
  }
  return {
    pageDetected: /instagram\.com$/.test(location.hostname),
    postDetected,
    loggedIn: !loginWall,
    commentContainerDetected: container || commentsInDom > 0,
    commentsInDom,
    mutationObserverActive: false
  };
}

export function pageExtract(): RawComment[] {
  const norm = (s: unknown): string => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
  const RESERVED = ['p', 'reel', 'reels', 'tv', 'explore', 'stories', 'accounts', 'about', 'direct', 'your_activity'];
  const isProfileHref = (href: string | null | undefined): boolean => {
    if (!href || href.charAt(0) !== '/') return false;
    const m = href.match(/^\/([^/?#]+)\/?$/);
    return !!m && RESERVED.indexOf(m[1].toLowerCase()) === -1;
  };
  const parseCount = (s: unknown): number | null => {
    if (!s) return null;
    const t = String(s).replace(/\u00a0/g, ' ').toLowerCase().trim();
    const m = t.match(/([\d.,]+)\s*(mil|[km])?(?![a-z])/);
    if (!m) return null;
    let num = m[1].replace(/\s/g, '');
    if (num.indexOf('.') < 0 && /,\d{1,2}(\D|$)/.test(num)) num = num.replace(',', '.');
    num = num.replace(/[.,](?=\d{3}(\D|$))/g, '');
    let n = parseFloat(num);
    if (isNaN(n)) return null;
    if (m[2] === 'k') n *= 1000;
    else if (m[2] === 'm') n *= 1000000;
    else if (m[2] === 'mil') n *= 1000;
    return Math.round(n);
  };
  const TIME_RE = /^(\d+\s*(d\u00edas?|d|horas?|h|min|minutos?|m|segundos?|seg|s|semanas?|sem|w|a\u00f1os?))$/i;
  const EXPANDER_RE = /^Ver (las )?(\d+)?\s*respuestas?$/i;
  const UI_EXACT = new Set(['Me gusta', 'Responder', 'Responder\u00a0', 'Verificado', 'Seguir', 'Traducir']);
  const isUiLeaf = (t: string): boolean => UI_EXACT.has(t) || EXPANDER_RE.test(t) || /^Ver traducci/i.test(t);

  const responders = Array.prototype.slice.call(
    document.querySelectorAll('span, div, button')
  ).filter(
    (el: Element) => el.children.length === 0 && (el.textContent || '').trim() === 'Responder'
  );
  const rowSet = new Set<Element>();
  for (const r of responders) {
    let node: Element = r;
    let picked: Element | null = null;
    for (let i = 0; i < 8; i++) {
      const parent = node.parentElement as Element | null;
      if (!parent) break;
      node = parent;
      let respCount = 0;
      for (const other of responders) if (node.contains(other)) respCount++;
      if (respCount >= 2) break;
      const t = norm(node.textContent);
      if (t.length >= 500) break;
      const anchors = node.querySelectorAll('a[href]');
      let hasProfile = false;
      for (let j = 0; j < anchors.length; j++) {
        if (isProfileHref(anchors[j].getAttribute('href'))) { hasProfile = true; break; }
      }
      if (hasProfile && t.length > 25) picked = node;
    }
    if (picked) rowSet.add(picked);
  }
  let rows = Array.from(rowSet);
  rows = rows.filter((a) => !rows.some((b) => b !== a && a.contains(b)));

  const out: RawComment[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const anchors = row.querySelectorAll('a[href]');
    let username: string | null = null;
    for (let i = 0; i < anchors.length; i++) {
      const h = anchors[i].getAttribute('href');
      if (isProfileHref(h)) { username = (h as string).replace(/^\/|\/$/g, ''); break; }
    }
    if (!username) continue;

    const leaves = Array.prototype.slice
      .call(row.querySelectorAll('*'))
      .filter((el: Element) => el.children.length === 0)
      .map((el: Element) => norm(el.textContent))
      .filter((t: string) => t.length > 0);

    let timeText: string | null = null;
    let likes: number | null = null;
    let repliesCount: number | null = null;
    const textParts: string[] = [];
    let timeSeen = false;
    let prevNumeric: string | null = null;
    for (let i = 0; i < leaves.length; i++) {
      const t = leaves[i];
      if (timeSeen && TIME_RE.test(t) === false && /^\d/.test(t) === false) timeSeen = true;
      if (!timeSeen && TIME_RE.test(t)) { timeText = t; timeSeen = true; continue; }
      if (isUiLeaf(t)) {
        if (/Me gusta/i.test(t)) {
          if (likes == null && prevNumeric) likes = parseCount(prevNumeric);
          prevNumeric = null;
        }
        if (EXPANDER_RE.test(t)) repliesCount = parseInt((t.match(EXPANDER_RE) as RegExpMatchArray)[2] || '0', 10) || null;
        continue;
      }
      const likeInline = t.match(/^([\d.,]+\s*(?:mil)?)\s+Me gusta$/i);
      if (likeInline) { if (likes == null) likes = parseCount(likeInline[1]); continue; }
      if (/^[\d.,]+\s*(mil)?$/i.test(t) && !timeSeen) { prevNumeric = t; continue; }
      if (/^[\d.,]+\s*(mil)?$/i.test(t) && timeSeen) {
        const next = leaves[i + 1];
        if (next && /Me gusta/i.test(next)) { prevNumeric = t; continue; }
      }
      if (t === username || username.startsWith(t)) continue;
      textParts.push(t);
    }
    const text = norm(textParts.join(' '));
    if (!text) continue;

    let isReply = false;
    let parentId: string | null = null;
    let node: Element | null = row;
    for (let i = 0; i < 6 && node.parentElement; i++) {
      const sib = node.previousElementSibling;
      if (sib && EXPANDER_RE.test(norm(sib.textContent))) {
        isReply = true;
        let back: Element | null = sib.previousElementSibling;
        for (let k = 0; k < 3 && back; k++) {
          const ba = back.querySelectorAll('a[href]');
          for (let j = 0; j < ba.length; j++) {
            const h = ba[j].getAttribute('href');
            if (isProfileHref(h)) { parentId = (h as string).replace(/^\/|\/$/g, ''); break; }
          }
          if (parentId) break;
          back = back.previousElementSibling;
        }
        break;
      }
      node = node.parentElement as Element;
    }

    let avatar: string | null = null;
    const imgs = row.querySelectorAll('img');
    for (let i = 0; i < imgs.length; i++) {
      const src = imgs[i].getAttribute('src') || '';
      if (src.indexOf('http') === 0 && src.indexOf('.svg') < 0) { avatar = src; break; }
    }

    const key = norm(username) + '\u241f' + norm(text).slice(0, 140);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      id: null,
      parent_id: parentId,
      is_reply: isReply,
      username,
      display_name: null,
      avatar,
      text,
      datetime: null,
      time_text: timeText,
      likes,
      reply_count: repliesCount
    });
  }
  return out;
}

export function pageScrollStep(): boolean {
  const responders = Array.prototype.slice.call(
    document.querySelectorAll('span, div, button')
  ).filter(
    (el: Element) => el.children.length === 0 && (el.textContent || '').trim() === 'Responder'
  );
  let best: HTMLElement | null = null;
  let bestScore = 0;
  const els = Array.prototype.slice.call(document.querySelectorAll('div, section')) as HTMLElement[];
  for (const el of els) {
    const gap = el.scrollHeight - el.clientHeight;
    if (gap < 60 || el.clientHeight < 150) continue;
    const contains =
      responders.length > 0
        ? responders.some((r) => el.contains(r))
        : el.querySelectorAll('a[href^="/"]').length > 2;
    if (!contains) continue;
    const score = gap * Math.min(1, el.clientHeight / 600);
    if (score > bestScore) { bestScore = score; best = el; }
  }
  if (!best) return false;
  const before = best.scrollTop;
  best.scrollBy(0, Math.max(240, Math.round(best.clientHeight * 0.8)));
  return best.scrollTop > before + 4;
}

export function pageOpenReplies(): number {
  const EXP = /^Ver (las )?\d+\s+respuestas?$|^Ver respuesta$/i;
  let clicked = 0;
  const els = Array.prototype.slice.call(document.querySelectorAll('span, div, button, [role="button"]'));
  for (const el of els) {
    if (clicked >= 12) break;
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!EXP.test(t)) continue;
    const kids = el.children;
    let onlySvg = true;
    for (let i = 0; i < kids.length; i++) {
      if ((kids[i] as Element).tagName !== 'svg' && (kids[i] as Element).querySelector('svg') === null && (kids[i] as Element).textContent) { onlySvg = false; break; }
    }
    const isLeaf = kids.length === 0;
    const svgOnly = onlySvg && kids.length > 0 && el.querySelector('svg') !== null;
    if (!isLeaf && !svgOnly) continue;
    const target = ((el as HTMLElement).closest('[role="button"]') as HTMLElement) || (el as HTMLElement);
    target.click();
    clicked++;
  }
  return clicked;
}

export function pageLoadMore(): number {
  const labeled = document.querySelectorAll('[aria-label]');
  for (let i = 0; i < labeled.length; i++) {
    const al = labeled[i].getAttribute('aria-label') || '';
    if (/cargar m\u00e1s comentarios|load more comments|ver m\u00e1s comentarios|m\u00e1s comentarios/i.test(al)) {
      (labeled[i] as HTMLElement).click();
      return 1;
    }
  }
  const responders = Array.prototype.slice.call(
    document.querySelectorAll('span, div, button')
  ).filter(
    (el: Element) => el.children.length === 0 && (el.textContent || '').trim() === 'Responder'
  );
  if (!responders.length) return 0;

  let lastTop = -Infinity;
  for (const r of responders) {
    const rect = (r as HTMLElement).getBoundingClientRect();
    if (rect.top > lastTop) lastTop = rect.top;
  }

  let scope: HTMLElement | null = responders[0] as HTMLElement;
  let scrollContainer: HTMLElement | null = null;
  while (scope) {
    const p = scope.parentElement as HTMLElement | null;
    if (!p) break;
    const st = getComputedStyle(p);
    if ((st.overflowY === 'auto' || st.overflowY === 'scroll' || st.overflowY === 'overlay') && p.scrollHeight > p.clientHeight + 50) {
      scrollContainer = p;
      break;
    }
    if (p === document.body) break;
    scope = p;
  }

  const root: HTMLElement = scrollContainer || scope || document.body;
  if (scrollContainer) {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }
  const cands = root.querySelectorAll(
    'button, [role="button"], div[tabindex], span[role="button"], span[tabindex]'
  );
  let best: HTMLElement | null = null;
  let bestTop = Infinity;
  for (let i = 0; i < cands.length; i++) {
    const el = cands[i] as HTMLElement;
    const txt = (el.textContent || '').trim();
    if (txt) continue;
    if (!el.querySelector('svg')) continue;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w < 14 || w > 120 || h < 14 || h > 120) continue;
    const rect = el.getBoundingClientRect();
    if (rect.top < lastTop - 80) continue;
    if (rect.width === 0 && rect.height === 0) continue;
    if (rect.top < bestTop) { bestTop = rect.top; best = el; }
  }
  if (best) { best.click(); return 1; }
  return 0;
}

const adapter: Adapter = {
  platform: 'instagram',
  domains: ['instagram.com'],
  homeUrl: 'https://www.instagram.com/',
  pageProbe,
  pageExtract,
  pageScrollStep,
  pageOpenReplies,
  pageLoadMore
};
export default adapter;

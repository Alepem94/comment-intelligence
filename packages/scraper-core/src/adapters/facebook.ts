import type { Adapter, ProbeResult } from './base';
import type { RawComment } from '@ci/shared';

export function pageProbe(): ProbeResult {
  const d = document;
  const bodyText = (d.body && d.body.innerText.slice(0, 2000)) || '';
  const loginWall =
    !!d.querySelector('form[action*="/login"], #login_form') ||
    /inicia sesi\u00f3n para continuar|log in to facebook/i.test((d.title || '') + ' ' + bodyText);
  const hasPost = !!d.querySelector('[role="article"], [role="main"] h1');
  let container = false;
  const els = Array.prototype.slice.call(d.querySelectorAll('div[role="main"] *, div[role="feed"] *')) as HTMLElement[];
  for (const el of els) {
    if (el.scrollHeight > el.clientHeight + 120 && el.clientHeight > 300) {
      if (el.querySelector('a[href*="comment_id="]')) { container = true; break; }
    }
  }
  const commentsInDom = d.querySelectorAll('a[href*="comment_id="]').length;
  return {
    pageDetected: /facebook\.com$/.test(location.hostname),
    postDetected: hasPost,
    loggedIn: !loginWall,
    commentContainerDetected: container || commentsInDom > 0,
    commentsInDom,
    mutationObserverActive: false
  };
}

export function pageExtract(): RawComment[] {
  const norm = (s: unknown): string => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
  const parseCount = (s: unknown): number | null => {
    if (!s) return null;
    const t = String(s).replace(/\u00a0/g, ' ').toLowerCase();
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
  const getParam = (href: string | null | undefined, name: string): string | null => {
    if (!href) return null;
    try {
      const u = new URL(href, location.origin);
      return u.searchParams.get(name);
    } catch {
      const m = String(href).match(new RegExp('[?&]' + name + '=([^&]+)'));
      return m ? m[1] : null;
    }
  };

  const PERM = 'a[href*="comment_id="]';
  const anchors = Array.prototype.slice.call(document.querySelectorAll(PERM)) as HTMLAnchorElement[];
  const unique = new Map<string, HTMLAnchorElement>();
  for (const a of anchors) {
    const href = a.getAttribute('href') || '';
    const replyId = getParam(href, 'reply_comment_id');
    const id = replyId || getParam(href, 'comment_id');
    if (id && !unique.has(id)) unique.set(id, a);
  }

  const isAuthorAnchor = (x: Element): boolean => {
    if (x.tagName !== 'A') return false;
    const h = x.getAttribute('href') || '';
    if (h.indexOf('comment_id=') >= 0) return false;
    return /\/(user|profile\.php)/.test(h) || x.hasAttribute('hovercard');
  };
  const precedes = (b: Node, a: Node): boolean => {
    return !!(b.compareDocumentPosition(a) & 4);
  };

  const out: RawComment[] = [];
  const seen = new Set<string>();

  for (const [id, a] of Array.from(unique.entries())) {
    if (seen.has(id)) continue;
    const href = a.getAttribute('href') || '';
    const parentIdParam = getParam(href, 'comment_id');
    const replyId = getParam(href, 'reply_comment_id');
    let root: HTMLElement = a as HTMLElement;
    for (let depth = 0; depth < 12; depth++) {
      const p = root.parentElement;
      if (!p) break;
      let foundAuthor = false;
      let foundText = false;
      for (const c of Array.from(p.querySelectorAll('a'))) {
        if (isAuthorAnchor(c)) { foundAuthor = true; break; }
      }
      for (const b of Array.from(p.querySelectorAll('div[dir="auto"], span[dir="auto"]'))) {
        const bt = norm((b as HTMLElement).textContent);
        if (bt.length > 2 && !/^(me gusta|like|responder|reply)$/i.test(bt)) { foundText = true; break; }
      }
      root = p;
      if (foundAuthor && foundText) break;
    }

    let authorName: string | null = null;
    for (const c of Array.from(root.querySelectorAll('a'))) {
      if (!isAuthorAnchor(c)) continue;
      if (!precedes(c, a)) continue;
      authorName = norm(c.textContent) || norm(c.getAttribute('aria-label'));
      if (authorName) break;
    }
    if (!authorName) {
      for (const c of Array.from(root.querySelectorAll('a'))) {
        if (!isAuthorAnchor(c)) continue;
        authorName = norm(c.textContent) || norm(c.getAttribute('aria-label'));
        if (authorName) break;
      }
    }

    let text = '';
    const blocks = root.querySelectorAll('div[dir="auto"], span[dir="auto"]');
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i] as HTMLElement;
      if (b.contains(a)) continue;
      if (!precedes(b, a)) continue;
      const bt = norm(b.textContent);
      if (!bt || bt === authorName) continue;
      if (/^(\d+\s*(h|m|s|d|sem|min|hora?)\b|\dh\b)/i.test(bt)) continue;
      if (/^(me gusta|like|responder|reply|ver respuestas|view replies|ver m\u00e1s respuestas|see more replies|traducir|translate|ver traducci\u00f3n|seguir|follow)$/i.test(bt)) continue;
      if (bt.length > text.length) text = bt;
    }
    if (!text) continue;

    let avatar: string | null = null;
    const imgs = root.querySelectorAll('img');
    for (let i = 0; i < imgs.length; i++) {
      const im = imgs[i] as HTMLImageElement;
      const src = im.currentSrc || im.getAttribute('src') || '';
      if (src && src.indexOf('scontent') >= 0 && precedes(im, a)) {
        avatar = src;
        break;
      }
    }
    if (!avatar) {
      for (let i = 0; i < imgs.length; i++) {
        const im = imgs[i] as HTMLImageElement;
        const src = im.currentSrc || im.getAttribute('src') || '';
        if (src && src.indexOf('scontent') >= 0) { avatar = src; break; }
      }
    }

    let likes: number | null = null;
    const labeled = root.querySelectorAll('[aria-label]');
    for (let i = 0; i < labeled.length; i++) {
      const al = labeled[i].getAttribute('aria-label') || '';
      if (/reacci\u00f3n|reaction|me gusta|like/i.test(al)) { likes = parseCount(al); break; }
    }
    if (likes == null) {
      const spans = root.querySelectorAll('span');
      for (let i = 0; i < spans.length; i++) {
        const st = norm(spans[i].textContent);
        if (/^\d{1,4}(\u00a0| )?(mil|[km]\.?|\d*)$/i.test(st) && st.length <= 10) { likes = parseCount(st); break; }
      }
    }

    let timeText: string | null = norm(a.textContent);
    if (!timeText || /^\d+$/.test(timeText)) timeText = null;

    seen.add(id);
    out.push({
      id,
      parent_id: replyId ? parentIdParam : null,
      is_reply: !!replyId,
      username: null,
      display_name: authorName,
      avatar,
      text,
      datetime: null,
      time_text: timeText,
      likes,
      reply_count: null
    });
  }

  return out;
}

export function pageScrollStep(): boolean {
  const scopes: HTMLElement[] = [];
  const main = (document.querySelector('div[role="main"]') as HTMLElement) || document.body;
  if (main) scopes.push(main);
  const feed = document.querySelector('div[role="feed"]') as HTMLElement | null;
  if (feed) scopes.push(feed);

  let best: HTMLElement | null = null;
  let bestScore = 0;
  for (const scope of scopes) {
    const els: HTMLElement[] = [scope].concat(Array.prototype.slice.call(scope.querySelectorAll('*')) as HTMLElement[]);
    for (const el of els) {
      if (!el) continue;
      const st = getComputedStyle(el);
      const oy = st.overflowY;
      const scrollable = oy === 'auto' || oy === 'scroll' || oy === 'overlay';
      const isDocScroller = el === document.scrollingElement;
      if (!scrollable && !isDocScroller) continue;
      const gap = el.scrollHeight - el.clientHeight;
      if (gap < 60 || el.clientHeight < 250) continue;
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
  const btns = document.querySelectorAll('[role="button"]');
  for (let i = 0; i < btns.length; i++) {
    if (clicked >= 8) break;
    const b = btns[i] as HTMLElement;
    const t = ((b.innerText || b.textContent || '') + '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!t || t.length > 60) continue;
    if (
      /^(ver respuestas|ver m\u00e1s respuestas|view replies|see more replies|m\u00e1s respuestas)/.test(t) ||
      ((/^ver \d+ respuestas$|^view \d+ repl/.test(t)))
    ) {
      b.click();
      clicked++;
    }
  }
  return clicked;
}

const adapter: Adapter = {
  platform: 'facebook',
  domains: ['facebook.com'],
  homeUrl: 'https://www.facebook.com/',
  pageProbe,
  pageExtract,
  pageScrollStep,
  pageOpenReplies
};
export default adapter;

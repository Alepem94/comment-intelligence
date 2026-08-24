import type { Adapter, ProbeResult } from './base';
import type { RawComment } from '@ci/shared';

export function pageProbe(): ProbeResult {
  const d = document;
  const loginWall =
    !!d.querySelector('input[name="username"], input[name="pass"], form[action*="/accounts/login/"]') ||
    /log in|iniciar sesi/i.test((d.body && d.body.innerText.slice(0, 3000)) || '');
  const hasPost = !!d.querySelector('article, [role="dialog"] article');
  let container = false;
  const els = Array.prototype.slice.call(d.querySelectorAll('[role="dialog"] *, main *')) as HTMLElement[];
  for (const el of els) {
    if (el.scrollHeight > el.clientHeight + 80 && el.clientHeight > 200) {
      if (el.querySelector('ul li time, ul li a[href^="/"]')) { container = true; break; }
    }
  }
  const commentsInDom = d.querySelectorAll('article ul li time, [role="dialog"] ul li time').length;
  return {
    pageDetected: /instagram\.com$/.test(location.hostname),
    postDetected: hasPost,
    loggedIn: !loginWall,
    commentContainerDetected: container || commentsInDom > 0,
    commentsInDom,
    mutationObserverActive: false
  };
}

export function pageExtract(): RawComment[] {
  const norm = (s: unknown): string => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
  const RESERVED = ['p', 'reel', 'reels', 'tv', 'explore', 'stories', 'accounts', 'about', 'direct'];
  const isProfileHref = (href: string | null | undefined): boolean => {
    if (!href || href.charAt(0) !== '/') return false;
    const m = href.match(/^\/([^/?#]+)\/?$/);
    if (!m) return false;
    return RESERVED.indexOf(m[1].toLowerCase()) === -1;
  };
  const parseCount = (s: string | null | undefined): number | null => {
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
    return Math.round(n);
  };

  const qualifies = (li: HTMLElement | null): boolean => {
    if (!li || li.nodeType !== 1) return false;
    const anchors = li.querySelectorAll('a[href^="/"]');
    for (let i = 0; i < anchors.length; i++) {
      if (isProfileHref(anchors[i].getAttribute('href'))) return true;
    }
    return false;
  };

  const lis = Array.prototype.slice.call(document.querySelectorAll('ul li')) as HTMLElement[];
  const targets: HTMLElement[] = [];
  for (const li of lis) {
    if (qualifies(li)) targets.push(li);
  }

  const out: RawComment[] = [];
  const seen = new Set<string>();
  for (const li of targets) {
    let authorA: HTMLAnchorElement | null = null;
    const anchors = li.querySelectorAll('a[href^="/"]');
    for (let i = 0; i < anchors.length; i++) {
      if (isProfileHref(anchors[i].getAttribute('href'))) { authorA = anchors[i] as HTMLAnchorElement; break; }
    }
    if (!authorA) continue;
    const username = (authorA.getAttribute('href') || '').replace(/^\/|\/$/g, '') || null;

    const rowDiv = authorA.closest('div');
    let text = '';
    if (rowDiv) {
      const parts: string[] = [];
      const kids = rowDiv.children;
      for (let i = 0; i < kids.length; i++) {
        if (kids[i] === authorA.parentElement) continue;
        parts.push(norm(kids[i].textContent));
      }
      text = norm(parts.join(' '));
      if (!text) text = norm(rowDiv.textContent).replace(norm(authorA.textContent), '');
      text = text.replace(/^·\s*/, '');
    }
    if (!text) continue;

    const closestUl = li.closest('ul');
    const isReply = !!(closestUl && closestUl.parentElement && closestUl.parentElement.closest('li'));

    const timeEl = li.querySelector('time');
    const rawTime = timeEl ? (timeEl.getAttribute('datetime') || norm(timeEl.textContent)) : '';
    const looksIso = !!rawTime && /\d{4}-\d{2}-\d{2}/.test(rawTime);

    let likes: number | null = null;
    const labels = li.querySelectorAll('[aria-label]');
    for (let i = 0; i < labels.length; i++) {
      const al = labels[i].getAttribute('aria-label') || '';
      if (/likes|me gusta/i.test(al)) { likes = parseCount(al); break; }
    }
    if (likes == null) {
      const m = norm(li.textContent).match(/([\d.,]+\s*[km]?)\s*(?:likes|me gusta)/i);
      if (m) likes = parseCount(m[1]);
    }

    let avatar: string | null = null;
    const imgs = li.querySelectorAll('img');
    for (let i = 0; i < imgs.length; i++) {
      const im = imgs[i] as HTMLImageElement;
      const src = im.getAttribute('src') || im.currentSrc || '';
      if (src && src.indexOf('data:') !== 0) { avatar = src; break; }
    }

    let displayName: string | null = null;
    const altImg = li.querySelector('img[alt]');
    if (altImg) {
      const alt = altImg.getAttribute('alt') || '';
      const mm = alt.match(/(?:profile picture of|foto de perfil de)\s+(.+?)\s*$/i);
      if (mm) displayName = norm(mm[1]);
      else if (alt.length > 0 && alt.length < 60) displayName = norm(alt);
    }

    let repliesCount: number | null = null;
    const nestedUl = li.querySelector(':scope > div ul, :scope > ul');
    if (nestedUl) {
      const nl = nestedUl.querySelectorAll('li');
      let c = 0;
      for (let i = 0; i < nl.length; i++) if (qualifies(nl[i] as HTMLElement)) c++;
      repliesCount = c;
    }

    const key = norm(username) + '\u241f' + norm(text).slice(0, 140) + '\u241f' + norm(rawTime);
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
      datetime: looksIso ? rawTime : null,
      time_text: looksIso ? (timeEl ? norm(timeEl.textContent) : null) : rawTime || null,
      likes: likes,
      reply_count: repliesCount
    });
  }
  return out;
}

export function pageScrollStep(): boolean {
  const scopes: Element[] = [];
  const dialog = document.querySelector('[role="dialog"]');
  if (dialog) scopes.push(dialog);
  const article = document.querySelector('article');
  if (article) scopes.push(article);
  const main = document.querySelector('main') || document.body;
  if (main) scopes.push(main);

  let best: HTMLElement | null = null;
  let bestScore = 0;
  for (const scope of scopes) {
    const els: HTMLElement[] = [scope as HTMLElement].concat(Array.prototype.slice.call(scope.querySelectorAll('*')) as HTMLElement[]);
    for (const el of els) {
      if (!el) continue;
      const st = getComputedStyle(el);
      if (st.overflowY !== 'auto' && st.overflowY !== 'scroll' && st.overflowY !== 'overlay') continue;
      const gap = el.scrollHeight - el.clientHeight;
      if (gap < 40 || el.clientHeight < 150) continue;
      const score = gap * Math.min(1, el.clientHeight / 600);
      if (score > bestScore) { bestScore = score; best = el; }
    }
  }
  if (!best) return false;
  const before = best.scrollTop;
  const step = Math.max(240, Math.round(best.clientHeight * 0.8));
  best.scrollBy(0, step);
  return best.scrollTop > before + 4;
}

export function pageOpenReplies(): number {
  let clicked = 0;
  const btns = document.querySelectorAll('[role="button"], button');
  for (let i = 0; i < btns.length; i++) {
    if (clicked >= 8) break;
    const b = btns[i] as HTMLElement;
    const t = ((b.innerText || b.textContent || '') + '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!t || t.length > 60) continue;
    if (/^(ver respuestas|view replies|view answers)/.test(t) || (/^(ver|view)\s/.test(t) && /repl|respuesta/.test(t))) {
      b.click();
      clicked++;
    }
  }
  return clicked;
}

const adapter: Adapter = {
  platform: 'instagram',
  domains: ['instagram.com'],
  homeUrl: 'https://www.instagram.com/',
  pageProbe,
  pageExtract,
  pageScrollStep,
  pageOpenReplies
};
export default adapter;

import type { FrontItem, FrontPageParser, Slot } from './types.js';
import { PLAIN_HEADERS, canonical, clean, dedupe } from './types.js';

/**
 * The news front page, not 13tv.co.il/: the network homepage shares only the
 * lead and the four headlines under it with this page, then fills up with
 * show promos, celebs and VOD rails. /news/ is where the חדשות 13 logo leads.
 */
const URL_ = 'https://13tv.co.il/news/';

/**
 * Not news: culture and entertainment (also under /item/news/), shows, VOD and
 * anything outside /item/news/. Politics, security, world, crime and law,
 * economy, health, education, weather, opinion and news-show clips are news.
 */
const SOFT = /^\/item\/news\/(domestic\/culture-entertainment|sport)\//;

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Israel local time as the site prints it ("2026-09-02 21:00:07") to ISO, DST-aware. */
function jerusalemToIso(local: string): string | undefined {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return undefined;
  const [, y, mo, d, h, mi, sec] = m.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi, sec);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return new Date(guess - (shown - guess)).toISOString();
}

/**
 * Article pages only: 13tv.co.il/item/… with the `?pid=&refc=` tracking cut.
 * Full episodes (/allshows/…) and external links are left out.
 */
function articleUrl(link: unknown): URL | null {
  const href = canonical(String(link ?? ''), URL_);
  const u = href ? new URL(href) : null;
  // Articles end in "<slug>-<id>/"; hand-typed flash links sometimes don't.
  if (!u || u.hostname !== '13tv.co.il' || !/^\/item\/.*-\d+\/?$/.test(u.pathname)) return null;
  if (!u.pathname.endsWith('/')) u.pathname += '/';
  return u;
}

function base(u: URL, slot: Slot): Pick<FrontItem, 'url' | 'slot' | 'section' | 'isNews'> {
  const parts = u.pathname.split('/').filter(Boolean).slice(1, -1);
  return {
    url: u.toString(),
    slot,
    section: (parts[0] === 'news' ? parts.slice(1) : parts).join('/') || 'news',
    isNews: u.pathname.startsWith('/item/news/') && !SOFT.test(u.pathname),
  };
}

/**
 * Walks `page.Content.PageGrid` in order — the order the HTML renders it.
 * A matrix block holds several titled category lists, read one after another.
 *
 * Slots: `MainStandard` is the lead; the first grid after it (the four
 * headlines under the חדשות 13 logo) is the top block. The lead grid also
 * carries `newsFlash`, the מבזקים strip shown beside the lead: flashes that
 * link to an article become ticker items right after the lead, unless that
 * article already has a teaser of its own on the page.
 */
function parse(html: string): FrontItem[] {
  const raw = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)?.[1];
  if (!raw) return [];
  const grids: any[] = JSON.parse(raw)?.props?.pageProps?.page?.Content?.PageGrid ?? [];

  // The lead often has an empty publishDate; the same post elsewhere has one.
  const when = new Map<string, string>();
  const teasers: FrontItem[] = [];
  let flashes: any[] = [];
  let leadSeen = false;
  let topDone = false;
  for (const g of grids) {
    const posts = (g.matrix_elements ?? [g]).flatMap((m: any) => m?.posts ?? []);
    if (!posts.length) continue;
    let slot: Slot = 'main';
    if (g.grid_type === 'MainStandard' && !leadSeen) {
      slot = 'lead';
      leadSeen = true;
      flashes = g.newsFlash?.newsFlashArr ?? [];
    } else if (leadSeen && !topDone) {
      slot = 'top';
      topDone = true;
    }
    for (const p of posts) {
      const u = articleUrl(p?.link);
      const title = clean(p?.title);
      if (!u || !title || p.isPromotionalItem || p.isBlank) continue;
      const iso = jerusalemToIso(String(p.publishDate || p.updateDate || ''));
      if (iso && !when.has(u.toString())) when.set(u.toString(), iso);
      const img = p.imageObj?.d ?? p.image;
      teasers.push({
        ...base(u, slot),
        title,
        blurb: clean(p.secondaryTitle) || undefined,
        imageUrl: typeof img === 'string' && img.startsWith('http') ? img : undefined,
      });
    }
  }
  const unique = dedupe(teasers);
  if (!unique.length) return [];
  // Exactly one lead; a page without `MainStandard` promotes its first story.
  const lead = Math.max(0, unique.findIndex(i => i.slot === 'lead'));
  unique.forEach((i, n) => { if (n === lead) i.slot = 'lead'; else if (i.slot === 'lead') i.slot = 'top'; });

  const onPage = new Set(unique.map(i => i.url));
  const ticker: FrontItem[] = flashes.flatMap(f => {
    const u = articleUrl(f?.link);
    const title = clean(f?.text);
    if (!u || !title || onPage.has(u.toString())) return [];
    return [{ ...base(u, 'ticker'), title, publishedAt: jerusalemToIso(String(f.time ?? '')) }];
  });

  const items = [...unique.slice(0, lead + 1), ...ticker, ...unique.slice(lead + 1)]
    .map(i => ({ ...i, publishedAt: i.publishedAt ?? when.get(i.url) }));
  return dedupe(items);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const parser: FrontPageParser = {
  source: 't13',
  url: URL_,
  headers: PLAIN_HEADERS,
  parse,
};

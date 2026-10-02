import type { FrontItem, FrontPageParser, Slot } from './types.js';
import { canonical, clean, dedupe } from './types.js';

const BASE = 'https://www.n12.co.il/';

/**
 * Teaser kinds that send a reader to an article. Left out: `advertisingTeaser`
 * (sponsored), `embededTeaser` (iframes: storycards, election widgets) and
 * `banner`. `shortItem` is N12's running flash strip — timestamped one-line
 * items, each with its own page — so it is the ticker.
 */
const TEASERS = new Set(['mainItemNews', 'regularTeaser', 'opinionRoundTeaser', 'shortItem']);

/**
 * N12 names its blocks: `mainComponentNews` is the lead, and
 * `mainComponentItems` is the headline column beside it (it pulls from the
 * lead's own ordering). Flashes (`shortItem`) are the ticker wherever they sit.
 */
const SLOTS: Record<string, Slot> = { mainComponentNews: 'lead', mainComponentItems: 'top' };

/**
 * Not news: sport, culture, the tip12/lifestyle/health magazines, the
 * BUSINESS profiles, the live-broadcast and VOD show pages, and money's
 * consumer, calculator and gadget corners. News, politics, security, world,
 * law, economy, the news magazine, opinion columns and news podcasts are news.
 */
const SOFT = /^\/(news-(sport|entertainment|tip12|lifestyle|business|channel2)|mako-vod)|^\/news-money\/(consumer|calculators|tech12)\//;

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Israel local time as the page prints it ("2026-10-02T19:23") to ISO, DST-aware. */
function jerusalemToIso(local: string): string | undefined {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return undefined;
  const [y, mo, d, h, mi, sec = 0] = m.slice(1).map(v => Number(v ?? 0));
  const guess = Date.UTC(y, mo - 1, d, h, mi, sec);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return new Date(guess - (shown - guess)).toISOString();
}

function toItem(t: any, slot: Slot): FrontItem | null {
  if (!TEASERS.has(t.itemType)) return null;
  const flash = t.itemType === 'shortItem';
  // Flashes carry their page only in the click-tracking record.
  const url = canonical(String(t.itemUrl?.url ?? t.domoClick?.clicked_item_url ?? ''), BASE);
  const title = clean(t.title?.text);
  if (!url || !title) return null;
  const { hostname, pathname } = new URL(url);
  // Only mako-hosted articles; special.n12.co.il, auto.co.il etc. are
  // microsites or partners, and `*special*` paths are paid content.
  if (hostname !== 'www.mako.co.il' || !/\/(Article|Video|shorts)-/.test(pathname)) return null;
  if (/^\/[^/]*special/.test(pathname)) return null;
  const sub = pathname.match(/^\/news-money\/(consumer|calculators|tech12|real_estate)\//)?.[1];
  const pic = t.pics?.[0]?.url;
  return {
    url,
    title,
    slot: flash ? 'ticker' : slot,
    section: sub ? `money/${sub}` : pathname.split('/')[1].replace(/^news-/, ''),
    isNews: !SOFT.test(pathname),
    blurb: clean(t.subTitle?.text ?? t.subtitle?.text) || undefined,
    imageUrl: typeof pic === 'string' && pic.startsWith('http') ? pic : undefined,
    publishedAt: flash && t.flach?.timestamp
      ? new Date(Number(t.flach.timestamp)).toISOString()
      : jerusalemToIso(String(t.date?.datetime ?? '')),
  };
}

/**
 * Walks `pageData.components` depth-first, which is the order the page
 * renders them (checked against the HTML's link order). Layout wrappers
 * (`mainChatLayout`, `shortsLayout`…) nest the real components in `items`.
 */
function parse(html: string): FrontItem[] {
  const raw = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)?.[1];
  if (!raw) return [];
  const components = JSON.parse(raw)?.props?.pageProps?.pageData?.components;
  const out: FrontItem[] = [];
  const walk = (o: any, slot: Slot) => {
    if (Array.isArray(o)) { o.forEach(x => walk(x, slot)); return; }
    if (!o || typeof o !== 'object') return;
    if (o.itemType) {
      const item = toItem(o, slot);
      if (item) out.push(item);
      // Related links under the lead belong to the headline block.
      walk(o.linkedItems, slot === 'lead' ? 'top' : slot);
      return;
    }
    walk(o.items, (o.componentType && SLOTS[o.componentType]) || (o.componentType ? 'main' : slot));
  };
  walk(components, 'main');

  // Exactly one lead: later lead candidates join the headline block, and a
  // page without the lead component promotes its first story.
  const items = dedupe(out);
  let lead = items.findIndex(i => i.slot === 'lead');
  if (lead < 0 && items.length) lead = 0;
  return items.map((i, n) => ({ ...i, slot: n === lead ? 'lead' : i.slot === 'lead' ? 'top' : i.slot }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const parser: FrontPageParser = {
  source: 'n12',
  url: BASE,
  parse,
};

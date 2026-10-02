import { parseHTML } from 'linkedom';
import { BROWSER_HEADERS, canonical, clean, dedupe, type FrontItem, type FrontPageParser, type Slot } from './types.js';

const BASE = 'https://www.ynet.co.il/';

/**
 * Layout items that hold no editorial links a desktop reader sees: the header's
 * menus, outbound promos (calcalist, one), Taboola/native ad units, and the
 * `show-small-vp` blocks that only render on phones and repeat desktop stories.
 */
const SKIP = /ynet-header|editable-footer|article-promo|taboola|native-ads|banner|show-small-vp/;

/**
 * Sections whose stories aren't news: sport, entertainment and culture, food,
 * fashion, travel, consumer and lifestyle, tech gadgets, health features,
 * podcasts and Yedioth+ magazine pieces. Opinion and analysis count as news.
 */
const SOFT = new Set([
  'sport', 'entertainment', 'food', 'fashion', 'vacation', 'laisha', 'dating', 'wellness',
  'health', 'architecture', 'digital', 'judaism', 'activism', 'radio', 'pplus', 'parents',
  'home', 'cars', 'consumer', 'video', 'tv', 'travel',
]);

/** ynet sections live before `/article/`; a bare `/article/x` has no section. */
function sectionOf(url: string): string {
  const u = new URL(url);
  if (u.hostname.startsWith('pplus.')) return 'pplus';
  const first = u.pathname.split('/')[1];
  return first && first !== 'article' ? first : 'general';
}

/** Only ynet's own article pages; promos to sister sites and project pages are not stories. */
function articleUrl(href: string | null): string | null {
  const url = href && canonical(href, BASE);
  if (!url) return null;
  const u = new URL(url);
  return u.hostname.endsWith('ynet.co.il') && u.pathname.includes('/article/') ? url : null;
}

/** `top`/`left` from the inline style the layout engine writes on each absolutely positioned block. */
function pos(el: { getAttribute(name: string): string | null }, prop: string): number {
  return parseFloat(el.getAttribute('style')?.match(new RegExp(`(?:^|;)${prop}:(-?[\\d.]+)`))?.[1] ?? '0');
}

/**
 * ynet's server render places every block absolutely inside a stack of
 * `layoutContainer`s, so DOM order is not reading order. Containers stack top
 * to bottom; inside one, blocks on the same row read right to left (RTL).
 * The page's main story is the `h1` of `top-story-multi`; the short headlines
 * under it (`TopStoryBottomItem`) form the top block. The מבזקים ticker is
 * filled in the browser from an API, so the HTML carries no flashes.
 */
export const parser: FrontPageParser = {
  source: 'ynet',
  url: BASE,
  headers: BROWSER_HEADERS,
  parse(html) {
    const { document } = parseHTML(html);
    const containers = [...document.querySelectorAll('.layoutContainer')];
    const blocks = [...document.querySelectorAll('.layoutItem')]
      // A block whose tab links to the commerce desk is paid supplements (מוספים מיוחדים).
      .filter(el => !SKIP.test(el.className) && !el.querySelector('.titleLink[href*="/commerce/"]'))
      .map(el => ({ el, c: containers.indexOf(el.closest('.layoutContainer')!), top: pos(el, 'top'), left: pos(el, 'left') }))
      .sort((a, b) => a.c - b.c || (Math.abs(a.top - b.top) > 20 ? a.top - b.top : b.left - a.left));

    const items: FrontItem[] = [];
    for (const { el } of blocks) {
      const isTop = el.classList.contains('top-story-multi');
      const seen = new Set<string>();
      for (const a of el.querySelectorAll('a[href]')) {
        const url = articleUrl(a.getAttribute('href'));
        if (!url || seen.has(url)) continue;
        const bottom = a.classList.contains('TopStoryBottomItem');
        const card = bottom ? a : a.closest('.slotView, .opinionsSlotItem');
        if (!card || card.matches('.commertial') || card.querySelector('.MarketingSign')) continue;
        const head = bottom ? a : card.querySelector('[data-tb-title], .slotTitle, .title');
        const title = clean(head?.textContent);
        if (!title) continue;
        seen.add(url);
        const slot: Slot = !isTop ? 'main' : bottom ? 'top' : 'lead';
        const section = sectionOf(url);
        const time = card.querySelector('[data-wcmdate]')?.getAttribute('data-wcmdate');
        items.push({
          url, title, slot, section,
          isNews: !SOFT.has(section),
          blurb: bottom ? undefined : clean(card.querySelector('.slotSubTitle, .subTitle')?.textContent) || undefined,
          imageUrl: card.querySelector('img.SiteImageMedia')?.getAttribute('src') ?? undefined,
          publishedAt: time ? new Date(time).toISOString() : undefined,
        });
      }
    }
    // Exactly one lead: without a top-story block the first story stands in.
    if (!items.some(i => i.slot === 'lead') && items[0]) items[0].slot = 'lead';
    return dedupe(items);
  },
};

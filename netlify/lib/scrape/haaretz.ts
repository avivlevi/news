import { parseHTML } from 'linkedom';
import { BROWSER_HEADERS, canonical, clean, dedupe, type FrontItem, type FrontPageParser, type Slot } from './types.js';

const BASE = 'https://www.haaretz.co.il/';

/**
 * Sections whose stories aren't news: sport, the weekend magazine and its
 * columns, culture (gallery, literature), food, podcasts (digital), puzzles and
 * the commercial label desks. Opinion (`opinions`) counts as news.
 */
const SOFT = new Set([
  'sport', 'magazine', 'gallery', 'literature', 'food', 'travel', 'digital', 'riddles',
  'misc', 'labels', 'haaretz-labels', 'family', 'life', 'blogs',
]);

/**
 * A live-blog flash points into the day's live article with `?liveBlogItemId=`,
 * which is the only thing telling one flash from the next, so it stays.
 */
function itemUrl(href: string | null): string | null {
  const url = href && canonical(href, BASE, true);
  if (!url) return null;
  const u = new URL(url);
  if (u.hostname !== 'www.haaretz.co.il' || !/\/ty-article/.test(u.pathname)) return null;
  const flash = u.searchParams.get('liveBlogItemId');
  u.search = flash ? `?liveBlogItemId=${flash}` : '';
  return u.toString();
}

const sectionOf = (url: string) => new URL(url).pathname.split('/')[1] || 'news';

/**
 * Haaretz (Next.js) renders each teaser as an `<article>` with the headline in
 * `header h1|h2|h3` and the kicker in a `<p>` beside it, so the heading alone is
 * the title. DOM order is reading order. The first `<article>` is the main story;
 * the teasers sharing its wrapper are the top block. Flashes (מבזקים) are the
 * live-blog links in their own strip. Lists further down are filled only after
 * scrolling, so the HTML covers roughly the first screens of the page.
 */
export const parser: FrontPageParser = {
  source: 'haaretz',
  url: BASE,
  headers: BROWSER_HEADERS,
  parse(html) {
    const { document } = parseHTML(html);
    const nodes = [...document.querySelectorAll('article, a[href*="liveBlogItemId="]')]
      .filter(el => !el.closest('footer[data-testid="footer"], [data-testid="footer"]'));
    const first = nodes.find(el => el.tagName === 'ARTICLE');
    // The lead's wrapper: climb until the ancestor holds more than the lead itself.
    let wrap = first?.parentElement ?? null;
    while (wrap && wrap.querySelectorAll('article').length < 2) wrap = wrap.parentElement;

    const items: FrontItem[] = [];
    for (const el of nodes) {
      if (el.tagName === 'A') {
        const url = itemUrl(el.getAttribute('href'));
        const title = clean(el.querySelector('[dir="rtl"]')?.textContent);
        if (url && title) items.push({ url, title, slot: 'ticker', section: 'news', isNews: true });
        continue;
      }
      // Some lists put the link inside the heading, others the heading inside the link.
      const head = el.querySelector('h1, h2, h3, h4, h5, h6');
      const link = head?.querySelector('a') ?? head?.closest('a') ?? el.querySelector('a');
      const url = itemUrl(link?.getAttribute('href') ?? null);
      const title = clean(head?.textContent);
      if (!url || !title) continue;
      const slot: Slot = el === first ? 'lead' : wrap?.contains(el) ? 'top' : 'main';
      const section = sectionOf(url);
      const blurb = [...el.querySelectorAll('p')].find(p => !p.closest('header'));
      const time = el.querySelector('time')?.getAttribute('datetime') ?? el.querySelector('time')?.getAttribute('dateTime');
      items.push({
        url, title, slot, section,
        isNews: !SOFT.has(section),
        blurb: clean(blurb?.textContent) || undefined,
        imageUrl: el.querySelector('img')?.getAttribute('src') ?? undefined,
        publishedAt: time ? new Date(time).toISOString() : undefined,
      });
    }
    return dedupe(items);
  },
};

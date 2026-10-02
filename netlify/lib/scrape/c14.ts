/* eslint-disable @typescript-eslint/no-explicit-any */
import { parseHTML } from 'linkedom';
import { BROWSER_HEADERS, canonical, clean, dedupe, type FrontItem, type FrontPageParser, type Slot } from './types.js';

const BASE = 'https://www.c14.co.il/';

/** Hebrew block headers (links to /archive/<id>) → section slug. Unknown labels pass through as-is. */
const SECTIONS: Record<string, string> = {
  'פוליטי-מדיני': 'politics', 'צבא וביטחון': 'security', 'כלכלה': 'economy', 'שוק ההון': 'economy', 'משפט': 'law', 'בעולם': 'world',
  'פרשנות ודעות': 'opinion', 'התיישבות': 'settlement', 'יהדות': 'judaism', 'תרבות ובידור': 'entertainment',
  'טכנולוגיה': 'tech', 'לייף סטייל': 'lifestyle', 'אוכל': 'food', 'ספורט': 'sport', 'בריאות': 'health',
  'צרכנות': 'consumer', 'התוכניות שלנו': 'shows', 'פודקאסטים': 'podcasts',
};

/**
 * Not news: sport, entertainment, consumer tech, lifestyle, food, health features, the
 * channel's own shows and podcasts. Politics, security, economy, law, world, settlement
 * and opinion are news, as are the unlabelled headline and feed blocks — except the
 * weekly Shabbat-times service post that the editors pin among the headlines.
 */
const NOT_NEWS = new Set(['entertainment', 'tech', 'lifestyle', 'food', 'sport', 'health', 'consumer', 'shows', 'podcasts']);
const SERVICE = /זמני (כניסת|יציאת|הדלקת)?\s*(ו?יציאת )?שבת/;

const ARTICLE = /^(?:https:\/\/www\.c14\.co\.il)?\/?article\/\d+$/;

/**
 * The page is a column of blocks under <main>, each server-rendered: the lead block
 * (an <article> with the main story plus a 4-card grid), a second 4-column grid that
 * reads as the same headline area, then one block per category, each headed by a link
 * to /archive/<id>, and a "more news" feed at the bottom. Full-width <a> banners
 * between blocks are promotions and are skipped. Flashes (מבזקים) load client-side,
 * so there is no ticker in the HTML.
 */
export const parser: FrontPageParser = {
  source: 'c14',
  url: BASE,
  headers: BROWSER_HEADERS,
  parse(html) {
    const { document } = parseHTML(html);
    const main = document.querySelector('main');
    if (!main) return [];
    const items = new Map<string, FrontItem>();
    const headed = new Set<string>();
    let blocksWithLinks = 0;

    for (const block of [...main.children] as any[]) {
      if (block.tagName === 'A') continue;
      const links = [...block.querySelectorAll('a[href]')].filter((a: any) => ARTICLE.test(a.getAttribute('href')));
      if (!links.length) continue;
      const n = blocksWithLinks++;
      const label = clean(block.querySelector('a[href*="archive/"]')?.textContent);
      const section = SECTIONS[label] ?? (label || 'news');
      for (const a of links as any[]) {
        const url = canonical(a.getAttribute('href'), BASE);
        if (!url) continue;
        // Card-level labels (the mixed tech/lifestyle strip) beat the block header.
        const tag = clean(a.querySelector('span[class*="bg-NowRed"]')?.textContent);
        const sec = SECTIONS[tag] ?? section;
        const slot: Slot = n === 0 && a.closest('article') ? 'lead' : n <= 1 && !label ? 'top' : 'main';
        const heading = clean(a.querySelector('h1, h2, h3')?.textContent);
        const aria = clean(a.getAttribute('aria-label')).replace(/^כתבה ראשית:\s*/, '').replace(`${tag || label}: `, '');
        const img = a.querySelector('img:not([src$=".svg"])')?.getAttribute('src');
        // linkedom keeps React's `dateTime` casing, so ask for both spellings.
        const t = a.querySelector('time');
        const time = t?.getAttribute('dateTime') ?? t?.getAttribute('datetime');
        const prev = items.get(url);
        const item: FrontItem = prev ?? { url, title: '', slot, section: sec, isNews: false };
        // The lead's image and headline are separate <a>s; merge whatever each one has.
        if (heading && !headed.has(url)) { item.title = heading; headed.add(url); }
        item.title ||= aria;
        // Small cards wrap their timestamp in a <p>; only a <p> without one is a sub-headline.
        item.blurb ??= clean([...a.querySelectorAll('p')].find((p: any) => !p.querySelector('time'))?.textContent) || undefined;
        item.imageUrl ??= img ? canonical(img, BASE, true) ?? undefined : undefined;
        if (time && !item.publishedAt) item.publishedAt = new Date(time).toISOString();
        item.isNews = !NOT_NEWS.has(item.section) && !SERVICE.test(item.title);
        if (!prev) items.set(url, item);
      }
    }
    return dedupe([...items.values()].filter(i => i.title));
  },
};

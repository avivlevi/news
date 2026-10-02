/* eslint-disable @typescript-eslint/no-explicit-any */
import { BROWSER_HEADERS, canonical, clean, dedupe, type FrontItem, type FrontPageParser, type Slot } from './types.js';

const BASE = 'https://www.i24news.tv/he';

/**
 * Not news: sections whose path segment is one of these (anywhere under /he/news/) —
 * the weekend and election magazines, food, travel, consumer and real-estate, culture,
 * lifestyle, sport, Judaism and holidays, weather, health and the channel's own shows.
 * Everything else (news/*, international/*, elections, economic, opinion-and-analysis,
 * real-time-news) is news.
 */
const NOT_NEWS = new Set([
  'weekend-magazine', 'election-magazine', 'food', 'tourism', 'consumption', 'real-estate', 'culture',
  'lifestyle', 'sport', 'judaism', 'jewish-holidays', 'weather', 'health', 'i24news-shows',
]);

/**
 * Raw text of each top-level value of the `window.__PRELOADED_STATE__ = {...}` literal.
 * The literal is not JSON (and holds an arrow function under `lazyComponents`), so rather
 * than evaluate it we cut out only the keys we read, tracking strings and bracket depth.
 */
function stateSlices(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const at = html.indexOf('{', html.indexOf('__PRELOADED_STATE__'));
  if (at < 0) return out;
  let depth = 0, key = '', start = -1;
  for (let i = at; i < html.length; i++) {
    const c = html[i];
    if (c === '"') {
      let j = i + 1;
      while (j < html.length && html[j] !== '"') j += html[j] === '\\' ? 2 : 1;
      if (depth === 1 && start < 0) key = html.slice(i + 1, j);
      i = j;
    } else if (c === ':' && depth === 1 && start < 0) start = i + 1;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      if (--depth === 0) { if (start >= 0) out[key] = html.slice(start, i); break; }
    } else if (c === ',' && depth === 1) { out[key] = html.slice(start, i); start = -1; }
  }
  return out;
}

/** JSON.parse a slice after turning `new Date("…")` into the string and `undefined` into null. */
function parseSlice(raw: string | undefined): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw.replace(/("(?:[^"\\]|\\.)*")|new Date\(("[^"]*")\)|\bundefined\b/g, (_m, s, d) => s ?? d ?? 'null'));
  } catch {
    return null;
  }
}

function toItem(it: any, slot: Slot, title = it?.title): FrontItem | null {
  const url = it?.frontendUrl && canonical(it.frontendUrl, BASE);
  if (!url || !url.startsWith('https://www.i24news.tv/he/news/') || it.isSponsored) return null;
  const path = new URL(url).pathname.split('/').slice(3, -1);
  return {
    url, slot,
    title: clean(title),
    section: path.at(-1) ?? 'news',
    isNews: !path.some(p => NOT_NEWS.has(p)),
    blurb: clean(it.excerpt) || undefined,
    imageUrl: it.image?.src || undefined,
    publishedAt: it.publishedAt ? new Date(it.publishedAt).toISOString() : undefined,
  };
}

/**
 * The server HTML carries the page as Redux state, rendered in this order: the
 * `headlines` block (one big lead, four cards beside it), then `homepage.topArticles`,
 * then the category strips — which load client-side and so aren't in the HTML. Flashes
 * (`asideNewsFeed`, the timeline beside the body, and the top ticker `homepage.newsFeed`)
 * have no permalink of their own; only timeline flashes tied to an article
 * (`content.frontendUrl`, often the shared live-updates page) are kept, as ticker items
 * titled by the flash. The top ticker repeats the timeline without links.
 * Opinion-writer cards link to tag pages and are skipped.
 */
export const parser: FrontPageParser = {
  source: 'i24',
  url: BASE,
  headers: BROWSER_HEADERS,
  parse(html) {
    const s = stateSlices(html);
    const headlines: any[] = parseSlice(s.headlines)?.headlines ?? [];
    const top: any[] = parseSlice(s.homepage)?.topArticles?.list ?? [];
    const aside: any[] = parseSlice(s.asideNewsFeed)?.newsFeed ?? [];
    const items = [
      ...headlines.map(h => toItem(h?.item, 'top')),
      ...top.map(t => toItem(t?.item, 'main')),
      // The flash's own text and time, pointing at the article it links to.
      ...aside.map(f => f?.content && toItem({ ...f.content, excerpt: null, image: null, publishedAt: f.startedAt }, 'ticker', f.title)),
    ].filter((i): i is FrontItem => !!i?.title);
    if (items[0] && items[0].slot !== 'ticker') items[0].slot = 'lead';
    return dedupe(items);
  },
};

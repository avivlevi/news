import { XMLParser } from 'fast-xml-parser';
import { ALL_SOURCES } from '../../shared/sources.js';
import type { SourceId } from '../../shared/types.js';
import type { PipelineCache } from './cache.js';
import { hash, mapLimit } from './concurrency.js';
import { isGoogleNewsUrl, resolveGoogleNewsUrl } from './googlenews.js';

interface FeedMeta {
  url: string;
  viaGoogleNews?: boolean;
}

/**
 * Only ynet and N12 publish a usable RSS feed. The other four either 403 from
 * Netlify's IPs or have no feed at all, so they come through Google News search.
 */
export const FEEDS: Record<SourceId, FeedMeta> = {
  ynet:    { url: 'https://www.ynet.co.il/Integration/StoryRss2.xml' },
  n12:     { url: 'https://rcs.mako.co.il/rss/news-israel.xml' },
  c14:     { url: 'https://news.google.com/rss/search?q=site:c14.co.il&hl=he&gl=IL&ceid=IL:he', viaGoogleNews: true },
  i24:     { url: 'https://news.google.com/rss/search?q=site:i24news.tv&hl=he&gl=IL&ceid=IL:he', viaGoogleNews: true },
  t13:     { url: 'https://news.google.com/rss/search?q=site:13tv.co.il&hl=he&gl=IL&ceid=IL:he', viaGoogleNews: true },
  haaretz: { url: 'https://news.google.com/rss/search?q=site:haaretz.co.il&hl=he&gl=IL&ceid=IL:he', viaGoogleNews: true },
};

export interface RawArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: SourceId;
  imageUrl?: string;
  publishedAt: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  isArray: (_n, jpath) => jpath === 'rss.channel.item',
});

function text(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && '#text' in (val as object)) {
    return String((val as Record<string, unknown>)['#text']);
  }
  return '';
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseFeed(xml: string, source: SourceId): RawArticle[] {
  const meta = FEEDS[source];
  const items: any[] = parser.parse(xml)?.rss?.channel?.item ?? [];

  return items.flatMap(item => {
    let title = stripHtml(text(item.title));
    // Google News suffixes every headline with " - Publisher Name".
    if (meta.viaGoogleNews) title = title.replace(/\s+-\s+[^-]{2,40}$/, '').trim();
    const url = typeof item.link === 'string' ? item.link : text(item.link);
    if (!title || !url) return [];

    const rawDesc = text(item.description);
    const img =
      (Array.isArray(item['media:content'])
        ? item['media:content'].find((m: any) => m['@_url'])?.['@_url']
        : item['media:content']?.['@_url']) ??
      item['media:thumbnail']?.['@_url'] ??
      (item.enclosure?.['@_type']?.startsWith('image') ? item.enclosure['@_url'] : undefined) ??
      rawDesc.match(/src=['"]?(https?:\/\/[^'">\s]+\.(?:jpg|jpeg|png|webp)[^'">\s]*)/i)?.[1];

    return [{
      id: `${source}-${hash(url)}`,
      title,
      // Google News descriptions are just the title again, wrapped in a link.
      description: meta.viaGoogleNews ? '' : stripHtml(rawDesc).slice(0, 400),
      url,
      source,
      imageUrl: img,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    }];
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * The matcher only groups articles within 36 hours of each other, and the
 * digest describes what each site is publishing now — so anything older is
 * tokens spent on noise. Google News also mixes in evergreen pages dated
 * years back.
 */
export const MAX_AGE_HOURS = 48;

function isFresh(a: RawArticle): boolean {
  const age = Date.now() - new Date(a.publishedAt).getTime();
  return Number.isFinite(age) && age < MAX_AGE_HOURS * 3_600_000;
}

/** Swap Google's redirect links for the article's own URL, remembering each answer. */
async function resolveUrls(articles: RawArticle[], cache: PipelineCache): Promise<RawArticle[]> {
  let resolved = 0, failed = 0;
  const out = await mapLimit(articles, 8, async a => {
    if (!isGoogleNewsUrl(a.url)) return a;
    let real = await cache.getUrl(a.url).catch(() => null);
    if (!real) {
      real = await resolveGoogleNewsUrl(a.url);
      if (real) await cache.setUrl(a.url, real).catch(() => {});
    }
    if (!real) { failed++; return a; }
    resolved++;
    return { ...a, url: real, id: `${a.source}-${hash(real)}` };
  });
  if (resolved || failed) console.log(`  resolved ${resolved} Google News link(s), ${failed} unresolved`);
  return out;
}

export interface FeedResult {
  articles: RawArticle[];
  /** Sources whose feed answered, even with zero fresh items. */
  live: SourceId[];
}

/**
 * Pull every feed in parallel. Depth matters enormously here: at 5 items per
 * source no story appears on two outlets at once, so cross-source comparison
 * finds nothing at all.
 */
export async function fetchAllFeeds(perSource: number, cache: PipelineCache): Promise<FeedResult> {
  const results = await Promise.allSettled(
    ALL_SOURCES.map(async id => {
      const res = await fetch(FEEDS[id].url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
      const parsed = parseFeed(await res.text(), id);
      const fresh = parsed.filter(isFresh);
      if (fresh.length < parsed.length) {
        console.log(`  ${id}: dropped ${parsed.length - fresh.length} item(s) older than ${MAX_AGE_HOURS}h`);
      }
      return fresh.slice(0, perSource);
    })
  );

  const articles: RawArticle[] = [];
  const live: SourceId[] = [];
  for (const [i, r] of results.entries()) {
    if (r.status === 'fulfilled') { articles.push(...r.value); live.push(ALL_SOURCES[i]); }
    else console.warn(`feed failed: ${ALL_SOURCES[i]} — ${r.reason}`);
  }

  const withUrls = await resolveUrls(articles, cache);
  // The same article can surface twice once redirects are unwrapped.
  const seen = new Set<string>();
  return { articles: withUrls.filter(a => !seen.has(a.id) && seen.add(a.id)), live };
}

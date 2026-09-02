import { XMLParser } from 'fast-xml-parser';
import { SOURCES, SOURCE_IDS, type SourceId } from './sources.js';

export interface RawArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: SourceId;
  imageUrl?: string;
  publishedAt: string;
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/rss+xml, application/xml, text/xml, */*',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
};

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

function hash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseFeed(xml: string, source: SourceId): RawArticle[] {
  const meta = SOURCES[source];
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
      description: stripHtml(rawDesc).slice(0, 400),
      url,
      source,
      imageUrl: img,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    }];
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Google News feeds mix in evergreen section pages dated years back. */
const MAX_AGE_DAYS = 7;

function isFresh(a: RawArticle): boolean {
  const age = Date.now() - new Date(a.publishedAt).getTime();
  return Number.isFinite(age) && age < MAX_AGE_DAYS * 86_400_000;
}

/**
 * Pull every feed in parallel. Depth matters enormously here: at 5 items per
 * source no story appears on two outlets at once, so cross-source comparison
 * finds nothing at all.
 */
export async function fetchAllFeeds(perSource = 30): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    SOURCE_IDS.map(async id => {
      const meta = SOURCES[id];
      const res = await fetch(meta.feed, {
        headers: meta.needsBrowserHeaders ? BROWSER_HEADERS : undefined,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
      const parsed = parseFeed(await res.text(), id);
      const fresh = parsed.filter(isFresh);
      if (fresh.length < parsed.length) {
        console.log(`  ${id}: dropped ${parsed.length - fresh.length} item(s) older than ${MAX_AGE_DAYS}d`);
      }
      return fresh.slice(0, perSource);
    })
  );

  const articles: RawArticle[] = [];
  for (const [i, r] of results.entries()) {
    if (r.status === 'fulfilled') articles.push(...r.value);
    else console.warn(`feed failed: ${SOURCE_IDS[i]} — ${r.reason}`);
  }
  return articles;
}

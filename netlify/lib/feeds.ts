import { XMLParser } from 'fast-xml-parser';
import { ALL_SOURCES } from '../../shared/sources.js';
import type { SourceId } from '../../shared/types.js';
import type { PipelineCache } from './cache.js';
import { hash, mapLimit } from './concurrency.js';
import { isGoogleNewsUrl, resolveGoogleNewsUrl } from './googlenews.js';

type FeedMeta =
  | { kind: 'rss'; urls: string[] }
  | { kind: 'sitemap'; url: string }
  /** A Next.js page whose embedded data lists the articles it shows. */
  | { kind: 'page'; url: string }
  | { kind: 'google'; url: string };

/**
 * Where each outlet's list of current articles comes from, best source first:
 *
 * - ynet, הארץ, ערוץ 14 and i24 publish Google-News sitemaps: every article of
 *   the last two days with title and time, at the article's own URL.
 * - N12 publishes RSS per section, 20 items each, so several are merged.
 * - חדשות 13 has neither a feed nor a sitemap, but its news front page embeds
 *   the ~80 articles it currently shows, with titles, times and links.
 * - `google` is the fallback for a site with none of the above: Google News
 *   search RSS. Those links are Google redirects, resolved lazily only for
 *   articles that match another outlet — Google rate-limits after ~100 lookups.
 */
export const FEEDS: Record<SourceId, FeedMeta> = {
  ynet:    { kind: 'sitemap', url: 'https://www.ynet.co.il/iphone/json/api/20m/google_site_map/8-2-3-6-538-1208-550-544-4003' },
  n12:     { kind: 'rss', urls: ['news-israel', 'news-military', 'news-world', 'news-law', 'news-money']
               .map(s => `https://rcs.mako.co.il/rss/${s}.xml`) },
  haaretz: { kind: 'sitemap', url: 'https://www.haaretz.co.il/news-sitemap-content.xml' },
  c14:     { kind: 'sitemap', url: 'https://www.c14.co.il/news-sitemap.xml' },
  i24:     { kind: 'sitemap', url: 'https://www.i24news.tv/he/sitemapgooglenews.xml' },
  t13:     { kind: 'page', url: 'https://13tv.co.il/news/' },
};

/** 13tv's bot-wall rejects a browser UA that doesn't run JavaScript, yet serves a plain one. */
const PLAIN_UA = { 'User-Agent': 'oto-eruah/2.0 (+https://israel-news-aggregator.netlify.app)', Accept: 'text/html,*/*' };

const BROWSER_UA = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/xml,text/xml,*/*',
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
  isArray: (_n, jpath) => jpath === 'rss.channel.item' || jpath === 'urlset.url' || jpath === 'urlset.url.image:image',
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
  const viaGoogle = FEEDS[source].kind === 'google';
  const items: any[] = parser.parse(xml)?.rss?.channel?.item ?? [];

  return items.flatMap(item => {
    let title = stripHtml(text(item.title));
    // Google News suffixes every headline with " - Publisher Name".
    if (viaGoogle) title = title.replace(/\s+-\s+[^-]{2,40}$/, '').trim();
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
      description: viaGoogle ? '' : stripHtml(rawDesc).slice(0, 400),
      url,
      source,
      imageUrl: img,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    }];
  });
}
/** Google-News sitemap: <url> entries with news:title, news:publication_date and image:loc. */
function parseSitemap(xml: string, source: SourceId): RawArticle[] {
  const urls: any[] = parser.parse(xml)?.urlset?.url ?? [];
  return urls.flatMap(u => {
    const url = text(u.loc);
    const news = u['news:news'] ?? {};
    const title = stripHtml(text(news['news:title']));
    const date = text(news['news:publication_date']) || text(u.lastmod);
    if (!url || !title) return [];
    const images: any[] = u['image:image'] ?? [];
    const img = images.map(i => text(i?.['image:loc'])).find(Boolean);
    return [{
      id: `${source}-${hash(url)}`,
      title,
      description: '',
      url,
      source,
      imageUrl: img || undefined,
      publishedAt: date ? new Date(date).toISOString() : new Date().toISOString(),
    }];
  });
}
/** Israel local time as the site prints it ("2026-09-02 21:00:07") to ISO, DST-aware. */
function jerusalemToIso(local: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
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

/** Every `posts` array in a Next.js page's embedded data, wherever it sits. */
function parseNextPage(html: string, source: SourceId, base: string): RawArticle[] {
  const raw = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)?.[1];
  if (!raw) return [];
  const posts: any[] = [];
  const walk = (o: any) => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o.posts)) posts.push(...o.posts);
    Object.values(o).forEach(walk);
  };
  walk(JSON.parse(raw));

  return posts.flatMap(p => {
    const link = typeof p?.link === 'string' ? p.link : '';
    const title = stripHtml(String(p?.title ?? ''));
    if (!link || !title || p.isPromotionalItem) return [];
    const url = new URL(link, base).toString();
    const when = jerusalemToIso(String(p.publishDate || p.updateDate || ''));
    if (!when) return [];
    const img = typeof p.image === 'string' ? p.image : p.imageObj?.src ?? p.imageObj?.url;
    return [{
      id: `${source}-${hash(url)}`,
      title,
      description: stripHtml(String(p.secondaryTitle ?? '')).slice(0, 400),
      url,
      source,
      imageUrl: typeof img === 'string' && img.startsWith('http') ? img : undefined,
      publishedAt: when,
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

/**
 * Swap Google's redirect links for the article's own URL, in place, remembering
 * each answer. Called only for articles that matched another outlet: Google
 * answers ~100 lookups per IP before it starts refusing.
 */
export async function resolveGoogleUrls(articles: RawArticle[], cache: PipelineCache): Promise<void> {
  const pending = articles.filter(a => isGoogleNewsUrl(a.url));
  if (pending.length === 0) return;
  let resolved = 0, failed = 0;
  await mapLimit(pending, 2, async a => {
    let real = await cache.getUrl(a.url).catch(() => null);
    if (!real) {
      real = await resolveGoogleNewsUrl(a.url);
      if (real) await cache.setUrl(a.url, real).catch(() => {});
    }
    if (!real) { failed++; return; }
    resolved++;
    a.url = real;
  });
  console.log(`  resolved ${resolved} Google News link(s), ${failed} unresolved`);
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
async function fetchText(url: string, headers: Record<string, string> = BROWSER_UA): Promise<string> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000), redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchSource(id: SourceId): Promise<RawArticle[]> {
  const meta = FEEDS[id];
  if (meta.kind === 'sitemap') return parseSitemap(await fetchText(meta.url), id);
  if (meta.kind === 'page') return parseNextPage(await fetchText(meta.url, PLAIN_UA), id, meta.url);
  if (meta.kind === 'google') return parseFeed(await fetchText(meta.url), id);
  const feeds = await Promise.allSettled(meta.urls.map(async url => parseFeed(await fetchText(url), id)));
  if (feeds.every(f => f.status === 'rejected')) {
    throw (feeds[0] as PromiseRejectedResult).reason;
  }
  return feeds.flatMap(f => (f.status === 'fulfilled' ? f.value : []));
}

/**
 * Pull every outlet in parallel. Depth matters enormously here: at 5 items per
 * source no story appears on two outlets at once, so cross-source comparison
 * finds nothing at all. Every outlet contributes its newest `perSource`.
 */
export async function fetchAllFeeds(perSource: number, sources: SourceId[] = ALL_SOURCES): Promise<FeedResult> {
  const results = await Promise.allSettled(
    sources.map(async id => {
      const parsed = await fetchSource(id);
      // Several feeds can carry the same item; the newest `perSource` win.
      const seen = new Set<string>();
      const fresh = parsed
        .filter(a => isFresh(a) && !seen.has(a.url) && seen.add(a.url))
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      console.log(`  ${id}: ${parsed.length} item(s), ${fresh.length} fresh, keeping ${Math.min(fresh.length, perSource)}`);
      return fresh.slice(0, perSource);
    })
  );

  const articles: RawArticle[] = [];
  const live: SourceId[] = [];
  for (const [i, r] of results.entries()) {
    if (r.status === 'fulfilled') { articles.push(...r.value); live.push(sources[i]); }
    else console.warn(`feed failed: ${sources[i]} — ${r.reason}`);
  }
  return { articles, live };
}

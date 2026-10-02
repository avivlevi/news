import { ALL_SOURCES } from '../../shared/sources.js';
import type { Exposure, Slot, SourceId, Story } from '../../shared/types.js';
import type { CachedBody, PipelineCache } from './cache.js';
import { hash } from './concurrency.js';
import { articleExposure, db, recentFrontArticles } from './db.js';
import { fetchAllFeeds, type FeedResult, type RawArticle } from './feeds.js';
import { scrapeAndRecord } from './scrape/index.js';

/**
 * How far back "currently displayed" reaches. A story that led the page this
 * morning and was gone by noon still belongs in today's comparison.
 */
const FRONT_HOURS = 24;

export interface Collected extends FeedResult {
  /** Full text already read by the hourly job, by URL. */
  bodies: Map<string, CachedBody>;
  /** Where the articles came from, for the log. */
  via: Record<SourceId, 'front' | 'feed'>;
}

/** Same article whatever query string or fragment a feed or page put on it. */
const key = (url: string) => url.replace(/[?#].*$/, '').replace(/\/$/, '');

/**
 * The articles to compare. Two questions, two sources:
 *
 * - "Did the outlet report it?" — everything it published, from its feed or
 *   sitemap. Some front pages (הארץ, i24) render only their top screens to a
 *   server, so the front page alone would make an outlet look like it skipped
 *   stories it ran further down.
 * - "Did it display it?" — the hourly front-page record, attached afterwards
 *   as exposure.
 *
 * Front-page articles from the last day come first, then the newest feed
 * articles fill each outlet up to `perSource`. A fresh scrape runs first so
 * the newest hour is included. Without a database, feeds alone.
 */
export async function collectArticles(perSource: number): Promise<Collected> {
  const empty = { bodies: new Map<string, CachedBody>(), via: {} as Record<SourceId, 'front' | 'feed'> };
  if (!db()) {
    console.log('  no database configured — reading feeds');
    const feeds = await fetchAllFeeds(perSource);
    return { ...feeds, ...empty, via: Object.fromEntries(feeds.live.map(s => [s, 'feed'])) as Collected['via'] };
  }

  const [feeds] = await Promise.all([
    fetchAllFeeds(perSource),
    scrapeAndRecord().catch(e => console.warn('  scrape before run failed:', e)),
  ]);

  const out: Collected = { articles: [], live: [], ...empty };
  await Promise.all(ALL_SOURCES.map(async source => {
    const rows = await recentFrontArticles(source, FRONT_HOURS, perSource).catch(e => {
      console.warn(`  ${source}: front-page record unavailable — ${e instanceof Error ? e.message : e}`);
      return [];
    });
    const seen = new Set(rows.map(r => key(r.url)));
    const extra = feeds.articles
      .filter(a => a.source === source && !seen.has(key(a.url)))
      .slice(0, Math.max(0, perSource - rows.length));
    if (rows.length === 0 && !feeds.live.includes(source)) return;

    out.live.push(source);
    out.via[source] = rows.length > 0 ? 'front' : 'feed';
    for (const r of rows) {
      out.articles.push({
        id: `${source}-${hash(r.url)}`,
        title: r.title,
        description: r.blurb ?? '',
        url: r.url,
        source,
        imageUrl: r.image_url ?? undefined,
        publishedAt: r.published_at ?? r.first_seen_at,
      } satisfies RawArticle);
      if (r.body_read === 'full' && r.body) {
        out.bodies.set(r.url, { text: r.body, fetchedAt: r.body_fetched_at ?? r.first_seen_at });
      }
    }
    out.articles.push(...extra);
    console.log(`  ${source}: ${rows.length} from the front page (${rows.filter(r => r.body_read === 'full').length} already read) + ${extra.length} from the feed`);
  }));
  return out;
}

/** Serve bodies the hourly job already read before touching the network. */
export function withStoredBodies(cache: PipelineCache, bodies: Map<string, CachedBody>): PipelineCache {
  return {
    ...cache,
    getBody: async url => bodies.get(url) ?? cache.getBody(url),
  };
}

/**
 * Attach front-page exposure to every take, in place. Done after analysis and
 * for reused stories too, since exposure keeps changing after the text doesn't.
 */
export async function attachExposure(stories: Story[]): Promise<void> {
  if (!db()) return;
  const urls = [...new Set(stories.flatMap(s => s.takes.map(t => t.url)))];
  const rows = await articleExposure(urls).catch(e => {
    console.warn('  exposure unavailable:', e instanceof Error ? e.message : e);
    return [];
  });
  const byUrl = new Map(rows.map(r => [r.url, r]));
  for (const s of stories) {
    for (const t of s.takes) {
      const r = byUrl.get(t.url);
      if (!r) { delete t.exposure; continue; }
      t.exposure = {
        firstSeen: r.first_seen_at,
        lastSeen: r.last_seen_at,
        bestPosition: r.best_position,
        bestSlot: r.best_slot as Slot,
        snapshotsSeen: r.snapshots_seen,
        snapshotsTotal: Math.max(r.snapshots_total, r.snapshots_seen),
        leadSnapshots: r.lead_snapshots,
        onFrontNow: r.on_front_now,
        titles: r.titles,
      } satisfies Exposure;
    }
  }
}

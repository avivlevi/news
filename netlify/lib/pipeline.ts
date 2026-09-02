import { ALL_SOURCES, SOURCES } from '../../shared/sources.js';
import { STORY_SCHEMA, type Story, type StoriesPayload } from '../../shared/types.js';
import { analyseStory, membersOf, storyId } from './analyse.js';
import { type PipelineCache, noCache } from './cache.js';
import { mapLimit } from './concurrency.js';
import { buildDigest } from './digest.js';
import { fetchBody, type Body } from './extract.js';
import { fetchAllFeeds, resolveGoogleUrls, type RawArticle } from './feeds.js';
import { runIdFor } from './history.js';
import { makeClient } from './llm.js';
import { matchStories, mergeGroups, type MatchGroup } from './match.js';

/**
 * Newest articles kept per outlet. The busiest sites publish 150+ a day, so
 * this is a few hours of their output against a whole day of a quiet one — the
 * matcher's 36h window and the digest both see exactly this slice.
 */
export const PER_SOURCE = 50;

export type Progress = (stage: string, detail: string) => Promise<unknown> | void;

export interface PipelineOptions {
  perSource?: number;
  cache?: PipelineCache;
  onProgress?: Progress;
  /** Ignore previous analyses even when the event is unchanged. */
  noReuse?: boolean;
}

/** Full text for every article that made it into a group, cached, a few at a time. */
async function readBodies(groups: MatchGroup[], articles: RawArticle[], cache: PipelineCache) {
  const wanted = [...new Set(groups.flatMap(g => membersOf(g, articles)))];
  await resolveGoogleUrls(wanted, cache);
  const bodies = new Map<string, Body>();
  await mapLimit(wanted, 6, async a => {
    bodies.set(a.id, await fetchBody(a.url, `${a.title}. ${a.description}`.trim(), cache));
  });
  const full = [...bodies.values()].filter(b => b.read === 'full').length;
  console.log(`  read ${full}/${wanted.length} article bodies in full`);
  return bodies;
}

export async function buildStories(apiKey: string, opts: PipelineOptions = {}): Promise<StoriesPayload> {
  const t0 = Date.now();
  const cache = opts.cache ?? noCache;
  const client = makeClient(apiKey);
  const report = async (stage: string, detail: string) => {
    console.log(`${stage}: ${detail}`);
    await opts.onProgress?.(stage, detail);
  };

  await report('collecting', 'אוסף כתבות מהמקורות');
  const [{ articles, live }, previous] = await Promise.all([
    fetchAllFeeds(opts.perSource ?? PER_SOURCE),
    opts.noReuse ? Promise.resolve([] as Story[]) : cache.previousStories().catch(() => [] as Story[]),
  ]);

  // The digest reads every article and the matcher only needs the same list,
  // so the two run together rather than one after the other.
  await report('summarising', `${articles.length} כתבות — מסכם מה כל אתר פרסם`);
  const [digest, matched] = await Promise.all([
    buildDigest(client, articles),
    matchStories(client, articles),
  ]);

  // Bodies are needed only after the merge, but nothing about them depends on
  // it — so the downloads run while the merge model thinks.
  await report('matching', `${matched.length} אירועים — מאחד כפילויות וקורא את הכתבות`);
  const [groups, bodies] = await Promise.all([
    mergeGroups(client, matched),
    readBodies(matched, articles, cache),
  ]);

  // An event whose member articles haven't changed since last run gets the
  // previous analysis back verbatim. Most runs re-see most events.
  const reusable = new Map(
    previous.filter(s => s.schema === STORY_SCHEMA).map(s => [s.id, s])
  );
  const work = groups.map(g => {
    const members = membersOf(g, articles);
    return { g, members, reuse: reusable.get(storyId(members)) ?? null };
  });
  const fresh = work.filter(w => !w.reuse);

  await report('comparing', `${groups.length} אירועים — ${fresh.length} חדשים לניתוח, ${work.length - fresh.length} ללא שינוי`);
  const settled = await mapLimit(fresh, 5, async w => {
    try {
      const missing = w.members.filter(m => !bodies.has(m.id));
      await resolveGoogleUrls(missing, cache);
      for (const m of missing) bodies.set(m.id, await fetchBody(m.url, `${m.title}. ${m.description}`.trim(), cache));
      return await analyseStory(client, w.g, w.members, bodies);
    } catch (e) {
      console.warn('analysis failed:', e instanceof Error ? e.message : e);
      return null;
    }
  });

  // Newest event first. No ranking — every story carries the same weight.
  const stories = [
    ...work.flatMap(w => (w.reuse ? [w.reuse] : [])),
    ...settled.flatMap(s => (s ? [s] : [])),
  ].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));

  const seconds = Math.round((Date.now() - t0) / 1000);
  await report('done', `${stories.length} אירועים`);

  return {
    runId: runIdFor(),
    stories,
    digest: digest.sort((a, b) => SOURCES[a.source].name.localeCompare(SOURCES[b.source].name, 'he')),
    generatedAt: new Date().toISOString(),
    stats: {
      articlesScanned: articles.length,
      storiesFound: stories.length,
      sourcesLive: live.length,
      totalSources: ALL_SOURCES.length,
      reused: work.length - fresh.length,
      seconds,
    },
  };
}

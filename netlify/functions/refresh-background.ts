import { getStore } from '@netlify/blobs';
import { blobCache } from '../lib/cache.js';
import { appendRun, summarise } from '../lib/history.js';
import { buildStories } from '../lib/pipeline.js';
import type { RunStatus, RunStage, RunSummary, StoriesPayload } from '../../shared/types.js';

const STORE = 'news';
const RUNNING: RunStage[] = ['collecting', 'summarising', 'matching', 'reading', 'comparing'];
/** Past this, a "running" status is assumed to be a crashed run, not a live one. */
const STALE_MS = 15 * 60 * 1000;

/**
 * Runs only when someone presses the button — there is no schedule. It writes
 * its stage to a blob as it goes so the page can follow a job that outlives the
 * request which started it.
 */
export default async () => {
  const store = getStore(STORE);
  const startedAt = new Date().toISOString();

  const write = (stage: RunStage, detail: string, finished = false) =>
    store.setJSON('status', {
      stage,
      detail,
      startedAt,
      finishedAt: finished ? new Date().toISOString() : null,
    } satisfies RunStatus);

  // Two runs writing the same blob means the slower one wins, whatever it found.
  const current = (await store.get('status', { type: 'json' })) as RunStatus | null;
  if (
    current &&
    RUNNING.includes(current.stage) &&
    current.startedAt &&
    Date.now() - new Date(current.startedAt).getTime() < STALE_MS
  ) {
    console.log('refresh skipped — a run is already in progress');
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await write('failed', 'מפתח ה-API אינו מוגדר', true);
    return;
  }

  try {
    await write('collecting', 'מתחיל');
    const payload = await buildStories(apiKey, {
      cache: blobCache(store),
      onProgress: (stage, detail) => write(stage as RunStage, detail, false),
    });

    // An empty result is a failed run, not a news day with nothing shared.
    // Never let it replace a good payload.
    if (payload.stories.length === 0) {
      const existing = (await store.get('stories', { type: 'json' })) as StoriesPayload | null;
      if (existing?.stories?.length) {
        console.warn('refresh produced 0 stories — keeping the previous payload');
        await write('failed', 'האיסוף לא מצא אירועים משותפים. הנתונים הקודמים נשמרו.', true);
        return;
      }
    }

    // Every run is kept: the latest under `stories`, all of them under `runs/`.
    const index = ((await store.get('runs-index', { type: 'json' })) as RunSummary[] | null) ?? [];
    const { index: nextIndex, dropped } = appendRun(index, summarise(payload));
    await Promise.all([
      store.setJSON('stories', payload),
      store.setJSON(`runs/${payload.runId}`, payload),
      store.setJSON('runs-index', nextIndex),
      ...dropped.map(id => store.delete(`runs/${id}`).catch(() => {})),
    ]);
    await write('done', `${payload.stats.storiesFound} אירועים`, true);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('refresh failed:', e instanceof Error ? e.stack : e);
    await write('failed', msg.slice(0, 200), true);
  }
};

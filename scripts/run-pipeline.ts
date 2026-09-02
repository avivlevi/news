/**
 * Runs the whole pipeline from the terminal, without netlify dev or the button.
 *
 *   npm run pipeline                  full run, writes data/runs/<id>.json + data/latest.json
 *   npm run pipeline -- --publish     also drops the result into the local netlify dev blob store
 *   npm run pipeline -- --no-reuse    re-analyse every event even if unchanged since last run
 *   npm run pipeline -- --per-source 10
 *
 * The API key comes from ANTHROPIC_API_KEY, then .env, then `netlify env:get`.
 */
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileCache } from '../netlify/lib/cache.js';
import { appendRun, summarise } from '../netlify/lib/history.js';
import { buildStories } from '../netlify/lib/pipeline.js';
import type { RunSummary, StoriesPayload, Story } from '../shared/types.js';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const ROOT = process.cwd();
const DATA = join(ROOT, 'data');
const RUNS = join(DATA, 'runs');

function apiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const envFile = join(ROOT, '.env');
  if (existsSync(envFile)) {
    const m = readFileSync(envFile, 'utf8').match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  try {
    return execFileSync('netlify', ['env:get', 'ANTHROPIC_API_KEY'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    throw new Error('No ANTHROPIC_API_KEY in the environment, .env, or Netlify.');
  }
}

async function readJson<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await fs.readFile(path, 'utf8')) as T; } catch { return null; }
}

/** Mirrors the layout netlify dev's local blob server uses, so the UI shows this run. */
async function publishLocal(payload: StoriesPayload, index: RunSummary[]) {
  const state = await readJson<{ siteId?: string }>(join(ROOT, '.netlify', 'state.json'));
  if (!state?.siteId) { console.warn('no .netlify/state.json — skipping --publish'); return; }
  const base = join(ROOT, '.netlify', 'blobs-serve');
  const put = async (key: string, value: unknown) => {
    for (const kind of ['entries', 'metadata']) {
      const file = join(base, kind, state.siteId!, 'site:news', ...key.split('/'));
      await fs.mkdir(join(file, '..'), { recursive: true });
      await fs.writeFile(file, kind === 'entries' ? JSON.stringify(value) : '{}');
    }
  };
  await put('stories', payload);
  await put(`runs/${payload.runId}`, payload);
  await put('runs-index', index);
  console.log('published to the local netlify dev blob store');
}

const key = apiKey();
await fs.mkdir(RUNS, { recursive: true });

const cache = fileCache(join(DATA, 'cache'), async () => {
  const prev = await readJson<StoriesPayload>(join(DATA, 'latest.json'));
  return (prev?.stories ?? []) as Story[];
});

const payload = await buildStories(key, {
  cache,
  perSource: Number(opt('--per-source') ?? 30),
  noReuse: flag('--no-reuse'),
});

const index = (await readJson<RunSummary[]>(join(DATA, 'runs-index.json'))) ?? [];
const { index: nextIndex } = appendRun(index, summarise(payload));

await fs.writeFile(join(RUNS, `${payload.runId}.json`), JSON.stringify(payload, null, 2));
await fs.writeFile(join(DATA, 'latest.json'), JSON.stringify(payload, null, 2));
await fs.writeFile(join(DATA, 'runs-index.json'), JSON.stringify(nextIndex, null, 2));
console.log(`\n${payload.stats.storiesFound} events, ${payload.stats.articlesScanned} articles, ${payload.stats.seconds}s → data/runs/${payload.runId}.json`);

if (flag('--publish')) await publishLocal(payload, nextIndex);

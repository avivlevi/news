import { getStore, type Store } from '@netlify/blobs';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { Story } from '../../shared/types.js';
import { hash } from './concurrency.js';

export interface CachedBody {
  text: string;
  image?: string;
  fetchedAt: string;
}

/**
 * Everything the pipeline remembers between runs. Two implementations: Netlify
 * Blobs in production, a plain directory for the CLI.
 */
export interface PipelineCache {
  getBody(url: string): Promise<CachedBody | null>;
  setBody(url: string, body: CachedBody): Promise<unknown>;
  getUrl(googleUrl: string): Promise<string | null>;
  setUrl(googleUrl: string, real: string): Promise<unknown>;
  /** Stories from the last run, so unchanged events skip the model. */
  previousStories(): Promise<Story[]>;
}

export const BODY_TTL_MS = 24 * 3_600_000;

export const noCache: PipelineCache = {
  getBody: async () => null,
  setBody: async () => {},
  getUrl: async () => null,
  setUrl: async () => {},
  previousStories: async () => [],
};

export function blobCache(newsStore: Store): PipelineCache {
  const bodies = getStore('bodies');
  const urls = getStore('urls');
  return {
    getBody: url => bodies.get(hash(url), { type: 'json' }) as Promise<CachedBody | null>,
    setBody: (url, body) => bodies.setJSON(hash(url), body),
    getUrl: async g => (await urls.get(hash(g), { type: 'text' })) ?? null,
    setUrl: (g, real) => urls.set(hash(g), real),
    previousStories: async () => {
      const p = (await newsStore.get('stories', { type: 'json' })) as { stories?: Story[] } | null;
      return p?.stories ?? [];
    },
  };
}

export function fileCache(dir: string, previous: () => Promise<Story[]>): PipelineCache {
  const read = async (name: string) => {
    try { return await fs.readFile(join(dir, name), 'utf8'); } catch { return null; }
  };
  const write = async (name: string, data: string) => {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, name), data);
  };
  return {
    getBody: async url => { const s = await read(`body-${hash(url)}.json`); return s ? JSON.parse(s) : null; },
    setBody: (url, body) => write(`body-${hash(url)}.json`, JSON.stringify(body)),
    getUrl: url => read(`url-${hash(url)}.txt`),
    setUrl: (g, real) => write(`url-${hash(g)}.txt`, real),
    previousStories: previous,
  };
}

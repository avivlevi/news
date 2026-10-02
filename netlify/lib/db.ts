import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SourceId } from '../../shared/types.js';
import type { FrontItem } from './scrape/types.js';

/**
 * The front-page record lives in Supabase Postgres. Only server code talks to
 * it, with the service-role key; the browser goes through our functions.
 */

/** Netlify sets env vars; the CLI scripts read them from .env. */
function env(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const file = join(process.cwd(), '.env');
  if (!existsSync(file)) return undefined;
  const m = readFileSync(file, 'utf8').match(new RegExp(`^${name}=(.+)$`, 'm'));
  return m?.[1].trim().replace(/^["']|["']$/g, '');
}

let client: SupabaseClient | null | undefined;

/** Null when the database isn't configured, so callers can fall back to feeds. */
export function db(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

function must(): SupabaseClient {
  const c = db();
  if (!c) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set');
  return c;
}

export async function recordSnapshot(source: SourceId, items: FrontItem[], error: string | null) {
  const { data, error: e } = await must().rpc('record_snapshot', {
    p_source: source, p_items: items, p_error: error,
  });
  if (e) throw new Error(`record_snapshot(${source}): ${e.message}`);
  return data as { snapshot: number; new: number; retitled: number };
}

export interface StoredArticle {
  id: number;
  source: SourceId;
  url: string;
  title: string;
  blurb: string | null;
  image_url: string | null;
  published_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  best_position: number;
  body: string | null;
  body_read: 'full' | 'failed' | null;
  body_fetched_at: string | null;
}

/** News articles each outlet displayed within the last `hours`, newest first. */
export async function recentFrontArticles(source: SourceId, hours: number, limit: number): Promise<StoredArticle[]> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { data, error } = await must()
    .from('articles')
    .select('id,source,url,title,blurb,image_url,published_at,first_seen_at,last_seen_at,best_position,body,body_read,body_fetched_at')
    .eq('source', source)
    .eq('is_news', true)
    .gte('last_seen_at', since)
    .order('first_seen_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`articles(${source}): ${error.message}`);
  return data as StoredArticle[];
}

/** News articles first seen recently whose text hasn't been read yet. */
export async function pendingBodies(hours: number, limit: number): Promise<{ id: number; url: string }[]> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { data, error } = await must()
    .from('articles')
    .select('id,url')
    .is('body_read', null)
    .eq('is_news', true)
    .gte('first_seen_at', since)
    .order('first_seen_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`pending bodies: ${error.message}`);
  return data ?? [];
}

export async function saveBody(id: number, body: { text: string; wordCount: number } | null) {
  const { error } = await must()
    .from('articles')
    .update(body
      ? { body: body.text, body_read: 'full', word_count: body.wordCount, body_fetched_at: new Date().toISOString() }
      : { body_read: 'failed', body_fetched_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`save body ${id}: ${error.message}`);
}

export interface ExposureRow {
  url: string;
  source: SourceId;
  first_seen_at: string;
  last_seen_at: string;
  best_position: number;
  best_slot: string;
  snapshots_seen: number;
  snapshots_total: number;
  lead_snapshots: number;
  on_front_now: boolean;
  titles: { title: string; at: string }[];
}

export async function articleExposure(urls: string[]): Promise<ExposureRow[]> {
  if (urls.length === 0) return [];
  const { data, error } = await must().rpc('article_exposure', { p_urls: urls });
  if (error) throw new Error(`article_exposure: ${error.message}`);
  return (data ?? []) as ExposureRow[];
}

/** Any read-only RPC the API functions expose. */
export async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await must().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

import { extractFromHtml } from '@extractus/article-extractor';
import type { PipelineCache, CachedBody } from './cache.js';
import { BODY_TTL_MS } from './cache.js';

const BROWSER = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
};
/** Some bot-walls (13tv) reject a browser UA that doesn't run JavaScript, yet serve a plain one. */
const PLAIN = { 'User-Agent': 'oto-eruah/2.0 (+https://israel-news-aggregator.netlify.app)', Accept: 'text/html' };

export interface Body {
  text: string;
  image?: string;
  read: 'full' | 'blurb';
  wordCount?: number;
}

function toText(html: string): string {
  return html
    .replace(/<(?:p|br|\/p|li|h[1-6]|\/h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 25)
    .join('\n');
}

export const countWords = (text: string) => text.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;

async function fetchHtml(url: string): Promise<string | null> {
  for (const headers of [BROWSER, PLAIN]) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000), redirect: 'follow' });
      if (res.ok) return await res.text();
      if (res.status !== 403 && res.status !== 406) return null;
    } catch {
      return null;
    }
  }
  return null;
}

async function download(url: string): Promise<CachedBody | null> {
  const html = await fetchHtml(url);
  if (!html) return null;
  try {
    const art = await extractFromHtml(html, url);
    const text = toText(art?.content ?? '');
    if (text.length < 200) return null;
    return { text: text.slice(0, 7000), image: art?.image || undefined, fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

/**
 * Best-effort full text, cached by URL. Comparison degrades gracefully to the
 * RSS blurb when a paywall or bot-wall wins — and says so, rather than letting
 * a short blurb look like an outlet that omitted the facts.
 */
export async function fetchBody(url: string, fallback: string, cache: PipelineCache): Promise<Body> {
  const cached = await cache.getBody(url).catch(() => null);
  const fresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < BODY_TTL_MS;
  const body = fresh ? cached : await download(url);
  if (body && !fresh) await cache.setBody(url, body).catch(() => {});
  if (!body) return { text: fallback, read: 'blurb' };
  return { text: body.text, image: body.image, read: 'full', wordCount: countWords(body.text) };
}

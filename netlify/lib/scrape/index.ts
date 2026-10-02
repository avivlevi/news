import type { SourceId } from '../../../shared/types.js';
import { recordSnapshot } from '../db.js';
import { parser as c14 } from './c14.js';
import { parser as haaretz } from './haaretz.js';
import { parser as i24 } from './i24.js';
import { parser as n12 } from './n12.js';
import { parser as t13 } from './t13.js';
import { BROWSER_HEADERS, PLAIN_HEADERS, type FrontItem, type FrontPageParser } from './types.js';
import { parser as ynet } from './ynet.js';

export const PARSERS: Record<SourceId, FrontPageParser> = { c14, haaretz, i24, n12, t13, ynet };

/**
 * Below this a page almost certainly changed layout or served a bot-wall, not
 * a quiet news hour. Such a scrape is kept with an error so the gap is visible,
 * and it doesn't count as the outlet "dropping" every story it had.
 */
const MIN_ITEMS = 10;
/** i24's server HTML carries only its headline blocks, about a dozen items. */
const MIN_FOR: Partial<Record<SourceId, number>> = { i24: 5 };

export interface ScrapeResult {
  source: SourceId;
  items: FrontItem[];
  error: string | null;
  ms: number;
}

/**
 * Bot-walls differ: some refuse a browser user agent that runs no JavaScript,
 * others refuse anything that isn't a browser, and some only from a data
 * centre (Netlify) rather than a home connection. A refusal gets one retry
 * with the other kind of headers.
 */
async function fetchPage(p: FrontPageParser): Promise<Response> {
  const first = p.headers ?? BROWSER_HEADERS;
  const second = first === PLAIN_HEADERS ? BROWSER_HEADERS : PLAIN_HEADERS;
  let res: Response | null = null;
  for (const headers of [first, second]) {
    res = await fetch(p.url, { headers, signal: AbortSignal.timeout(15_000), redirect: 'follow' });
    if (res.status !== 403 && res.status !== 406 && res.status !== 429) return res;
  }
  return res!;
}

export async function scrapeOne(p: FrontPageParser): Promise<ScrapeResult> {
  const t0 = Date.now();
  try {
    const res = await fetchPage(p);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // A ticker sits beside the page body, not above it: count body positions
    // first so "position 5" means the same thing on every site.
    const parsed = p.parse(await res.text());
    const items = [...parsed.filter(i => i.slot !== 'ticker'), ...parsed.filter(i => i.slot === 'ticker')];
    const error = items.length < (MIN_FOR[p.source] ?? MIN_ITEMS) ? `only ${items.length} items parsed` : null;
    return { source: p.source, items, error, ms: Date.now() - t0 };
  } catch (e) {
    return { source: p.source, items: [], error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
  }
}

/** Every front page in parallel. One outlet failing never blocks the rest. */
export const scrapeAll = () => Promise.all(Object.values(PARSERS).map(scrapeOne));

/** Scrape every front page and record each as a snapshot. */
export async function scrapeAndRecord(): Promise<ScrapeResult[]> {
  const results = await scrapeAll();
  await Promise.all(results.map(async r => {
    try {
      const saved = await recordSnapshot(r.source, r.error ? [] : r.items, r.error);
      console.log(`  ${r.source}: ${r.items.length} items in ${r.ms}ms, ${saved.new} new, ${saved.retitled} retitled${r.error ? ` — ${r.error}` : ''}`);
    } catch (e) {
      console.error(`  ${r.source}: not recorded — ${e instanceof Error ? e.message : e}`);
      r.error ??= 'not recorded';
    }
  }));
  return results;
}

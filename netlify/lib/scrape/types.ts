import type { Slot, SourceId } from '../../../shared/types.js';

export type { Slot };

/** One link as a front page displays it, in the order a reader meets it. */
export interface FrontItem {
  /** Absolute, canonical article URL: no tracking params, no fragment. */
  url: string;
  /** The headline exactly as the front page shows it (may differ from the article's own). */
  title: string;
  slot: Slot;
  /** The outlet's section, taken from the URL or the page data ("news", "sport", "magazine"…). */
  section: string;
  /** False for lifestyle, sport, food, shows, promos — anything that isn't news. */
  isNews: boolean;
  /** Sub-headline / teaser as shown, if any. */
  blurb?: string;
  imageUrl?: string;
  /** ISO time if the page data states one. */
  publishedAt?: string;
}

export interface FrontPageParser {
  source: SourceId;
  /** The page a reader opens. */
  url: string;
  /** Request headers, when the default browser ones are refused. */
  headers?: Record<string, string>;
  /** Items in display order, duplicates removed (first appearance wins). */
  parse(html: string): FrontItem[];
}

export const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
};

/** 13tv's bot-wall rejects a browser UA that doesn't run JavaScript, yet serves a plain one. */
export const PLAIN_HEADERS = {
  'User-Agent': 'oto-eruah/2.0 (+https://israel-news-aggregator.netlify.app)',
  Accept: 'text/html,*/*',
};

/** Collapse whitespace and decode the few entities the parsers meet in text nodes. */
export function clean(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Absolute URL without fragment or query, or null if it isn't one. */
export function canonical(href: string, base: string, keepQuery = false): string | null {
  try {
    const u = new URL(href, base);
    u.hash = '';
    if (!keepQuery) u.search = '';
    return u.toString();
  } catch {
    return null;
  }
}

/** Drop later duplicates by URL, keeping the first (most prominent) appearance. */
export function dedupe(items: FrontItem[]): FrontItem[] {
  const seen = new Set<string>();
  return items.filter(i => !seen.has(i.url) && !!seen.add(i.url));
}

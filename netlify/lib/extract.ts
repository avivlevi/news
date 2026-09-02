import { extract } from '@extractus/article-extractor';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
};

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

/**
 * Best-effort full text. Comparison degrades gracefully to the RSS blurb when
 * a paywall or bot-wall wins, so this never throws.
 */
export async function fetchBody(url: string, fallback: string): Promise<string> {
  try {
    const art = await extract(url, undefined, {
      headers: HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    const body = toText(art?.content ?? '');
    return body.length > 200 ? body.slice(0, 6000) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Google News RSS links point at news.google.com/rss/articles/<id>, which is a
 * JavaScript redirect page — the article extractor gets nothing from it, so four
 * of six outlets were being compared on their feed blurb alone. The id encodes
 * the real URL; newer ids need a signed round-trip to Google's resolver.
 */
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' };

export const isGoogleNewsUrl = (url: string) => /news\.google\.com\/(?:rss\/)?articles\//.test(url);

function articleId(url: string): string | null {
  return url.match(/\/articles\/([^/?#]+)/)?.[1] ?? null;
}

/** Older ids carry the URL in plain base64. */
function decodeLegacy(id: string): string | null {
  try {
    const raw = Buffer.from(id.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1');
    if (raw.includes('AU_yqL')) return null;
    return raw.match(/https?:\/\/[\x21-\x7e]+/)?.[0] ?? null;
  } catch {
    return null;
  }
}

async function decodeSigned(id: string, signal: AbortSignal): Promise<string | null> {
  const page = await fetch(`https://news.google.com/articles/${id}`, { headers: UA, signal });
  if (!page.ok) return null;
  const html = await page.text();
  const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!sg || !ts) return null;

  const req = [
    'garturlreq',
    [
      ['en-US', 'US', ['FINANCE_TOP_INDICES', 'WEB_TEST_1_0_0'], null, null, 1, 1, 'US:en', null, 180,
        null, null, null, null, null, 0, null, null, [1608992183, 723341000]],
      'en-US', 'US', 1, [2, 3, 4, 8], 1, 0, '655000234', 0, 0, null, 0,
    ],
    id, Number(ts), sg,
  ];
  const body = 'f.req=' + encodeURIComponent(JSON.stringify([[['Fbv4je', JSON.stringify(req), null, 'generic']]]));
  const res = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', ...UA },
    body,
    signal,
  });
  if (!res.ok) return null;
  const line = (await res.text()).split('\n').find(l => l.startsWith('[['));
  if (!line) return null;
  const inner = JSON.parse(JSON.parse(line)[0][2]);
  const url = inner?.[1];
  return typeof url === 'string' && url.startsWith('http') ? url : null;
}

/** Real article URL, or null when Google won't say. Never throws. */
export async function resolveGoogleNewsUrl(url: string): Promise<string | null> {
  const id = articleId(url);
  if (!id) return null;
  const legacy = decodeLegacy(id);
  if (legacy) return legacy;
  try {
    return await decodeSigned(id, AbortSignal.timeout(10_000));
  } catch {
    return null;
  }
}

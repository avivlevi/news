import type { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  const url = 'https://www.c14.co.il/feed/';

  const results: Record<string, unknown> = {};

  // Test 1: no headers
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    results['no_headers'] = { status: r.status, ok: r.ok, body_start: (await r.text()).slice(0, 200) };
  } catch (e) { results['no_headers'] = { error: String(e) }; }

  // Test 2: browser UA
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'he-IL,he;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });
    results['browser_ua'] = { status: r.status, ok: r.ok, body_start: (await r.text()).slice(0, 200) };
  } catch (e) { results['browser_ua'] = { error: String(e) }; }

  // Test 3: Googlebot UA
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' },
      signal: AbortSignal.timeout(8000),
    });
    results['googlebot'] = { status: r.status, ok: r.ok, body_start: (await r.text()).slice(0, 200) };
  } catch (e) { results['googlebot'] = { error: String(e) }; }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(results, null, 2),
  };
};

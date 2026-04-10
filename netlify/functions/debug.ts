import type { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  const results: Record<string, unknown> = {};

  // Test 1: C14 WordPress REST API
  try {
    const r = await fetch(
      'https://www.c14.co.il/wp-json/wp/v2/posts?per_page=3&_fields=id,title,link,date,excerpt,yoast_head_json',
      { signal: AbortSignal.timeout(8000) }
    );
    const body = await r.text();
    results['wp_api'] = { status: r.status, ok: r.ok, body_start: body.slice(0, 300) };
  } catch (e) { results['wp_api'] = { error: String(e) }; }

  // Test 2: Google News RSS for C14
  try {
    const r = await fetch(
      'https://news.google.com/rss/search?q=site:c14.co.il&hl=he&gl=IL&ceid=IL:he',
      { signal: AbortSignal.timeout(8000) }
    );
    const body = await r.text();
    results['google_news'] = { status: r.status, ok: r.ok, body_start: body.slice(0, 300) };
  } catch (e) { results['google_news'] = { error: String(e) }; }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(results, null, 2),
  };
};

import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

interface ArticleInput {
  title: string;
  description: string;
  source: string;
}

interface SummaryResponse {
  summary: string;
  topics: string[];
}

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let body: { articles: ArticleInput[] };
  try {
    body = JSON.parse(event.body ?? '{}') as { articles: ArticleInput[] };
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { articles } = body;
  if (!Array.isArray(articles) || articles.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No articles provided' }) };
  }

  const headlines = articles
    .slice(0, 40)
    .map(a => `• ${a.title}`)
    .join('\n');

  const prompt = `אתה עורך חדשות ישראלי. לפניך כותרות החדשות של היום:

${headlines}

צור תמצית חדשותית בפורמט JSON בדיוק:
{
  "summary": "2-3 משפטים המתארים את תמונת החדשות הכוללת של היום. מה הנושאים הגדולים? מה האווירה הכללית? כתוב בגוף שלישי, ברמה של עורך ראשי.",
  "topics": ["נושא1", "נושא2", "נושא3", "נושא4", "נושא5"]
}

הנושאים הם מילים או ביטויים קצרים (2-3 מילים לכל היותר) המייצגים את הנושאים המרכזיים ביום זה.
החזר JSON בלבד, ללא טקסט נוסף.`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
    const parsed = JSON.parse(text) as SummaryResponse;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(parsed),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
    };
  }
};

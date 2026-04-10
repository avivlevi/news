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

  const prompt = `אתה עורך חדשות ישראלי בכיר. לפניך כותרות החדשות של היום:

${headlines}

כתוב תמצית חדשותית מעמיקה בפורמט JSON בדיוק:
{
  "summary": "שני פסקאות נפרדות, מופרדות בשני רווחי שורה (\\n\\n). הפסקה הראשונה: סקירה של הסיפור או הסיפורים הדומיננטיים ביותר — היה ספציפי, ציין שמות, מספרים, מדינות או פרטים בולטים שעולים מהכותרות. הפסקה השנייה: הקשר רחב יותר — תאר את האווירה הכללית של היום, נושאים משניים חשובים, ומה התמונה הכוללת שמצטיירת. כתוב בגוף שלישי, ברמה של עיתונאי בכיר.",
  "topics": ["נושא1", "נושא2", "נושא3", "נושא4", "נושא5", "נושא6"]
}

הנושאים הם מילים או ביטויים קצרים (2-3 מילים לכל היותר) המייצגים את הנושאים המרכזיים ביום זה.
החזר JSON בלבד, ללא טקסט נוסף.`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
    // Strip markdown code fences if present
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
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

import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

interface ArticleInput {
  id: string;
  title: string;
  description: string;
  source: string;
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

  const articleList = articles
    .map(a => `id:${a.id} | מקור:${a.source} | כותרת: ${a.title}${a.description ? ` | תיאור: ${a.description.slice(0, 120)}` : ''}`)
    .join('\n');

  const prompt = `אתה מנתח עיתונאי ישראלי. לפניך רשימת כתבות חדשות.

דרג כל כתבה על סקאלה של 1 עד 10:
1 = נגד הממשלה הנוכחית בצורה חזקה מאוד
5 = ניטרלי / עובדתי
10 = בעד הממשלה הנוכחית בצורה חזקה מאוד

בחן את הניסוח, הטון, מה מודגש ומה מושמט בכותרת ובתיאור.
כתבות עובדתיות ללא עמדה ברורה — ציון 5.
כתבות ביקורתיות על הממשלה — 1-4.
כתבות תומכות בממשלה — 6-10.

הכתבות:
${articleList}`;

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      tools: [
        {
          name: 'article_scores',
          description: 'Return political bias score for each article',
          input_schema: {
            type: 'object' as const,
            properties: {
              scores: {
                type: 'array',
                items: {
                  type: 'object' as const,
                  properties: {
                    id:    { type: 'string', description: 'Article id exactly as given' },
                    score: { type: 'number', description: 'Integer 1–10' },
                  },
                  required: ['id', 'score'],
                },
              },
            },
            required: ['scores'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'article_scores' },
      messages: [{ role: 'user', content: prompt }],
    });

    const toolBlock = response.content.find(b => b.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      return { statusCode: 500, body: JSON.stringify({ error: 'No tool response' }) };
    }

    const result = toolBlock.input as { scores: Array<{ id: string; score: number }> };
    const map: Record<string, number> = {};
    for (const { id, score } of result.scores) {
      map[id] = Math.min(10, Math.max(1, Math.round(score)));
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ scores: map }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }) };
  }
};

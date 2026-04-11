import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

interface ArticleInput {
  title: string;
  description: string;
  source: string;
}

interface SummaryResponse {
  points: string[];
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

כתוב תמצית חדשותית מעמיקה בנקודות:
- 5 עד 7 נקודות, כל אחת משפט עד שניים.
- הנקודות הראשונות על הסיפורים הדומיננטיים — היה ספציפי, ציין שמות, מדינות, פרטים בולטים.
- הנקודות האחרונות על הקשר רחב יותר — אווירה כללית, נושאים משניים, התמונה הכוללת.
- נושאים: 6 ביטויים קצרים (2-3 מילים) המייצגים את הנושאים המרכזיים.
כתוב בגוף שלישי, ברמה של עיתונאי בכיר.`;

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      tools: [
        {
          name: 'news_summary',
          description: 'Output a structured daily news summary in Hebrew',
          input_schema: {
            type: 'object' as const,
            properties: {
              points: {
                type: 'array',
                items: { type: 'string' },
                description: '5–7 Hebrew bullet points covering today\'s news. Each point is 1–2 sentences. Start with dominant stories (specific names/details), end with broader context.',
              },
              topics: {
                type: 'array',
                items: { type: 'string' },
                description: '6 short Hebrew topic phrases (2-3 words each)',
              },
            },
            required: ['points', 'topics'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'news_summary' },
      messages: [{ role: 'user', content: prompt }],
    });

    const toolBlock = response.content.find(b => b.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      return { statusCode: 500, body: JSON.stringify({ error: 'No tool response from Claude' }) };
    }

    const parsed = toolBlock.input as SummaryResponse;

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

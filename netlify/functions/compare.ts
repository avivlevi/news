import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

type SourceId = 'ynet' | 'n12' | 'israelhayom' | 'c14';

interface ArticleInput {
  source: SourceId;
  title: string;
  paragraphs: string[];
}

const SOURCE_LABELS: Record<string, string> = {
  ynet: 'ynet',
  n12: 'N12',
  israelhayom: 'ישראל היום',
  c14: 'ערוץ 14',
};

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured' }),
    };
  }

  let body: { articles: ArticleInput[] };
  try {
    body = JSON.parse(event.body ?? '{}') as { articles: ArticleInput[] };
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { articles } = body;
  if (!Array.isArray(articles) || articles.length < 2) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Need at least 2 articles to compare' }),
    };
  }

  const articleBlocks = articles
    .map(a => {
      const label = SOURCE_LABELS[a.source] ?? a.source;
      const content = a.paragraphs.slice(0, 10).join(' ').slice(0, 1800);
      return `### ${label}\nכותרת: "${a.title}"\n${content}`;
    })
    .join('\n\n---\n\n');

  const prompt = `אתה עוזר לניתוח עיתונאי. לפניך כתבות על אותו נושא ממקורות שונים:

${articleBlocks}

נתח את ההבדלים בין הכיסויים העיתונאיים בעברית ברורה ופשוטה. אל תשתמש בסימני markdown כגון **, ##, - וכו'.

כתוב בפורמט הבא בדיוק (עם אמוג'י בתחילת כל כותרת):

🗞 סיכום הנושא
[2-3 משפטים על הסיפור]

👁 איך כל מקור מציג את הסיפור
[לכל מקור: שורה עם שמו ואחריה הסבר קצר על הזווית שלו]

⚡ הבדלים מרכזיים
[2-4 נקודות מחלוקת ספציפיות: עובדות שמוצגות אחרת, הבדלי טון, דברים שמקור אחד מדגיש ואחר מחסיר]

היה תמציתי וממוקד. עד 200 מילה.`;

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    });

    const comparison =
      response.content[0].type === 'text' ? response.content[0].text : '';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ comparison }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
    };
  }
};

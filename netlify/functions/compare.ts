import type { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

type SourceId = 'ynet' | 'n12' | 'israelhayom' | 'c14' | 'walla' | 'maariv' | 'globes' | 'haaretz';

interface ArticleInput {
  source: SourceId;
  title: string;
  paragraphs: string[];
}

const SOURCE_LABELS: Record<string, string> = {
  ynet: 'ynet',
  walla: 'וואלה',
  n12: 'N12',
  israelhayom: 'ישראל היום',
  maariv: 'מעריב',
  c14: 'ערוץ 14',
  globes: 'גלובס',
  haaretz: 'הארץ',
};

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
  if (!Array.isArray(articles) || articles.length < 2) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Need at least 2 articles to compare' }) };
  }

  const articleBlocks = articles
    .map(a => {
      const label = SOURCE_LABELS[a.source] ?? a.source;
      const content = a.paragraphs.slice(0, 10).join(' ').slice(0, 1800);
      return `### ${label} (source_id: ${a.source})\nכותרת: "${a.title}"\n${content}`;
    })
    .join('\n\n---\n\n');

  const prompt = `אתה אנליסט עיתונאי ישראלי. לפניך כתבות על אותו נושא ממקורות שונים:

${articleBlocks}

נתח את הכתבות ותן:
1. ניתוח השוואתי של ההבדלים בין המקורות
2. ציון הטיה פוליטית לכל מקור: 1 = נגד הממשלה בצורה חזקה, 10 = בעד הממשלה בצורה חזקה, 5 = ניטרלי

בציון ההטיה — בחן את הטון, הדגשים, מה שנכלל ומה שהושמט, ואת הנרטיב הכולל.`;

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      tools: [
        {
          name: 'article_analysis',
          description: 'Structured analysis of news articles including comparison text and political bias scores',
          input_schema: {
            type: 'object' as const,
            properties: {
              comparison: {
                type: 'string',
                description: 'Hebrew comparative analysis. No markdown. Use these emoji section headers exactly:\n🗞 סיכום הנושא\n👁 איך כל מקור מציג את הסיפור\n⚡ הבדלים מרכזיים\nBe concise, up to 200 words.',
              },
              bias_scores: {
                type: 'array',
                description: 'Political bias score for each source',
                items: {
                  type: 'object' as const,
                  properties: {
                    source: { type: 'string', description: 'The source_id exactly as given (e.g. ynet, n12)' },
                    score: { type: 'number', description: '1–10 integer. 1=strongly anti-government, 5=neutral, 10=strongly pro-government' },
                    brief: { type: 'string', description: 'One short Hebrew sentence explaining this score' },
                  },
                  required: ['source', 'score', 'brief'],
                },
              },
            },
            required: ['comparison', 'bias_scores'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'article_analysis' },
      messages: [{ role: 'user', content: prompt }],
    });

    const toolBlock = response.content.find(b => b.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      return { statusCode: 500, body: JSON.stringify({ error: 'No tool response' }) };
    }

    const result = toolBlock.input as {
      comparison: string;
      bias_scores: Array<{ source: string; score: number; brief: string }>;
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ comparison: result.comparison, biasScores: result.bias_scores }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
    };
  }
};

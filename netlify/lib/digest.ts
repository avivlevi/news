import { SOURCES } from '../../shared/sources.js';
import type { OutletDigest, SourceId } from '../../shared/types.js';
import type { RawArticle } from './feeds.js';
import { callTool, MODEL_DEEP, type Anthropic } from './llm.js';

/* ------------------------------------------------------------------ *
 * Digest — what each site published across the whole sweep. This is the
 * only pass that sees every article, including the ~90% no other site
 * touched. What a masthead runs alone is the clearest statement of what
 * it wanted in front of readers.
 * ------------------------------------------------------------------ */

const DIGEST_TOOL: Anthropic.Tool = {
  name: 'report_digest',
  description: 'Describe what each site published. Description only, never evaluation.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['outlets'],
    properties: {
      outlets: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['source', 'summary'],
          properties: {
            source: { type: 'string', description: 'The outlet id exactly as given.' },
            summary: {
              type: 'string',
              description:
                'Hebrew, 2-4 sentences. What subjects this site published and which it gave the most items to. Name concrete stories. Purely descriptive — no evaluation of the site, no political characterisation, no comparison to other sites.',
            },
          },
        },
      },
    },
  },
};

export async function buildDigest(client: Anthropic, articles: RawArticle[]): Promise<OutletDigest[]> {
  const bySource = new Map<SourceId, RawArticle[]>();
  for (const a of articles) bySource.set(a.source, [...(bySource.get(a.source) ?? []), a]);
  if (bySource.size === 0) return [];

  const listing = [...bySource.entries()]
    .map(([id, arts]) =>
      `## ${id} (${SOURCES[id].name}) — ${arts.length} כתבות\n` +
      arts.map((a, i) => `${i + 1}. ${a.title}`).join('\n')
    )
    .join('\n\n');

  const prompt = `להלן כל הכותרות שפורסמו כעת בכל אתר חדשות, לפי אתר:

${listing}

לכל אתר, כתוב 2–4 משפטים המתארים **מה הוא פרסם**: באילו נושאים עסק, לאילו נושאים הקדיש הכי הרבה כתבות, ואילו סיפורים קונקרטיים בלטו אצלו.

כללים מחייבים:
- **תיאור בלבד.** אתה מדווח מה מופיע ברשימה, לא מעריך אותה.
- אל תשייך לאתר עמדה פוליטית, נטייה, אג'נדה או כוונה. לא "מדגיש", לא "ממקד", לא "בוחר להבליט" — פשוט "פרסם", "כלל", "הקדיש".
- אל תשווה בין אתרים ואל תאמר מה אתר החסיר. כל פסקה עומדת בפני עצמה.
- הזכר סיפורים ספציפיים בשמם, לא קטגוריות מעורפלות.
- אל תסיק מה חשוב לאתר או מה הוא רוצה שהציבור יראה. תאר את הפרסום בלבד.`;

  const out = await callTool<{ outlets: { source: string; summary: string }[] }>(client, {
    model: MODEL_DEEP, tool: DIGEST_TOOL, prompt, maxTokens: 16_000, effort: 'high',
  });

  return (out?.outlets ?? []).flatMap(o => {
    const arts = bySource.get(o.source as SourceId);
    if (!arts) return [];
    return [{ source: o.source as SourceId, articleCount: arts.length, summary: o.summary ?? '' }];
  });
}

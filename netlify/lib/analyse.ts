import { SOURCES } from '../../shared/sources.js';
import {
  STORY_SCHEMA,
  type Story, type OutletTake, type TermContrast, type FactRow, type Contradiction,
  type SourceId, type HeadlineForm,
} from '../../shared/types.js';
import type { RawArticle } from './feeds.js';
import type { Body } from './extract.js';
import { callTool, MODEL_DEEP, type Anthropic } from './llm.js';
import type { MatchGroup } from './match.js';
import { hash } from './concurrency.js';

/* ------------------------------------------------------------------ *
 * Comparison — documents, never evaluates, how the versions differ.
 * ------------------------------------------------------------------ */

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'report_comparison',
  description: 'Report, without evaluation, how the versions of one event differ.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['takes', 'contradictions', 'differingFacts', 'contrasts'],
    properties: {
      takes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['source', 'lede', 'leadsWith', 'headlineActor', 'headlineForm', 'approach', 'characterisations', 'voices'],
          properties: {
            source: { type: 'string', description: 'The outlet id exactly as given.' },
            lede: {
              type: 'string',
              description: "The article's opening sentence, copied verbatim. Never paraphrase.",
            },
            leadsWith: {
              type: 'string',
              description:
                'Hebrew, 3-8 words: the single thing the article opens with (a person, a number, a quote, an action, a reaction). Name it plainly, e.g. "מספר ההרוגים", "תגובת המשטרה", "עדות האם". No evaluation.',
            },
            headlineActor: {
              type: 'string',
              description:
                'Who or what performs the action in this outlet\'s headline, exactly as the headline names it (e.g. "צה"ל", "ילד בן 10", "המשטרה"). If the headline has no acting subject, write "—".',
            },
            headlineForm: {
              type: 'string',
              enum: ['active', 'passive', 'nominal'],
              description:
                'Grammatical form of the headline: active (a named subject acts), passive (the subject is acted upon or the actor is unnamed), nominal (a noun phrase or label with no verb).',
            },
            approach: {
              type: 'string',
              description:
                'Hebrew, 2-3 sentences describing how this article is built: what it opens with, what it spends its length on, whose account it follows, how it ends. Describe the article only — no evaluation, no political characterisation, no comparison to the other articles.',
            },
            characterisations: {
              type: 'array', items: { type: 'string' },
              description:
                'Up to 3 sentences copied verbatim in which this article describes a person, group or act. Quote exactly; add no label or commentary. Empty array if the piece is purely procedural.',
            },
            voices: {
              type: 'array', items: { type: 'string' },
              description: 'Names or titles of people and bodies directly quoted in this article.',
            },
          },
        },
      },
      contradictions: {
        type: 'array',
        description:
          'Only where the articles state incompatible things — different numbers, ages, times, attributions, or sequences. Not differences of emphasis. Usually empty.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['about', 'versions'],
          properties: {
            about: { type: 'string', description: 'Hebrew: the detail they disagree on.' },
            versions: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['source', 'claim'],
                properties: {
                  source: { type: 'string' },
                  claim: { type: 'string', description: 'What this outlet states, quoted or closely paraphrased.' },
                },
              },
            },
          },
        },
      },
      differingFacts: {
        type: 'array',
        description:
          'Concrete claims that at least one article reports and at least one other does not. Skip anything every article carries — those belong in the shared summary, not here. Order by importance to the event, most important first.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['claim', 'reportedBy'],
          properties: {
            claim: {
              type: 'string',
              description: 'Hebrew, one plain factual sentence. State the claim only — never say who omitted it or why.',
            },
            reportedBy: {
              type: 'array', items: { type: 'string' },
              description: 'Ids of the outlets whose article contains this claim.',
            },
          },
        },
      },
      contrasts: {
        type: 'array',
        description:
          'The same person, group, act or place given different names across the articles. Report the difference; pass no judgment on which wording is correct.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['concept', 'variants'],
          properties: {
            concept: { type: 'string', description: 'Hebrew: the thing being named, in 1-4 generic words (e.g. "היורה", "המקום", "הפעולה").' },
            variants: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['source', 'term'],
                properties: {
                  source: { type: 'string' },
                  term: { type: 'string', description: 'The exact wording that article used.' },
                },
              },
            },
          },
        },
      },
    },
  },
};

interface RawTake {
  source: string;
  lede: string;
  leadsWith: string;
  headlineActor: string;
  headlineForm: HeadlineForm;
  approach: string;
  characterisations: string[];
  voices: string[];
}

interface AnalysisResult {
  takes: RawTake[];
  contradictions: Contradiction[];
  differingFacts: FactRow[];
  contrasts: TermContrast[];
}

/** One article per outlet — the earliest, so the comparison is of first reports. */
export function membersOf(group: MatchGroup, articles: RawArticle[]): RawArticle[] {
  const bySource = new Map<SourceId, RawArticle>();
  for (const a of group.indices.map(i => articles[i]).filter(Boolean)) {
    const seen = bySource.get(a.source);
    if (!seen || new Date(a.publishedAt) < new Date(seen.publishedAt)) bySource.set(a.source, a);
  }
  return [...bySource.values()];
}

/** Stable across runs as long as the same articles make up the event. */
export const storyId = (members: RawArticle[]) => hash(members.map(m => m.id).sort().join('|'));

export async function analyseStory(
  client: Anthropic,
  group: MatchGroup,
  members: RawArticle[],
  bodies: Map<string, Body>
): Promise<Story | null> {
  if (members.length < 2) return null;

  const versions = members
    .map(a => {
      const b = bodies.get(a.id);
      const note = b?.read === 'blurb' ? '\n(רק תקציר הפיד זמין לכתבה זו — הגוף המלא לא נקרא)' : '';
      return `### ${a.source} (${SOURCES[a.source].name})\nכותרת: ${a.title}${note}\n\n${b?.text ?? a.description}`;
    })
    .join('\n\n---\n\n');

  const prompt = `הכתבות הבאות מסקרות את אותו אירוע: "${group.headline}"

${versions}

---

תפקידך: **תיעוד, לא הערכה.**

אתה כלי מדידה. אינך קובע מי מוטה, מי הוגן, מי ביקורתי או מי אוהד. אינך משייך לאף אתר עמדה פוליטית. אתה מתעד מה נכתב בפועל — ותו לא.

לכל כתבה:
- **משפט פתיחה** — העתק מילה במילה. אל תנסח מחדש.
- **במה פותחת** — 3–8 מילים: הדבר האחד שהכתבה פותחת בו.
- **הפועל בכותרת** — מי מבצע את הפעולה בכותרת של אותו אתר, בדיוק כפי שהכותרת מכנה אותו, וצורת הכותרת (פעיל / סביל / שמני).
- **אפיונים** — עד 3 משפטים, מועתקים מילה במילה, שבהם הכתבה מתארת אדם, קבוצה או מעשה. בלי תווית, בלי פרשנות. הציטוט מדבר בעד עצמו.
- **מצוטטים** — מי מצוטט שם בפועל.

כתבה שרק התקציר שלה זמין: תאר רק מה שמופיע בתקציר, ואל תרשום לה אפיונים או מצוטטים שאינם בו.

**סתירות** — רק מקרים שבהם הכתבות אומרות דברים שאינם יכולים להתקיים יחד: מספרים שונים, גילאים שונים, שעות שונות, ייחוס שונה. הבדל בדגש אינו סתירה. לרוב תהיה רשימה ריקה — זה תקין.

**עובדות שנבדלות** — טענות קונקרטיות שכתבה אחת לפחות מביאה ואחרת לא, מהחשובה ביותר לאירוע ועד השולית. נסח את הטענה בלבד. **אל תכתוב מי השמיט אותה ואל תרמוז מדוע.** אם כל הכתבות מביאות טענה — אל תכלול אותה.

**ניסוחים שונים** — אותו אדם, מעשה או מקום שמקבל שם אחר בכתבות שונות. צטט את הניסוח המדויק מכל אחת. אל תקבע איזה ניסוח נכון. את "המושג" נסח במילה-ארבע כלליות (למשל "היורה", "המקום", "הפעולה") כדי שאפשר יהיה להשוות בין אירועים.

השתמש במזהי האתרים בדיוק כפי שניתנו (${members.map(m => m.source).join(', ')}).`;

  const out = await callTool<AnalysisResult>(client, {
    model: MODEL_DEEP, tool: ANALYSIS_TOOL, prompt, maxTokens: 16_000, effort: 'high',
  });
  if (!out) return null;

  const byId = new Map(members.map(m => [m.source as string, m]));
  const takes: OutletTake[] = (out.takes ?? []).flatMap(t => {
    const art = byId.get(t.source);
    if (!art) return [];
    const body = bodies.get(art.id);
    return [{
      source: art.source,
      title: art.title,
      url: art.url,
      imageUrl: art.imageUrl ?? body?.image,
      publishedAt: art.publishedAt,
      bodyRead: body?.read ?? 'blurb',
      wordCount: body?.wordCount,
      lede: t.lede ?? '',
      leadsWith: t.leadsWith ?? '',
      headlineActor: t.headlineActor ?? '—',
      headlineForm: (['active', 'passive', 'nominal'] as const).includes(t.headlineForm) ? t.headlineForm : 'nominal',
      approach: t.approach ?? '',
      characterisations: (t.characterisations ?? []).slice(0, 3),
      voices: t.voices ?? [],
    }];
  });
  if (takes.length < 2) return null;

  const known = new Set(takes.map(t => t.source as string));
  const keep = <T extends { source: string }>(xs: T[]) => xs.filter(x => known.has(x.source));

  const contradictions = (out.contradictions ?? [])
    .map(c => ({ ...c, versions: keep(c.versions ?? []) }))
    .filter(c => c.versions.length >= 2);

  const contrasts = (out.contrasts ?? [])
    .map(c => ({ ...c, variants: keep(c.variants ?? []) }))
    .filter(c => c.variants.length >= 2);

  // A claim every outlet carried isn't a difference, whatever the model said.
  const differingFacts = (out.differingFacts ?? [])
    .map(f => ({ ...f, reportedBy: (f.reportedBy ?? []).filter(s => known.has(s)) as SourceId[] }))
    .filter(f => f.reportedBy.length > 0 && f.reportedBy.length < takes.length);

  const reportedAt = takes.map(t => t.publishedAt).sort().at(-1) ?? new Date().toISOString();

  return {
    id: storyId(members),
    schema: STORY_SCHEMA,
    headline: group.headline,
    agreed: group.agreed,
    reportedAt,
    takes,
    contradictions,
    differingFacts,
    contrasts,
  };
}

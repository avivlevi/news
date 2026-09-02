import Anthropic from '@anthropic-ai/sdk';
import { fetchAllFeeds, type RawArticle } from './feeds.js';
import { fetchBody } from './extract.js';
import { SOURCES, SOURCE_IDS, type SourceId } from './sources.js';
import type {
  Story, StoriesPayload, OutletTake, TermContrast, FactRow, Contradiction, OutletDigest,
} from '../../src/types.js';

const MODEL = 'claude-opus-5';

/** Articles more than this far apart are covering different moments. */
const WINDOW_HOURS = 36;

/* ------------------------------------------------------------------ *
 * Pass 1 — matching
 * Lexical title overlap is useless here: outlets covering one event word
 * their headlines differently, and that divergence is the whole subject.
 * ------------------------------------------------------------------ */

interface MatchGroup {
  indices: number[];
  headline: string;
  agreed: string;
}

const MATCH_TOOL: Anthropic.Tool = {
  name: 'report_shared_stories',
  description: 'Report which articles cover the same single news event.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['groups'],
    properties: {
      groups: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['indices', 'headline', 'agreed'],
          properties: {
            indices: { type: 'array', items: { type: 'integer' } },
            headline: {
              type: 'string',
              description: 'Neutral Hebrew headline, free of any outlet\'s spin. Under 12 words.',
            },
            agreed: {
              type: 'string',
              description:
                'Hebrew, one short sentence stating only the concrete facts every version shares — names, numbers, places. Must add information the headline does not already give. Under 20 words.',
            },
          },
        },
      },
    },
  },
};

const hoursApart = (a: string, b: string) =>
  Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3_600_000;

async function matchStories(
  client: Anthropic,
  articles: RawArticle[]
): Promise<MatchGroup[]> {
  const list = articles
    .map((a, i) => {
      const when = new Date(a.publishedAt).toLocaleString('he-IL', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      });
      return `[${i}] ${when} (${SOURCES[a.source].name}) ${a.title}${
        a.description ? ` — ${a.description.slice(0, 150)}` : ''
      }`;
    })
    .join('\n');

  const prompt = `להלן כותרות חדשות מ-8 אתרי חדשות ישראליים, עם מועד הפרסום של כל אחת.

${list}

זהה אילו כתבות מסקרות את **אותו אירוע חדשותי בודד**.

כללים מחייבים:
- "אותו אירוע" = אותה התרחשות קונקרטית: אותה תאונה, אותה החלטה, אותה הודעה, אותו דיון. **לא** אותו נושא כללי.
  - ✅ שתי כתבות על אותה תאונה בכביש החוף.
  - ❌ כתבה על מחסור במורים מ-27.8 יחד עם כתבה על דיון בכנסת מ-30.8 — זה נושא מתמשך, לא אירוע.
  - ❌ שתי התפתחויות שונות באותה פרשה משפטית.
- כל הכתבות בקבוצה חייבות להיות בטווח של עד ${WINDOW_HOURS} שעות זו מזו. אם הפער גדול יותר — אלו אירועים שונים, אל תקבץ.
- החזר רק קבוצות המופיעות ב-2 אתרים **שונים** לפחות.
- אל תכניס כתבה לשתי קבוצות. אל תכניס שתי כתבות מאותו אתר לאותה קבוצה — בחר את המתאימה ביותר.
- ניסוח שונה או זווית שונה עדיין נחשבים לאותו אירוע — זה בדיוק מה שמעניין אותנו.

חשוב לא פחות: **אל תפצל אירוע אחד לשתי קבוצות.** אם שתי קבוצות מתארות את אותה ירייה, אותה תאונה או אותה חסימה — הן קבוצה אחת. פיצול כזה הורס את ההשוואה, כי כל חצי מקבל אתרים אחרים.`;

  const res = await client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    tools: [MATCH_TOOL],
    tool_choice: { type: 'tool', name: 'report_shared_stories' },
    messages: [{ role: 'user', content: prompt }],
  }).finalMessage();

  const block = res.content.find(b => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') return [];
  const { groups } = block.input as { groups: MatchGroup[] };

  // The window rule is restated in code: the model follows it well but not
  // perfectly, and a five-day "story" isn't a comparison of one moment.
  return (groups ?? []).flatMap(g => {
    const members = (g.indices ?? []).map(i => articles[i]).filter(Boolean);
    if (members.length < 2) return [];

    const times = members.map(m => m.publishedAt).sort();
    const anchor = times[Math.floor(times.length / 2)];
    const kept = members.filter(m => hoursApart(m.publishedAt, anchor) <= WINDOW_HOURS);

    if (new Set(kept.map(m => m.source)).size < 2) return [];
    const dropped = members.length - kept.length;
    if (dropped) console.log(`  window: dropped ${dropped} stale article(s) from "${g.headline.slice(0, 40)}"`);

    return [{ ...g, indices: kept.map(m => articles.indexOf(m)) }];
  });
}


const MERGE_TOOL: Anthropic.Tool = {
  name: 'report_merges',
  description: 'Report which candidate groups describe the same single event.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['merges'],
    properties: {
      merges: {
        type: 'array',
        description: 'Each entry lists group ids that are really one event. Only genuine duplicates.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['ids', 'headline'],
          properties: {
            ids: { type: 'array', items: { type: 'integer' } },
            headline: { type: 'string', description: 'Neutral Hebrew headline for the merged event.' },
          },
        },
      },
    },
  },
};

/**
 * The matcher reliably splits one event into two groups — typically along
 * outlet lines, which is the worst possible split here: each half ends up with
 * a different slice of the spectrum and the comparison quietly disappears.
 * One cheap pass over the group headlines catches it.
 */
async function mergeGroups(client: Anthropic, groups: MatchGroup[]): Promise<MatchGroup[]> {
  if (groups.length < 2) return groups;

  const list = groups.map((g, i) => `[${i}] ${g.headline} — ${g.agreed}`).join('\n');

  const res = await client.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    tools: [MERGE_TOOL],
    tool_choice: { type: 'tool', name: 'report_merges' },
    messages: [{
      role: 'user',
      content: `להלן קבוצות כתבות שזוהו כאירועים נפרדים:

${list}

אילו מהן מתארות למעשה **אותו אירוע בודד** ופוצלו בטעות?

דוגמה לפיצול שגוי: "גבר נורה למוות ביפו" ו-"אחמד עבד שוקרא נורה למוות ביפו" — אותה ירייה, שתי כותרות.

החזר רק מיזוגים ודאיים. אם אתה מסופק — אל תמזג. קבוצות על אותו נושא אך אירועים שונים (שתי תאונות שונות, שתי החלטות שונות) נשארות נפרדות.`,
    }],
  }).finalMessage();

  const block = res.content.find(b => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') return groups;
  const { merges } = block.input as { merges: { ids: number[]; headline: string }[] };

  const consumed = new Set<number>();
  const merged: MatchGroup[] = [];

  for (const m of merges ?? []) {
    const ids = (m.ids ?? []).filter(i => groups[i] && !consumed.has(i));
    if (ids.length < 2) continue;
    ids.forEach(i => consumed.add(i));
    merged.push({
      indices: [...new Set(ids.flatMap(i => groups[i].indices))],
      headline: m.headline || groups[ids[0]].headline,
      agreed: groups[ids[0]].agreed,
    });
    console.log(`  merged ${ids.length} groups → "${(m.headline || '').slice(0, 45)}"`);
  }

  groups.forEach((g, i) => { if (!consumed.has(i)) merged.push(g); });
  return merged;
}

/* ------------------------------------------------------------------ *
 * Pass 2 — framing analysis
 * ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ *
 * Digest — what each site published across the whole sweep.
 * This is the only pass that sees every article, including the ~90%
 * no other site touched. What a masthead runs alone is the clearest
 * statement of what it wanted in front of readers.
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

async function buildDigest(
  client: Anthropic,
  articles: RawArticle[]
): Promise<OutletDigest[]> {
  const bySource = new Map<SourceId, RawArticle[]>();
  for (const a of articles) {
    bySource.set(a.source, [...(bySource.get(a.source) ?? []), a]);
  }
  if (bySource.size === 0) return [];

  const listing = [...bySource.entries()]
    .map(([id, arts]) =>
      `## ${id} (${SOURCES[id].name}) — ${arts.length} כתבות\n` +
      arts.map((a, i) => `${i + 1}. ${a.title}`).join('\n')
    )
    .join('\n\n');

  const res = await client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    tools: [DIGEST_TOOL],
    tool_choice: { type: 'tool', name: 'report_digest' },
    messages: [{
      role: 'user',
      content: `להלן כל הכותרות שפורסמו כעת בכל אתר חדשות, לפי אתר:

${listing}

לכל אתר, כתוב 2–4 משפטים המתארים **מה הוא פרסם**: באילו נושאים עסק, לאילו נושאים הקדיש הכי הרבה כתבות, ואילו סיפורים קונקרטיים בלטו אצלו.

כללים מחייבים:
- **תיאור בלבד.** אתה מדווח מה מופיע ברשימה, לא מעריך אותה.
- אל תשייך לאתר עמדה פוליטית, נטייה, אג'נדה או כוונה. לא "מדגיש", לא "ממקד", לא "בוחר להבליט" — פשוט "פרסם", "כלל", "הקדיש".
- אל תשווה בין אתרים ואל תאמר מה אתר החסיר. כל פסקה עומדת בפני עצמה.
- הזכר סיפורים ספציפיים בשמם, לא קטגוריות מעורפלות.
- אל תסיק מה חשוב לאתר או מה הוא רוצה שהציבור יראה. תאר את הפרסום בלבד.`,
    }],
  }).finalMessage();

  const block = res.content.find(b => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') return [];
  const { outlets } = block.input as { outlets: { source: string; summary: string }[] };

  return (outlets ?? []).flatMap(o => {
    const arts = bySource.get(o.source as SourceId);
    if (!arts) return [];
    return [{ source: o.source as SourceId, articleCount: arts.length, summary: o.summary ?? '' }];
  });
}

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
          required: ['source', 'lede', 'approach', 'characterisations', 'voices'],
          properties: {
            source: { type: 'string', description: 'The outlet id exactly as given.' },
            lede: {
              type: 'string',
              description: 'The article\'s opening sentence, copied verbatim. Never paraphrase.',
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
          'Concrete claims that at least one article reports and at least one other does not. Skip anything every article carries — those belong in the shared summary, not here.',
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
            concept: { type: 'string', description: 'Hebrew: the thing being named.' },
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

async function analyseStory(
  client: Anthropic,
  group: MatchGroup,
  articles: RawArticle[]
): Promise<Story | null> {
  // One version per outlet — two articles from one site isn't a comparison.
  const bySource = new Map<SourceId, RawArticle>();
  for (const a of group.indices.map(i => articles[i]).filter(Boolean)) {
    const seen = bySource.get(a.source);
    if (!seen || new Date(a.publishedAt) < new Date(seen.publishedAt)) {
      bySource.set(a.source, a);
    }
  }
  const members = [...bySource.values()];
  if (members.length < 2) return null;

  const bodies = await Promise.all(
    members.map(a => fetchBody(a.url, `${a.title}. ${a.description}`))
  );

  const versions = members
    .map((a, i) => `### ${a.source} (${SOURCES[a.source].name})\nכותרת: ${a.title}\n\n${bodies[i]}`)
    .join('\n\n---\n\n');

  const prompt = `הכתבות הבאות מסקרות את אותו אירוע: "${group.headline}"

${versions}

---

תפקידך: **תיעוד, לא הערכה.**

אתה כלי מדידה. אינך קובע מי מוטה, מי הוגן, מי ביקורתי או מי אוהד. אינך משייך לאף אתר עמדה פוליטית. אתה מתעד מה נכתב בפועל — ותו לא.

לכל כתבה:
- **משפט פתיחה** — העתק מילה במילה. אל תנסח מחדש.
- **אפיונים** — עד 3 משפטים, מועתקים מילה במילה, שבהם הכתבה מתארת אדם, קבוצה או מעשה. בלי תווית, בלי פרשנות. הציטוט מדבר בעד עצמו.
- **מצוטטים** — מי מצוטט שם בפועל.

**סתירות** — רק מקרים שבהם הכתבות אומרות דברים שאינם יכולים להתקיים יחד: מספרים שונים, גילאים שונים, שעות שונות, ייחוס שונה. הבדל בדגש אינו סתירה. לרוב תהיה רשימה ריקה — זה תקין.

**עובדות שנבדלות** — טענות קונקרטיות שכתבה אחת לפחות מביאה ואחרת לא. נסח את הטענה בלבד. **אל תכתוב מי השמיט אותה ואל תרמוז מדוע.** אם כל הכתבות מביאות טענה — אל תכלול אותה.

**ניסוחים שונים** — אותו אדם, מעשה או מקום שמקבל שם אחר בכתבות שונות. צטט את הניסוח המדויק מכל אחת. אל תקבע איזה ניסוח נכון.

השתמש במזהי האתרים בדיוק כפי שניתנו (${members.map(m => m.source).join(', ')}).`;

  const res = await client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: 'tool', name: 'report_comparison' },
    messages: [{ role: 'user', content: prompt }],
  }).finalMessage();

  const block = res.content.find(b => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') return null;
  const out = block.input as AnalysisResult;

  const byId = new Map(members.map(m => [m.source as string, m]));
  const takes: OutletTake[] = (out.takes ?? []).flatMap(t => {
    const art = byId.get(t.source);
    if (!art) return [];
    return [{
      source: art.source,
      title: art.title,
      url: art.url,
      imageUrl: art.imageUrl,
      publishedAt: art.publishedAt,
      lede: t.lede ?? '',
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

  const reportedAt = takes
    .map(t => t.publishedAt)
    .sort()
    .at(-1) ?? new Date().toISOString();

  return {
    id: members.map(m => m.id).sort().join('_').slice(0, 80),
    headline: group.headline,
    agreed: group.agreed,
    reportedAt,
    takes,
    contradictions,
    differingFacts,
    contrasts,
  };
}

/* ------------------------------------------------------------------ */

export type Progress = (stage: string, detail: string) => Promise<void> | void;

export async function buildStories(apiKey: string, onProgress?: Progress): Promise<StoriesPayload> {
  const client = new Anthropic({ apiKey });
  const report = async (stage: string, detail: string) => {
    console.log(`${stage}: ${detail}`);
    await onProgress?.(stage, detail);
  };

  await report('collecting', 'אוסף כתבות מהמקורות');
  const articles = await fetchAllFeeds(30);
  const sourcesLive = new Set(articles.map(a => a.source)).size;

  // The digest reads every article and the matcher only needs the same list,
  // so the two run together rather than one after the other.
  await report('summarising', `${articles.length} כתבות — מסכם מה כל אתר פרסם`);
  const [digest, matched] = await Promise.all([
    buildDigest(client, articles),
    matchStories(client, articles),
  ]);

  await report('matching', `${matched.length} אירועים — מאחד כפילויות`);
  const groups = await mergeGroups(client, matched);

  await report('comparing', `${groups.length} אירועים — קורא וממיין הבדלים`);
  const settled = await Promise.allSettled(
    groups.map(g => analyseStory(client, g, articles))
  );
  for (const r of settled) {
    if (r.status === 'rejected') console.warn('analysis failed:', r.reason);
  }

  // Newest event first. No ranking — every story carries the same weight.
  const stories = settled
    .flatMap(r => (r.status === 'fulfilled' && r.value ? [r.value] : []))
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));

  await report('done', `${stories.length} אירועים`);

  return {
    stories,
    digest: digest.sort((a, b) =>
      SOURCES[a.source].name.localeCompare(SOURCES[b.source].name, 'he')
    ),
    generatedAt: new Date().toISOString(),
    stats: {
      articlesScanned: articles.length,
      storiesFound: stories.length,
      sourcesLive,
      totalSources: SOURCE_IDS.length,
    },
  };
}

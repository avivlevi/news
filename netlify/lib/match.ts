import { SOURCES, TOTAL_SOURCES } from '../../shared/sources.js';
import type { RawArticle } from './feeds.js';
import { callTool, MODEL_DEEP, MODEL_FAST, type Anthropic } from './llm.js';

/** Articles more than this far apart are covering different moments. */
export const WINDOW_HOURS = 36;

export interface MatchGroup {
  indices: number[];
  headline: string;
  agreed: string;
}

/* ------------------------------------------------------------------ *
 * Matching. Lexical title overlap is useless here: outlets covering one
 * event word their headlines differently, and that divergence is the
 * whole subject. Only a reader can tell that two headlines are one event.
 * ------------------------------------------------------------------ */

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
              description: "Neutral Hebrew headline, free of any outlet's spin. Under 12 words.",
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

export async function matchStories(client: Anthropic, articles: RawArticle[]): Promise<MatchGroup[]> {
  const list = articles
    .map((a, i) => {
      const when = new Date(a.publishedAt).toLocaleString('he-IL', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem',
      });
      return `[${i}] ${when} (${SOURCES[a.source].name}) ${a.title}${
        a.description ? ` — ${a.description.slice(0, 150)}` : ''
      }`;
    })
    .join('\n');

  const prompt = `להלן כותרות חדשות מ-${TOTAL_SOURCES} אתרי חדשות ישראליים, עם מועד הפרסום של כל אחת.

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

  const out = await callTool<{ groups: MatchGroup[] }>(client, {
    model: MODEL_DEEP, tool: MATCH_TOOL, prompt, maxTokens: 32_000, effort: 'high',
  });

  // The window rule is restated in code: the model follows it well but not
  // perfectly, and a five-day "story" isn't a comparison of one moment.
  return (out?.groups ?? []).flatMap(g => {
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

/* ------------------------------------------------------------------ *
 * Merging. The matcher reliably splits one event into two groups —
 * typically along outlet lines, which is the worst possible split here:
 * each half ends up with a different slice of the spectrum and the
 * comparison quietly disappears. One cheap pass over the group headlines
 * catches it.
 * ------------------------------------------------------------------ */

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

export async function mergeGroups(client: Anthropic, groups: MatchGroup[]): Promise<MatchGroup[]> {
  if (groups.length < 2) return groups;

  const list = groups.map((g, i) => `[${i}] ${g.headline} — ${g.agreed}`).join('\n');
  const prompt = `להלן קבוצות כתבות שזוהו כאירועים נפרדים:

${list}

אילו מהן מתארות למעשה **אותו אירוע בודד** ופוצלו בטעות?

דוגמה לפיצול שגוי: "גבר נורה למוות ביפו" ו-"אחמד עבד שוקרא נורה למוות ביפו" — אותה ירייה, שתי כותרות.

החזר רק מיזוגים ודאיים. אם אתה מסופק — אל תמזג. קבוצות על אותו נושא אך אירועים שונים (שתי תאונות שונות, שתי החלטות שונות) נשארות נפרדות.`;

  const out = await callTool<{ merges: { ids: number[]; headline: string }[] }>(client, {
    model: MODEL_FAST, tool: MERGE_TOOL, prompt, maxTokens: 8_000, effort: 'medium',
  });

  const consumed = new Set<number>();
  const merged: MatchGroup[] = [];

  for (const m of out?.merges ?? []) {
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

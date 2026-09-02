import type { RunSummary, StoriesPayload } from '../../shared/types.js';

/** Runs kept. At a few manual runs a day this is a couple of months. */
export const MAX_RUNS = 90;

/** Filesystem- and blob-safe id: 20260902-183000. */
export function runIdFor(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`;
}

/** The slice of a run that the lexicon and coverage views need. */
export function summarise(payload: StoriesPayload): RunSummary {
  return {
    id: payload.runId,
    generatedAt: payload.generatedAt,
    stats: payload.stats,
    events: payload.stories.map(s => ({
      id: s.id,
      headline: s.headline,
      reportedAt: s.reportedAt,
      sources: s.takes.map(t => t.source),
      contrasts: s.contrasts ?? [],
      contradictions: (s.contradictions ?? []).length,
    })),
  };
}

/** Newest first, capped. Returns the ids that fell off the end so callers can delete them. */
export function appendRun(index: RunSummary[], run: RunSummary): { index: RunSummary[]; dropped: string[] } {
  const next = [run, ...index.filter(r => r.id !== run.id)]
    .sort((a, b) => b.id.localeCompare(a.id));
  return { index: next.slice(0, MAX_RUNS), dropped: next.slice(MAX_RUNS).map(r => r.id) };
}

import type { RunSummary, SourceId, TermContrast } from '@/types';
import { alphabetical } from './sources';

export interface HistoryEvent {
  id: string;
  headline: string;
  reportedAt: string;
  sources: SourceId[];
  contrasts: TermContrast[];
  contradictions: number;
  runId: string;
}

/** Each event once, from the newest run that carried it. */
export function uniqueEvents(runs: RunSummary[]): HistoryEvent[] {
  const seen = new Set<string>();
  const out: HistoryEvent[] = [];
  for (const run of [...runs].sort((a, b) => b.id.localeCompare(a.id))) {
    for (const e of run.events ?? []) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push({ ...e, runId: run.id });
    }
  }
  return out.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
}

export interface LexiconEntry {
  concept: string;
  /** Events in which this concept was named differently. */
  events: number;
  byOutlet: { source: SourceId; terms: { term: string; count: number }[] }[];
}

const normalise = (s: string) => s.trim().replace(/^ה/, '').replace(/\s+/g, ' ');

/**
 * Every "same thing, different words" row from every kept run, folded by the
 * thing being named. Pure counting of quoted wording — no claim about which
 * wording is right.
 */
export function buildLexicon(events: HistoryEvent[]): LexiconEntry[] {
  const groups = new Map<string, { concept: string; events: Set<string>; terms: Map<SourceId, Map<string, number>> }>();

  for (const e of events) {
    for (const c of e.contrasts ?? []) {
      const key = normalise(c.concept);
      if (!key) continue;
      const g = groups.get(key) ?? { concept: c.concept.trim(), events: new Set(), terms: new Map() };
      g.events.add(e.id);
      for (const v of c.variants) {
        const per = g.terms.get(v.source) ?? new Map<string, number>();
        const term = v.term.trim();
        per.set(term, (per.get(term) ?? 0) + 1);
        g.terms.set(v.source, per);
      }
      groups.set(key, g);
    }
  }

  return [...groups.values()]
    .map(g => ({
      concept: g.concept,
      events: g.events.size,
      byOutlet: [...g.terms.entries()]
        .sort(([a], [b]) => alphabetical(a, b))
        .map(([source, per]) => ({
          source,
          terms: [...per.entries()].map(([term, count]) => ({ term, count })).sort((a, b) => b.count - a.count),
        })),
    }))
    .sort((a, b) => b.events - a.events || a.concept.localeCompare(b.concept, 'he'));
}

export interface OutletCoverage {
  source: SourceId;
  covered: number;
  /** Events reported by at least `threshold` other outlets that this one did not run. */
  missed: HistoryEvent[];
}

export function buildCoverage(events: HistoryEvent[], outlets: SourceId[], threshold = 3): OutletCoverage[] {
  return outlets.map(source => ({
    source,
    covered: events.filter(e => e.sources.includes(source)).length,
    missed: events.filter(e => !e.sources.includes(source) && e.sources.length >= threshold),
  }));
}

export type SourceId =
  | 'ynet' | 'n12' | 'c14' | 'haaretz' | 'i24' | 't13';

/** One outlet's version of a shared event. Everything here is quoted or counted. */
export interface OutletTake {
  source: SourceId;
  /** The outlet's own headline — headlines carry framing, so they're shown as-is. */
  title: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  /** Opening sentence, verbatim. */
  lede: string;
  /** Plain description of how this article handled the event: what it opened
   *  with, what it gave space to, how it was structured. Descriptive only. */
  approach: string;
  /** Sentences where this outlet characterises someone, in its own words. No label. */
  characterisations: string[];
  /** Named people and bodies actually quoted. */
  voices: string[];
}

/** A claim some outlets reported and others did not. */
export interface FactRow {
  claim: string;
  reportedBy: SourceId[];
}

/** Outlets stating incompatible things about the same detail. */
export interface Contradiction {
  about: string;
  versions: { source: SourceId; claim: string }[];
}

/** The same thing, named differently. No verdict on which naming is correct. */
export interface TermContrast {
  concept: string;
  variants: { source: SourceId; term: string }[];
}

export interface Story {
  id: string;
  /** Plain descriptive title so the card is scannable. Every outlet's own headline is shown too. */
  headline: string;
  /** What every version states. */
  agreed: string;
  /** Latest publication time among the versions — the list is ordered by this. */
  reportedAt: string;
  takes: OutletTake[];
  contradictions: Contradiction[];
  differingFacts: FactRow[];
  contrasts: TermContrast[];
}

/** What one site published across the whole sweep, matched or not. */
export interface OutletDigest {
  source: SourceId;
  articleCount: number;
  summary: string;
}

export interface StoriesPayload {
  stories: Story[];
  digest: OutletDigest[];
  generatedAt: string;
  stats: {
    articlesScanned: number;
    storiesFound: number;
    sourcesLive: number;
    totalSources: number;
  };
}

export type RunStage =
  | 'idle' | 'collecting' | 'summarising' | 'matching' | 'reading' | 'comparing' | 'done' | 'failed';

export interface RunStatus {
  stage: RunStage;
  detail: string;
  startedAt: string | null;
  finishedAt: string | null;
}

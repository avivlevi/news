export type SourceId = 'ynet' | 'n12' | 'c14' | 'haaretz' | 'i24' | 't13';

/** Bumped whenever the analysis output changes shape. Older stories are re-analysed, never reused. */
export const STORY_SCHEMA = 2;

/**
 * Where an item sat on its outlet's front page. Order alone carries most of
 * the signal; the slot says which visual block it was in.
 *
 * - `lead`   the single main story the page opens with
 * - `top`    the block of headline stories directly around the lead
 * - `main`   everything else in the page body
 * - `ticker` a running list of short flashes (מבזקים) beside the body
 */
export type Slot = 'lead' | 'top' | 'main' | 'ticker';

/** How long and how prominently an article was on its outlet's front page. Measured, not judged. */
export interface Exposure {
  firstSeen: string;
  lastSeen: string;
  /** 1 is the top of the page. */
  bestPosition: number;
  bestSlot: Slot;
  /** Hourly scrapes it appeared in, out of that outlet's scrapes between first and last sighting. */
  snapshotsSeen: number;
  snapshotsTotal: number;
  leadSnapshots: number;
  onFrontNow: boolean;
  /** Every headline the front page gave it, oldest first. More than one means it was retitled. */
  titles: { title: string; at: string }[];
}

/** How the article body was read for this take. */
export type BodyRead = 'full' | 'blurb';

/** Grammatical form of the outlet's headline. Descriptive linguistics only. */
export type HeadlineForm = 'active' | 'passive' | 'nominal';

/** One outlet's version of a shared event. Everything here is quoted or counted. */
export interface OutletTake {
  source: SourceId;
  /** The outlet's own headline — headlines carry framing, so they're shown as-is. */
  title: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  /** Whether the full article text was read, or only the feed blurb. */
  bodyRead: BodyRead;
  /** Words in the article body. Only present when the body was read in full. */
  wordCount?: number;
  /** Opening sentence, verbatim. */
  lede: string;
  /** What the article opens with, in a few words. */
  leadsWith: string;
  /** Who or what performs the action in the headline, as the headline names it. */
  headlineActor: string;
  headlineForm: HeadlineForm;
  /** Plain description of how this article handled the event. Descriptive only. */
  approach: string;
  /** Sentences where this outlet characterises someone, in its own words. No label. */
  characterisations: string[];
  /** Named people and bodies actually quoted. */
  voices: string[];
  /** Absent when the article never appeared on the front page, or for runs before the front-page record. */
  exposure?: Exposure;
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
  schema?: number;
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

export interface RunStats {
  articlesScanned: number;
  storiesFound: number;
  sourcesLive: number;
  totalSources: number;
  /** How many events were carried over unchanged from the previous run. */
  reused?: number;
  /** Wall-clock seconds for the whole run. */
  seconds?: number;
}

export interface StoriesPayload {
  runId: string;
  stories: Story[];
  digest: OutletDigest[];
  generatedAt: string;
  stats: RunStats;
}

/** Compact record of one run, kept for every run so patterns can accumulate. */
export interface RunSummary {
  id: string;
  generatedAt: string;
  stats: RunStats;
  events: {
    id: string;
    headline: string;
    reportedAt: string;
    sources: SourceId[];
    contrasts: TermContrast[];
    contradictions: number;
  }[];
}

export type RunStage =
  | 'idle' | 'collecting' | 'summarising' | 'matching' | 'reading' | 'comparing' | 'done' | 'failed';

export interface RunStatus {
  stage: RunStage;
  detail: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/** One item of one hourly front-page scrape. */
export interface FrontRow {
  source: SourceId;
  takenAt: string;
  position: number;
  slot: Slot;
  title: string;
  url: string;
  isNews: boolean;
  section: string;
}

export interface FrontHealth {
  source: SourceId;
  takenAt: string;
  itemCount: number;
  error: string | null;
}

export interface FrontPayload {
  from: string;
  to: string;
  rows: FrontRow[];
  health: FrontHealth[];
}

export interface HeadlineChange {
  source: SourceId;
  url: string;
  isNews: boolean;
  bestSlot: Slot;
  bestPosition: number;
  firstSeen: string;
  lastSeen: string;
  versions: { title: string; at: string }[];
}

/** Shown in the lead or top block, then gone from the page within one scrape. */
export interface ShortLived {
  source: SourceId;
  url: string;
  title: string;
  isNews: boolean;
  bestSlot: Slot;
  bestPosition: number;
  firstSeen: string;
  lastSeen: string;
}

export interface EditsPayload {
  since: string;
  changes: HeadlineChange[];
  shortLived: ShortLived[];
}

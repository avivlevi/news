import type { Exposure, OutletTake, Slot } from '@/types';

export const SLOT_LABEL: Record<Slot, string> = {
  lead: 'כותרת ראשית',
  top: 'בלוק עליון',
  main: 'גוף העמוד',
  ticker: 'מבזקים',
};

/** "פחות משעה", "כ-3 שעות", "יום ו-4 שעות". Scrapes are hourly, so nothing finer is claimed. */
export function duration(ms: number): string {
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return 'פחות משעה';
  if (hours === 1) return 'כשעה';
  if (hours < 24) return `כ-${hours} שעות`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const d = days === 1 ? 'יום' : `${days} ימים`;
  return rest ? `${d} ו-${rest} שעות` : d;
}

/** Time on the page: first to last sighting, plus the hour the last scrape stands for. */
export function onPage(e: Exposure): string {
  const ms = new Date(e.lastSeen).getTime() - new Date(e.firstSeen).getTime() + 3_600_000;
  return duration(ms);
}

/** Minutes after the first outlet's article reached its front page, or null for the first. */
export function lagMinutes(take: OutletTake, takes: OutletTake[]): number | null {
  const firsts = takes.flatMap(t => (t.exposure ? [new Date(t.exposure.firstSeen).getTime()] : []));
  if (!take.exposure || firsts.length < 2) return null;
  const lag = Math.round((new Date(take.exposure.firstSeen).getTime() - Math.min(...firsts)) / 60_000);
  return lag;
}

export function lagText(min: number): string {
  if (min < 30) return 'בין הראשונים';
  return `${duration(min * 60_000)} אחרי הראשון`;
}

/** True when at least one take carries exposure, i.e. the run had the front-page record. */
export const hasFrontRecord = (takes: OutletTake[]) => takes.some(t => t.exposure);

/**
 * Each headline once, in order of first appearance. Some sites rotate two
 * headlines for the same article (an A/B test, or headline vs. pull-quote), so
 * a title can come back; `alternating` says so rather than counting every flip.
 */
export function headlineVersions(versions: { title: string; at: string }[] = []) {
  const first = new Map<string, string>();
  for (const v of versions) if (!first.has(v.title)) first.set(v.title, v.at);
  const distinct = [...first].map(([title, at]) => ({ title, at }));
  return { distinct, alternating: versions.length > distinct.length };
}

export const retitles = (e?: Exposure) => Math.max(0, headlineVersions(e?.titles).distinct.length - 1);

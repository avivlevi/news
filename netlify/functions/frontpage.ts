import { call } from '../lib/db.js';
import type { FrontHealth, FrontPayload, FrontRow, SourceId, Slot } from '../../shared/types.js';

const DAY_MS = 86_400_000;
/** One request covers at most a week of hourly scrapes. */
const MAX_RANGE_MS = 7 * DAY_MS;

interface Row { source: SourceId; taken_at: string; position: number; slot: Slot; title: string; url: string; is_news: boolean; section: string }
interface Health { source: SourceId; taken_at: string; item_count: number; error: string | null }

/**
 * The top of every front page over a time range: `?from=ISO&to=ISO&top=10`.
 * Defaults to the last 24 hours.
 */
export default async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const to = q.get('to') ? new Date(q.get('to')!) : new Date();
  let from = q.get('from') ? new Date(q.get('from')!) : new Date(to.getTime() - DAY_MS);
  if (Number.isNaN(to.getTime()) || Number.isNaN(from.getTime())) {
    return Response.json({ error: 'bad date' }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) from = new Date(to.getTime() - MAX_RANGE_MS);
  const top = Math.min(Math.max(Number(q.get('top')) || 10, 1), 30);

  const [rows, health] = await Promise.all([
    call<Row[]>('front_timeline', { p_from: from.toISOString(), p_to: to.toISOString(), p_top: top }),
    call<Health[]>('latest_snapshots'),
  ]);

  const payload: FrontPayload = {
    from: from.toISOString(),
    to: to.toISOString(),
    rows: rows.map((r): FrontRow => ({
      source: r.source, takenAt: r.taken_at, position: r.position, slot: r.slot,
      title: r.title, url: r.url, isNews: r.is_news, section: r.section,
    })),
    health: health.map((h): FrontHealth => ({
      source: h.source, takenAt: h.taken_at, itemCount: h.item_count, error: h.error,
    })),
  };
  return Response.json(payload, { headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=600' } });
};

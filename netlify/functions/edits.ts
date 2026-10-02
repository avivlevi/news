import { call } from '../lib/db.js';
import type { EditsPayload, HeadlineChange, ShortLived, SourceId, Slot } from '../../shared/types.js';

interface Change {
  source: SourceId; url: string; is_news: boolean; best_slot: Slot; best_position: number;
  first_seen_at: string; last_seen_at: string; versions: { title: string; at: string }[];
}
interface Brief {
  source: SourceId; url: string; title: string; is_news: boolean; best_slot: Slot; best_position: number;
  first_seen_at: string; last_seen_at: string;
}

/** Retitled front-page headlines, and prominent items pulled within an hour: `?days=2`. */
export default async (req: Request) => {
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get('days')) || 2, 1), 14);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [changes, brief] = await Promise.all([
    call<Change[]>('headline_changes', { p_since: since }),
    call<Brief[]>('short_lived', { p_since: since, p_max_snapshots: 1 }),
  ]);

  const payload: EditsPayload = {
    since,
    changes: changes.map((c): HeadlineChange => ({
      source: c.source, url: c.url, isNews: c.is_news, bestSlot: c.best_slot, bestPosition: c.best_position,
      firstSeen: c.first_seen_at, lastSeen: c.last_seen_at, versions: c.versions,
    })),
    shortLived: brief.map((b): ShortLived => ({
      source: b.source, url: b.url, title: b.title, isNews: b.is_news, bestSlot: b.best_slot,
      bestPosition: b.best_position, firstSeen: b.first_seen_at, lastSeen: b.last_seen_at,
    })),
  };
  return Response.json(payload, { headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=600' } });
};

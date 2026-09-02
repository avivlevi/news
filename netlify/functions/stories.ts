import { getStore } from '@netlify/blobs';
import type { StoriesPayload } from '../../shared/types.js';

/** Serves a precomputed payload — the latest, or one run by id. No model calls on the request path. */
export default async (req: Request) => {
  const run = new URL(req.url).searchParams.get('run');
  const key = run && /^[0-9]{8}-[0-9]{6}$/.test(run) ? `runs/${run}` : 'stories';
  const payload = (await getStore('news').get(key, { type: 'json' })) as StoriesPayload | null;

  if (!payload) {
    return Response.json(
      { stories: [], digest: [], generatedAt: null, stats: null, pending: true },
      { status: run ? 404 : 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return Response.json(payload, {
    headers: {
      'Cache-Control': run
        ? 'public, max-age=3600, immutable'
        : 'public, max-age=60, stale-while-revalidate=600',
    },
  });
};

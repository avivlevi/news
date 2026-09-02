import { getStore } from '@netlify/blobs';
import type { StoriesPayload } from '../../src/types.js';

/** Serves the precomputed payload. No model calls on the request path. */
export default async () => {
  const payload = await getStore('news').get('stories', { type: 'json' }) as StoriesPayload | null;

  if (!payload) {
    return Response.json(
      { stories: [], generatedAt: null, stats: null, pending: true },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return Response.json(payload, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' },
  });
};

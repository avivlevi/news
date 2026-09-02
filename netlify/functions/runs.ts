import { getStore } from '@netlify/blobs';
import type { RunSummary } from '../../shared/types.js';

/** Every kept run, newest first, in the compact form the history views need. */
export default async () => {
  const index = ((await getStore('news').get('runs-index', { type: 'json' })) as RunSummary[] | null) ?? [];
  return Response.json(index, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' },
  });
};

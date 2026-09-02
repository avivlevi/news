import { getStore } from '@netlify/blobs';
import type { RunStatus } from '../../shared/types.js';

const IDLE: RunStatus = { stage: 'idle', detail: '', startedAt: null, finishedAt: null };

/** Cheap poll target while a run is in flight. */
export default async () => {
  const status = (await getStore('news').get('status', { type: 'json' })) as RunStatus | null;
  return Response.json(status ?? IDLE, {
    headers: { 'Cache-Control': 'no-store' },
  });
};

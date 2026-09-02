import type { RunStatus, RunSummary, StoriesPayload } from '@/types';

const json = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
};

export const api = {
  stories: (runId?: string) =>
    json<StoriesPayload & { pending?: boolean }>(runId ? `/api/stories?run=${runId}` : '/api/stories'),
  runs: () => json<RunSummary[]>('/api/runs'),
  status: () => json<RunStatus>('/api/status'),
  refresh: () => fetch('/api/refresh', { method: 'POST' }),
};

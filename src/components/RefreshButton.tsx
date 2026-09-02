import { useCallback, useEffect, useRef, useState } from 'react';
import type { RunStatus, RunStage } from '@/types';

const STAGE_TEXT: Record<RunStage, string> = {
  idle: '',
  collecting: 'אוסף כתבות',
  summarising: 'מסכם מה כל אתר פרסם',
  matching: 'מזהה אירועים משותפים',
  reading: 'קורא את הכתבות',
  comparing: 'משווה גרסאות',
  done: 'הושלם',
  failed: 'נכשל',
};

const RUNNING: RunStage[] = ['collecting', 'summarising', 'matching', 'reading', 'comparing'];

/**
 * The run outlives the request that starts it, so the button starts the job and
 * then follows it by polling the stored status.
 */
export function RefreshButton({ onFinished }: { onFinished: () => void }) {
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (polling.current) {
      window.clearInterval(polling.current);
      polling.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  const poll = useCallback(() => {
    stop();
    polling.current = window.setInterval(async () => {
      try {
        const res = await fetch('/api/status', { cache: 'no-store' });
        const s = (await res.json()) as RunStatus;
        setStatus(s);
        if (s.stage === 'done') { stop(); onFinished(); }
        if (s.stage === 'failed') { stop(); setError(s.detail); }
      } catch {
        /* keep polling — a dropped poll shouldn't kill the run's display */
      }
    }, 2000);
  }, [onFinished, stop]);

  const start = async () => {
    setError(null);
    setStatus({ stage: 'collecting', detail: 'מתחיל', startedAt: new Date().toISOString(), finishedAt: null });
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status}`);
      poll();
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const running = status ? RUNNING.includes(status.stage) : false;

  return (
    <div className="refresh">
      <button className="refresh__btn" onClick={start} disabled={running}>
        {running ? 'אוסף…' : 'אסוף חדשות עכשיו'}
      </button>

      {running && status && (
        <p className="refresh__progress" role="status">
          <span className="refresh__spinner" aria-hidden="true" />
          <span className="refresh__stage">{STAGE_TEXT[status.stage]}</span>
          {status.detail && <span className="refresh__detail">{status.detail}</span>}
        </p>
      )}

      {error && <p className="refresh__error" role="alert">האיסוף נכשל: {error}</p>}
    </div>
  );
}

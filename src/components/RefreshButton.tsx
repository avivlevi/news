import { useCallback, useEffect, useRef, useState } from 'react';
import type { RunStatus, RunStage } from '@/types';
import { api } from '@/lib/api';

const STAGE_TEXT: Record<RunStage, string> = {
  idle: '',
  collecting: 'אוסף כתבות',
  summarising: 'מסכם מה כל אתר פרסם ומזהה אירועים',
  matching: 'מאחד כפילויות וקורא את הכתבות',
  reading: 'קורא את הכתבות',
  comparing: 'משווה גרסאות',
  done: 'הושלם',
  failed: 'נכשל',
};

const RUNNING: RunStage[] = ['collecting', 'summarising', 'matching', 'reading', 'comparing'];
const ORDER: RunStage[] = ['collecting', 'summarising', 'matching', 'comparing', 'done'];

/**
 * The run outlives the request that starts it, so the button starts the job and
 * then follows it by polling the stored status.
 */
export function RefreshButton({ onFinished }: { onFinished: () => void }) {
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (polling.current) { window.clearInterval(polling.current); polling.current = null; }
  }, []);
  useEffect(() => stop, [stop]);

  const poll = useCallback(() => {
    stop();
    polling.current = window.setInterval(async () => {
      try {
        const s = await api.status();
        setStatus(s);
        if (s.stage === 'done') { stop(); onFinished(); }
        if (s.stage === 'failed') { stop(); setError(s.detail); }
      } catch { /* a dropped poll shouldn't kill the run's display */ }
    }, 2000);
  }, [onFinished, stop]);

  const start = async () => {
    setError(null);
    setStatus({ stage: 'collecting', detail: 'מתחיל', startedAt: new Date().toISOString(), finishedAt: null });
    try {
      const res = await api.refresh();
      if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status}`);
      poll();
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const running = status ? RUNNING.includes(status.stage) : false;
  const step = status ? Math.max(0, ORDER.indexOf(status.stage === 'reading' ? 'matching' : status.stage)) : 0;

  return (
    <div className="refresh">
      <button className="refresh__btn" onClick={start} disabled={running}>
        {running ? 'אוסף…' : 'אסוף חדשות עכשיו'}
      </button>

      {running && status && (
        <div className="refresh__progress" role="status">
          <ol className="refresh__steps" aria-hidden="true">
            {ORDER.slice(0, -1).map((s, i) => (
              <li key={s} className={i < step ? 'is-done' : i === step ? 'is-now' : ''} />
            ))}
          </ol>
          <span className="refresh__stage">{STAGE_TEXT[status.stage]}</span>
          {status.detail && <span className="refresh__detail">{status.detail}</span>}
        </div>
      )}

      {error && <p className="refresh__error" role="alert">האיסוף נכשל: {error}</p>}
    </div>
  );
}

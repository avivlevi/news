import type { RunSummary } from '@/types';
import { stamp } from '@/lib/time';

/** Every kept run. Picking one shows that run exactly as it was collected. */
export function RunPicker({ runs, runId, onPick }: {
  runs: RunSummary[];
  runId: string | null;
  onPick: (id: string | null) => void;
}) {
  if (runs.length < 2) return null;
  return (
    <label className="runpick">
      <span className="runpick__label">איסוף</span>
      <select
        className="runpick__select"
        value={runId ?? ''}
        onChange={e => onPick(e.target.value || null)}
      >
        <option value="">האחרון</option>
        {runs.map(r => (
          <option key={r.id} value={r.id}>
            {stamp(r.generatedAt)} · {r.stats.storiesFound} אירועים
          </option>
        ))}
      </select>
    </label>
  );
}

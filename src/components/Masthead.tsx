import type { RunSummary, StoriesPayload } from '@/types';
import { RefreshButton } from './RefreshButton';
import { RunPicker } from './RunPicker';
import { stamp } from '@/lib/time';

interface Props {
  payload: StoriesPayload | null;
  runs: RunSummary[];
  runId: string | null;
  onPickRun: (id: string | null) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onRefreshed: () => void;
}

export function Masthead({ payload, runs, runId, onPickRun, theme, onToggleTheme, onRefreshed }: Props) {
  const stats = payload?.stats ?? null;
  return (
    <header className="masthead">
      <div className="masthead__bar">
        <h1 className="masthead__name">אותו אירוע</h1>
        <div className="masthead__tools">
          <RunPicker runs={runs} runId={runId} onPick={onPickRun} />
          <button
            className="masthead__theme"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'עבור לתצוגה בהירה' : 'עבור לתצוגה כהה'}
          >
            {theme === 'dark' ? 'בהיר' : 'כהה'}
          </button>
        </div>
      </div>

      <p className="masthead__thesis">
        אותו אירוע, כפי שדווח בשישה אתרי חדשות ישראליים.
        <span className="masthead__thesis-rest">
          {' '}לא מי צודק ולא מי מוטה — אלא מה כל אחד כתב, במה פתח, את מי ציטט, ומה מופיע אצל אחד ולא אצל אחר.
        </span>
      </p>

      <div className="masthead__row">
        <RefreshButton onFinished={onRefreshed} />
        {stats && (
          <dl className="ledger">
            <div className="ledger__cell"><dd>{stats.articlesScanned}</dd><dt>כתבות נסרקו</dt></div>
            <div className="ledger__cell"><dd>{stats.storiesFound}</dd><dt>אירועים משותפים</dt></div>
            <div className="ledger__cell"><dd>{stats.sourcesLive}/{stats.totalSources}</dd><dt>מקורות</dt></div>
            {payload?.generatedAt && (
              <div className="ledger__cell"><dd className="ledger__when">{stamp(payload.generatedAt)}</dd><dt>נאסף</dt></div>
            )}
          </dl>
        )}
      </div>
    </header>
  );
}

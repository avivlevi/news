import type { StoriesPayload } from '@/types';
import { RefreshButton } from './RefreshButton';

interface Props {
  stats: StoriesPayload['stats'] | null;
  generatedAt: string | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onRefreshed: () => void;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });

export function Masthead({ stats, generatedAt, theme, onToggleTheme, onRefreshed }: Props) {
  return (
    <header className="masthead">
      <div className="masthead__bar">
        <div>
          <h1 className="masthead__name">אותו אירוע</h1>
          <p className="masthead__tagline">
            אותו אירוע, כפי שדווח בשישה אתרי חדשות ישראליים
          </p>
        </div>
        <button
          className="masthead__theme"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'עבור לתצוגה בהירה' : 'עבור לתצוגה כהה'}
        >
          {theme === 'dark' ? 'בהיר' : 'כהה'}
        </button>
      </div>

      <p className="masthead__thesis">
        כאן מופיעים אירועים ששני אתרים ומעלה דיווחו עליהם. האתר אינו מדרג אתרים,
        אינו מייחס להם עמדה ואינו מסמן מי צודק — הוא מציג מה כל אחד כתב, ומה
        מופיע אצל אחד ולא אצל אחר.
      </p>

      <RefreshButton onFinished={onRefreshed} />

      {stats && (
        <dl className="ledger">
          <div className="ledger__cell">
            <dt>כתבות נסרקו</dt>
            <dd>{stats.articlesScanned}</dd>
          </div>
          <div className="ledger__cell">
            <dt>אירועים משותפים</dt>
            <dd>{stats.storiesFound}</dd>
          </div>
          <div className="ledger__cell">
            <dt>מקורות</dt>
            <dd>{stats.sourcesLive}/{stats.totalSources}</dd>
          </div>
          {generatedAt && (
            <div className="ledger__cell">
              <dt>נאסף</dt>
              <dd className="ledger__when">{fmt(generatedAt)}</dd>
            </div>
          )}
        </dl>
      )}
    </header>
  );
}

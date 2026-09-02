import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SourceId, StoriesPayload } from '@/types';
import { Masthead } from '@/components/Masthead';
import { StoryCard } from '@/components/StoryCard';
import { Digest } from '@/components/Digest';
import { SourceFilter } from '@/components/SourceFilter';
import { alphabetical } from '@/lib/sources';
import './app.css';

type Theme = 'light' | 'dark';
type State =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: StoriesPayload };

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  return [theme, () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))] as const;
}

const FILTER_KEY = 'sources';

function useSourceFilter() {
  const [selected, setSelected] = useState<Set<SourceId>>(() => {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      return new Set(raw ? (JSON.parse(raw) as SourceId[]) : []);
    } catch {
      return new Set();
    }
  });

  const persist = (next: Set<SourceId>) => {
    setSelected(next);
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify([...next]));
    } catch {
      /* a blocked storage write shouldn't break filtering */
    }
  };

  const toggle = (id: SourceId) => {
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    persist(next);
  };

  return { selected, toggle, clear: () => persist(new Set<SourceId>()) };
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const { selected, toggle, clear } = useSourceFilter();

  /** Reads what was already collected. Collecting itself only happens on the button. */
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/stories', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as StoriesPayload & { pending?: boolean };
      setState(
        data.pending || data.stories.length === 0
          ? { status: 'empty' }
          : { status: 'ready', data }
      );
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const data = state.status === 'ready' ? state.data : null;

  const view = useMemo(() => {
    if (!data) return null;

    // Include sites that published but matched no shared event — they still
    // have a digest paragraph, so they must remain selectable.
    const available = [...new Set([
      ...data.stories.flatMap(s => s.takes.map(t => t.source)),
      ...(data.digest ?? []).map(d => d.source),
    ])].sort(alphabetical);

    // A story stays if any selected site covered it — its other versions are
    // kept, since removing them would break the comparison the page exists for.
    const stories = selected.size === 0
      ? data.stories
      : data.stories.filter(s => s.takes.some(t => selected.has(t.source)));

    const digest = selected.size === 0
      ? data.digest
      : data.digest?.filter(d => selected.has(d.source));

    return { available, stories, digest, total: data.stories.length };
  }, [data, selected]);

  return (
    <div className="shell">
      <Masthead
        stats={state.status === 'ready' ? state.data.stats : null}
        generatedAt={state.status === 'ready' ? state.data.generatedAt : null}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRefreshed={load}
      />

      <main className="feed">
        {state.status === 'loading' && <p className="notice">טוען…</p>}

        {state.status === 'empty' && (
          <div className="notice">
            <p className="notice__lead">עוד לא נאספו כתבות.</p>
            <p>לחץ על «אסוף חדשות עכשיו» כדי להתחיל. האיסוף אורך כשתי דקות.</p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="notice">
            <p className="notice__lead">לא הצלחנו לטעון את הנתונים.</p>
            <p>רענן את העמוד כדי לנסות שוב. ({state.message})</p>
          </div>
        )}

        {view && (
          <>
            <SourceFilter
              available={view.available}
              selected={selected}
              onToggle={toggle}
              onClear={clear}
              shown={view.stories.length}
              total={view.total}
            />

            <Digest entries={view.digest} />

            {view.stories.length === 0 ? (
              <div className="notice">
                <p className="notice__lead">אין אירועים לאתרים שנבחרו.</p>
                <p>בחר אתר נוסף או לחץ «הכל».</p>
              </div>
            ) : (
              view.stories.map(s => <StoryCard key={s.id} story={s} />)
            )}
          </>
        )}
      </main>

      <footer className="foot">
        <p>
          המקורות: ynet, N12, חדשות 13, הארץ, i24NEWS וערוץ 14.
          האתרים מוצגים תמיד בסדר אלפביתי.
        </p>
        <p className="foot__method">
          שיטה: תא ריק בטבלה מציין שהטענה אינה מופיעה באותה כתבה — ותו לא.
          אורך הכתבה אינו נלקח בחשבון, ולכן ידיעה קצרה תיראה כמכילה פחות פרטים
          מכתבה מורחבת.
        </p>
      </footer>
    </div>
  );
}

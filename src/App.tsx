import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RunSummary, SourceId, StoriesPayload } from '@/types';
import { api } from '@/lib/api';
import { alphabetical } from '@/lib/sources';
import { buildCoverage, buildLexicon, uniqueEvents } from '@/lib/history';
import { Masthead } from '@/components/Masthead';
import { Tabs, type View } from '@/components/Tabs';
import { SourceFilter } from '@/components/SourceFilter';
import { StoryCard } from '@/components/StoryCard';
import { Digest } from '@/components/Digest';
import { Lexicon } from '@/components/Lexicon';
import { Coverage } from '@/components/Coverage';
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
    try { localStorage.setItem(FILTER_KEY, JSON.stringify([...next])); } catch { /* storage blocked */ }
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
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [view, setView] = useState<View>('events');
  const { selected, toggle, clear } = useSourceFilter();

  /** Bumped by the refresh button so the latest run is re-read even when runId is already null. */
  const [tick, setTick] = useState(0);

  /** Reads what was already collected. Collecting itself only happens on the button. */
  useEffect(() => {
    let alive = true;
    api.stories(runId ?? undefined)
      .then(data => {
        if (!alive) return;
        setState(data.pending || data.stories.length === 0 ? { status: 'empty' } : { status: 'ready', data });
      })
      .catch(e => {
        if (alive) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return () => { alive = false; };
  }, [runId, tick]);

  useEffect(() => {
    let alive = true;
    api.runs()
      .then(r => { if (alive) setRuns(r); })
      .catch(() => { if (alive) setRuns([]); });
    return () => { alive = false; };
  }, [tick]);

  const onRefreshed = useCallback(() => {
    setRunId(null);
    setTick(t => t + 1);
  }, []);

  const data = state.status === 'ready' ? state.data : null;

  const feed = useMemo(() => {
    if (!data) return null;
    // Sites that published but matched no shared event still have a digest
    // paragraph, so they must remain selectable.
    const available = [...new Set([
      ...data.stories.flatMap(s => s.takes.map(t => t.source)),
      ...(data.digest ?? []).map(d => d.source),
    ])].sort(alphabetical);

    // Selecting sites narrows to events that ALL of them covered — the point
    // of picking two sites is to compare those two. Other versions of the
    // event are kept, since removing them would break the comparison.
    const stories = selected.size === 0
      ? data.stories
      : data.stories.filter(s => {
          const covered = new Set(s.takes.map(t => t.source));
          return [...selected].every(id => covered.has(id));
        });
    const digest = selected.size === 0
      ? data.digest
      : data.digest?.filter(d => selected.has(d.source));
    return { available, stories, digest, total: data.stories.length };
  }, [data, selected]);

  const history = useMemo(() => {
    const events = uniqueEvents(runs);
    const outlets = [...new Set(events.flatMap(e => e.sources))].sort(alphabetical);
    return { events, lexicon: buildLexicon(events), coverage: buildCoverage(events, outlets), outlets };
  }, [runs]);

  const counts = {
    events: feed?.total ?? 0,
    digest: data?.digest?.length ?? 0,
    lexicon: history.lexicon.length,
    coverage: history.events.length,
  };

  return (
    <div className="shell">
      <Masthead
        payload={data}
        runs={runs}
        runId={runId}
        onPickRun={setRunId}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRefreshed={onRefreshed}
      />

      <Tabs view={view} onChange={setView} counts={counts} />

      <main className="main">
        {state.status === 'loading' && <p className="notice">טוען…</p>}

        {state.status === 'empty' && (
          <div className="notice">
            <p className="notice__lead">עוד לא נאספו כתבות.</p>
            <p>לחץ על «אסוף חדשות עכשיו» כדי להתחיל. האיסוף אורך דקה עד שלוש.</p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="notice">
            <p className="notice__lead">לא הצלחנו לטעון את הנתונים.</p>
            <p>רענן את העמוד כדי לנסות שוב. ({state.message})</p>
          </div>
        )}

        {feed && view === 'events' && (
          <>
            <SourceFilter
              available={feed.available}
              selected={selected}
              onToggle={toggle}
              onClear={clear}
              shown={feed.stories.length}
              total={feed.total}
            />
            {feed.stories.length === 0 ? (
              <div className="notice">
                <p className="notice__lead">אין אירוע שכל האתרים שנבחרו דיווחו עליו.</p>
                <p>הסר אתר מהבחירה או לחץ «הכל».</p>
              </div>
            ) : (
              <div className="feed">
                {feed.stories.map(s => <StoryCard key={s.id} story={s} />)}
              </div>
            )}
          </>
        )}

        {feed && view === 'digest' && (
          <>
            <SourceFilter
              available={feed.available}
              selected={selected}
              onToggle={toggle}
              onClear={clear}
              shown={feed.digest?.length ?? 0}
              total={data?.digest?.length ?? 0}
              unit="אתרים"
            />
            <Digest entries={feed.digest} />
          </>
        )}

        {view === 'lexicon' && <Lexicon entries={history.lexicon} runs={runs.length} />}
        {view === 'coverage' && <Coverage events={history.events} coverage={history.coverage} outlets={history.outlets} />}
      </main>

      <footer className="foot">
        <p>
          המקורות: ynet, N12, חדשות 13, הארץ, i24NEWS וערוץ 14. האתרים מוצגים תמיד בסדר אלפביתי,
          ואף אתר אינו מדורג, מסומן או מוערך.
        </p>
        <p className="foot__method">
          שיטה: נקודה ריקה בטבלה מציינת שהטענה אינה מופיעה באותה כתבה — ותו לא.
          כתבה שרק תקציר הפיד שלה נקרא מסומנת ככזו, ואין להסיק ממנה מה הכתבה המלאה השמיטה.
          אורך הכתבה מוצג אך אינו מנוטרל: ידיעה קצרה תכיל פחות פרטים מכתבה מורחבת.
        </p>
      </footer>
    </div>
  );
}

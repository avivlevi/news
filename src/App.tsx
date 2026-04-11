import { useState, useEffect } from 'react';
import { NewsHeader } from '@/components/NewsHeader';
import { NewsGrid } from '@/components/NewsGrid';
import { ArticleModal } from '@/components/ArticleModal';
import { NewsSummary } from '@/components/NewsSummary';
import { clusterArticles } from '@/lib/clustering';
import type { Cluster, SourceId, NewsApiResponse, SummaryState, Article } from '@/types';

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [dark]);

  return [dark, setDark] as const;
}

export function App() {
  const [dark, setDark] = useDarkMode();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<SourceId | 'all'>('all');
  const [openCluster, setOpenCluster] = useState<Cluster | null>(null);
  const [summary, setSummary] = useState<SummaryState>({ status: 'idle' });
  const [articleScores, setArticleScores] = useState<Record<string, number>>({});

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function fetchNews() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/news', { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as NewsApiResponse;
        setFetchedAt(data.fetchedAt);
        setClusters(clusterArticles(data.articles));

        // Fetch per-article bias scores (limit to 40 — full 160 exceeds Netlify 10s timeout)
        fetch('/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articles: data.articles.map((a: Article) => ({
              id: a.id, title: a.title, description: a.description, source: a.source,
            })),
          }),
          signal,
        })
          .then(r => r.json() as Promise<{ scores?: Record<string, number> }>)
          .then(d => { if (!signal.aborted && d.scores) setArticleScores(d.scores); })
          .catch(() => {});

        setSummary({ status: 'loading' });
        fetch('/api/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articles: data.articles.slice(0, 30).map(a => ({
              title: a.title,
              description: a.description,
              source: a.source,
            })),
          }),
          signal,
        })
          .then(r => r.json() as Promise<{ points?: string[]; topics?: string[]; error?: string }>)
          .then(d => {
            if (signal.aborted) return;
            setSummary(
              Array.isArray(d.points) && d.points.length > 0
                ? { status: 'success', points: d.points, topics: Array.isArray(d.topics) ? d.topics : [] }
                : { status: 'error' }
            );
          })
          .catch(e => { if (!signal.aborted) setSummary({ status: 'error' }); void e; });
      } catch (e) {
        if (signal.aborted) return;
        setError(e instanceof Error ? e.message : 'שגיאה בטעינת החדשות');
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    void fetchNews();
    return () => controller.abort();
  }, []);

  const filteredClusters =
    activeSource === 'all'
      ? clusters
      : clusters
          .map(c => ({
            ...c,
            articles: c.articles.filter(a => a.source === activeSource),
          }))
          .filter(c => c.articles.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300" dir="rtl">
      <NewsHeader
        fetchedAt={fetchedAt}
        activeSource={activeSource}
        onSourceChange={setActiveSource}
        dark={dark}
        onToggleDark={() => setDark(d => !d)}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {!loading && !error && <NewsSummary state={summary} />}
        {error ? (
          <div className="text-center text-destructive py-16 text-lg">{error}</div>
        ) : (
          <NewsGrid
            clusters={filteredClusters}
            loading={loading}
            onOpenCluster={setOpenCluster}
            articleScores={articleScores}
          />
        )}
      </main>

      <ArticleModal
        cluster={openCluster}
        onClose={() => setOpenCluster(null)}
      />
    </div>
  );
}

export default App;

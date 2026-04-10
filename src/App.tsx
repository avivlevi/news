import { useState, useEffect } from 'react';
import { NewsHeader } from '@/components/NewsHeader';
import { NewsGrid } from '@/components/NewsGrid';
import { ArticleModal } from '@/components/ArticleModal';
import { clusterArticles } from '@/lib/clustering';
import type { Cluster, SourceId, NewsApiResponse } from '@/types';

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

  useEffect(() => {
    async function fetchNews() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/news');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as NewsApiResponse;
        setFetchedAt(data.fetchedAt);
        setClusters(clusterArticles(data.articles));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'שגיאה בטעינת החדשות');
      } finally {
        setLoading(false);
      }
    }
    void fetchNews();
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
        {error ? (
          <div className="text-center text-destructive py-16 text-lg">{error}</div>
        ) : (
          <NewsGrid
            clusters={filteredClusters}
            loading={loading}
            onOpenCluster={setOpenCluster}
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

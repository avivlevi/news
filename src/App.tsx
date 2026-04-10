import { useState, useEffect } from 'react';
import { NewsHeader } from '@/components/NewsHeader';
import { NewsGrid } from '@/components/NewsGrid';
import { ArticleModal } from '@/components/ArticleModal';
import { clusterArticles } from '@/lib/clustering';
import type { Cluster, SourceId, NewsApiResponse } from '@/types';

export function App() {
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
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <NewsHeader
        fetchedAt={fetchedAt}
        activeSource={activeSource}
        onSourceChange={setActiveSource}
      />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error ? (
          <div className="text-center text-destructive py-12 text-lg">{error}</div>
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

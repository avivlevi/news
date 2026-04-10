import { Skeleton } from '@/components/ui/skeleton';
import { ClusterCard } from './ClusterCard';
import { ArticleCard } from './ArticleCard';
import type { Cluster } from '@/types';

interface NewsGridProps {
  clusters: Cluster[];
  loading: boolean;
}

export function NewsGrid({ clusters, loading }: NewsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12 text-lg">
        לא נמצאו כתבות
      </div>
    );
  }

  const multiSource = clusters.filter(c => c.articles.length > 1);
  const singles = clusters.filter(c => c.articles.length === 1);

  return (
    <div className="flex flex-col gap-8">
      {multiSource.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-4 text-muted-foreground border-b border-border pb-2">
            נושאים מובילים
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {multiSource.map(cluster => (
              <ClusterCard key={cluster.id} cluster={cluster} />
            ))}
          </div>
        </section>
      )}

      {singles.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-4 text-muted-foreground border-b border-border pb-2">
            כתבות נוספות
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {singles.map(cluster => (
              <ArticleCard key={cluster.id} article={cluster.articles[0]} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

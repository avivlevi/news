import { BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SourceBadge } from './SourceBadge';
import type { Cluster } from '@/types';

interface ClusterCardProps {
  cluster: Cluster;
  onOpen: () => void;
}

export function ClusterCard({ cluster, onOpen }: ClusterCardProps) {
  const { articles, representativeTitle } = cluster;
  const primaryArticle = [...articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )[0];

  return (
    <Card
      className="overflow-hidden hover:shadow-md transition-shadow flex flex-col cursor-pointer"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpen(); }}
    >
      {primaryArticle.imageUrl && (
        <div className="aspect-video overflow-hidden">
          <img
            src={primaryArticle.imageUrl}
            alt={representativeTitle}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex flex-wrap gap-1.5">
          {articles.map(a => (
            <SourceBadge key={a.id} source={a.source} />
          ))}
        </div>

        <h2 className="font-bold text-base leading-snug line-clamp-3">
          {representativeTitle}
        </h2>

        {primaryArticle.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {primaryArticle.description}
          </p>
        )}

        <div className="mt-auto flex items-center gap-1.5 text-xs text-primary pt-2">
          <BookOpen size={13} />
          <span>קרא ביקורת השוואתית</span>
          <span className="text-muted-foreground">({articles.length} מקורות)</span>
        </div>
      </CardContent>
    </Card>
  );
}

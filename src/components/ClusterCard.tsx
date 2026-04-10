import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SourceBadge } from './SourceBadge';
import type { Cluster } from '@/types';

interface ClusterCardProps {
  cluster: Cluster;
}

export function ClusterCard({ cluster }: ClusterCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { articles, representativeTitle } = cluster;
  const primaryArticle = [...articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )[0];

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow flex flex-col">
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

        <a
          href={primaryArticle.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group"
        >
          <h2 className="font-bold text-base leading-snug group-hover:text-primary transition-colors line-clamp-3">
            {representativeTitle}
          </h2>
        </a>

        {primaryArticle.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {primaryArticle.description}
          </p>
        )}

        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors self-start cursor-pointer"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'הסתר מקורות' : `${articles.length} מקורות`}
        </button>

        {expanded && (
          <ul className="flex flex-col gap-2 border-t border-border pt-3">
            {articles.map(a => (
              <li key={a.id} className="flex items-start gap-2">
                <SourceBadge source={a.source} />
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs hover:text-primary transition-colors line-clamp-2 flex-1"
                >
                  {a.title}
                </a>
                <ExternalLink size={10} className="text-muted-foreground shrink-0 mt-0.5" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

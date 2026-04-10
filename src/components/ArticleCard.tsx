import { ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SourceBadge } from './SourceBadge';
import type { Article } from '@/types';

interface ArticleCardProps {
  article: Article;
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
      {article.imageUrl && (
        <div className="aspect-video overflow-hidden">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <CardContent className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <SourceBadge source={article.source} />
          <time className="text-xs text-muted-foreground shrink-0">
            {new Date(article.publishedAt).toLocaleTimeString('he-IL', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group"
        >
          <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-3">
            {article.title}
          </h3>
        </a>
        {article.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {article.description}
          </p>
        )}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors pt-2"
        >
          <ExternalLink size={12} />
          קרא עוד
        </a>
      </CardContent>
    </Card>
  );
}

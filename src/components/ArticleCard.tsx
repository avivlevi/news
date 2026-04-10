import { BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SourceBadge } from './SourceBadge';
import type { Article } from '@/types';

interface ArticleCardProps {
  article: Article;
  onOpen: () => void;
}

export function ArticleCard({ article, onOpen }: ArticleCardProps) {
  return (
    <Card
      className="overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col cursor-pointer"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpen(); }}
    >
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
        <h3 className="font-semibold text-sm leading-snug line-clamp-3">
          {article.title}
        </h3>
        {article.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {article.description}
          </p>
        )}
        <div className="mt-auto flex items-center gap-1 text-xs text-primary pt-2">
          <BookOpen size={12} />
          <span>קרא כתבה</span>
        </div>
      </CardContent>
    </Card>
  );
}

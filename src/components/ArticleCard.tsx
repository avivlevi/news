import { motion } from 'framer-motion';
import { SourceBadge, BiasBar, SOURCE_CONFIG } from './SourceBadge';
import type { Article } from '@/types';

interface ArticleCardProps {
  article: Article;
  onOpen: () => void;
}

export function ArticleCard({ article, onOpen }: ArticleCardProps) {
  const color = SOURCE_CONFIG[article.source].bg;
  const timeLabel = new Date(article.publishedAt).toLocaleTimeString('he-IL', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <motion.article
      onClick={onOpen}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="bg-card text-card-foreground rounded-2xl overflow-hidden cursor-pointer card-shadow flex flex-col"
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpen(); }}
    >
      {/* Source color stripe */}
      <div className="h-[4px] rounded-t-2xl" style={{ background: color }} />

      {/* Image */}
      {article.imageUrl && (
        <div className="relative aspect-[16/9] overflow-hidden">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-400"
            loading="lazy"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}

      {/* Body */}
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div className="flex items-center justify-between gap-2">
          <SourceBadge source={article.source} />
          <time className="text-xs text-muted-foreground tabular-nums shrink-0">{timeLabel}</time>
        </div>

        <h3 className="font-semibold text-sm leading-snug line-clamp-3 flex-1">
          {article.title}
        </h3>

        {article.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {article.description}
          </p>
        )}

        {/* Bias footer */}
        <div className="mt-auto pt-3 border-t border-border/60">
          <BiasBar source={article.source} />
        </div>
      </div>
    </motion.article>
  );
}

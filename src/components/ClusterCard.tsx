import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import { SourceBadge, SourceStrip } from './SourceBadge';
import type { Cluster } from '@/types';

interface ClusterCardProps {
  cluster: Cluster;
  onOpen: () => void;
  featured?: boolean;
}

export function ClusterCard({ cluster, onOpen, featured = false }: ClusterCardProps) {
  const { articles, representativeTitle } = cluster;
  const primary = [...articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )[0];

  const hasImage = !!primary.imageUrl;
  const timeLabel = new Date(primary.publishedAt).toLocaleTimeString('he-IL', {
    hour: '2-digit', minute: '2-digit',
  });

  if (featured && hasImage) {
    /* ── Full-bleed hero card ──────────────────────────────── */
    return (
      <motion.article
        onClick={onOpen}
        whileHover={{ scale: 1.005 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative rounded-2xl overflow-hidden cursor-pointer group"
        style={{ minHeight: 400 }}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpen(); }}
      >
        {/* Background image */}
        <img
          src={primary.imageUrl!}
          alt={representativeTitle}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="eager"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

        {/* Source spectrum bar — top */}
        <div className="spectrum-bar absolute top-0 inset-x-0 z-10 rounded-t-2xl h-[5px]">
          {articles.map(a => <SourceStrip key={a.id} source={a.source} />)}
        </div>

        {/* Content — bottom */}
        <div className="absolute bottom-0 inset-x-0 p-6 z-10">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {articles.map(a => <SourceBadge key={a.id} source={a.source} />)}
          </div>
          <h2 className="text-white font-bold text-xl sm:text-2xl leading-snug mb-3 line-clamp-3">
            {representativeTitle}
          </h2>
          {primary.description && (
            <p className="text-white/70 text-sm line-clamp-2 mb-4">
              {primary.description}
            </p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-white/60 text-xs">
              <Layers size={13} />
              <span>{articles.length} מקורות</span>
              <span className="mx-1 opacity-40">·</span>
              <span>{timeLabel}</span>
            </div>
            <span className="text-white/80 text-xs font-medium bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20">
              קרא ביקורת השוואתית ←
            </span>
          </div>
        </div>
      </motion.article>
    );
  }

  /* ── Standard cluster card ──────────────────────────────────── */
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
      {/* Source spectrum bar — very top */}
      <div className="spectrum-bar h-[4px] rounded-t-2xl flex">
        {articles.map(a => <SourceStrip key={a.id} source={a.source} />)}
      </div>

      {/* Image */}
      {hasImage && (
        <div className="relative aspect-[16/9] overflow-hidden">
          <img
            src={primary.imageUrl!}
            alt={representativeTitle}
            className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-105"
            loading="lazy"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}

      {/* Body */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex flex-wrap gap-1.5">
          {articles.map(a => <SourceBadge key={a.id} source={a.source} />)}
        </div>

        <h2 className="font-bold text-base leading-snug line-clamp-3">
          {representativeTitle}
        </h2>

        {primary.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
            {primary.description}
          </p>
        )}

        <div className="flex items-center justify-between pt-1 mt-auto border-t border-border/60">
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <Layers size={12} />
            <span>{articles.length} מקורות</span>
          </div>
          <span className="text-xs text-primary font-medium">{timeLabel}</span>
        </div>
      </div>
    </motion.article>
  );
}

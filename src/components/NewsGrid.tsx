import { motion } from 'framer-motion';
import { ClusterCard } from './ClusterCard';
import { ArticleCard } from './ArticleCard';
import type { Cluster } from '@/types';

/* ── Skeleton ──────────────────────────────────────────────────── */
function SkeletonCard({ tall = false }: { tall?: boolean }) {
  return (
    <div className={`bg-card rounded-2xl overflow-hidden animate-pulse ${tall ? 'row-span-2' : ''}`}>
      <div className="h-[4px] bg-border" />
      <div className="bg-muted" style={{ height: tall ? 280 : 160 }} />
      <div className="p-5 flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="h-5 w-14 rounded-full bg-muted" />
          <div className="h-5 w-14 rounded-full bg-muted" />
        </div>
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-full" />
      </div>
    </div>
  );
}

/* ── Section label ─────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="text-sm font-semibold text-muted-foreground tracking-wider uppercase">
        {children}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

/* ── Animation variants ────────────────────────────────────────── */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] } },
};

/* ── Main grid ─────────────────────────────────────────────────── */
interface NewsGridProps {
  clusters: Cluster[];
  loading: boolean;
  onOpenCluster: (cluster: Cluster) => void;
}

export function NewsGrid({ clusters, loading, onOpenCluster }: NewsGridProps) {
  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex flex-col gap-10">
        <div>
          <SectionLabel>נושאים מובילים</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="sm:col-span-2 lg:col-span-2">
              <SkeletonCard tall />
            </div>
            <SkeletonCard />
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
        <div>
          <SectionLabel>כתבות נוספות</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-20 text-base">
        לא נמצאו כתבות
      </div>
    );
  }

  const multiSource = clusters.filter(c => new Set(c.articles.map(a => a.source)).size > 1);
  const singles     = clusters.filter(c => new Set(c.articles.map(a => a.source)).size === 1);

  return (
    <div className="flex flex-col gap-12">
      {/* ── Multi-source clusters ── */}
      {multiSource.length > 0 && (
        <section>
          <SectionLabel>נושאים מובילים</SectionLabel>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {multiSource.map((cluster, idx) => (
              <motion.div
                key={cluster.id}
                variants={item}
                className={
                  idx === 0
                    ? 'sm:col-span-2 lg:col-span-2'
                    : ''
                }
              >
                <ClusterCard
                  cluster={cluster}
                  onOpen={() => onOpenCluster(cluster)}
                  featured={idx === 0}
                />
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* ── Single-source articles ── */}
      {singles.length > 0 && (
        <section>
          <SectionLabel>כתבות נוספות</SectionLabel>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {singles.map(cluster => (
              <motion.div key={cluster.id} variants={item}>
                <ArticleCard
                  article={cluster.articles[0]}
                  onOpen={() => onOpenCluster(cluster)}
                />
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, Sparkles, ExternalLink } from 'lucide-react';
import { SourceBadge, SourceStrip, SOURCE_CONFIG } from './SourceBadge';
import type { Cluster, ArticleContent, ComparisonState, BiasScore } from '@/types';

interface ArticleResponse {
  paragraphs?: string[];
  title?: string;
  author?: string;
  publishedDate?: string;
  error?: string;
}

interface CompareResponse {
  comparison?: string;
  biasScores?: BiasScore[];
  error?: string;
}

interface ArticleModalProps {
  cluster: Cluster | null;
  onClose: () => void;
}

export function ArticleModal({ cluster, onClose }: ArticleModalProps) {
  const [contents, setContents] = useState<Record<string, ArticleContent>>({});
  const [comparison, setComparison] = useState<ComparisonState>({ status: 'idle' });
  const [activeTab, setActiveTab] = useState<string>('');

  /* reset on cluster change */
  useEffect(() => {
    if (!cluster) return;
    setContents({});
    setComparison({ status: 'idle' });
    setActiveTab(cluster.articles[0]?.id ?? '');
  }, [cluster?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* fetch all articles in parallel */
  useEffect(() => {
    if (!cluster) return;
    cluster.articles.forEach(article => {
      setContents(prev => ({ ...prev, [article.id]: { status: 'loading', paragraphs: [] } }));
      fetch(`/api/article?url=${encodeURIComponent(article.url)}`)
        .then(r => r.json() as Promise<ArticleResponse>)
        .then(data =>
          setContents(prev => ({
            ...prev,
            [article.id]: {
              status: data.paragraphs && data.paragraphs.length > 0 ? 'success' : 'error',
              paragraphs: data.paragraphs ?? [],
              title: data.title,
              author: data.author,
              error: data.error,
            },
          }))
        )
        .catch(() =>
          setContents(prev => ({
            ...prev,
            [article.id]: { status: 'error', paragraphs: [] },
          }))
        );
    });
  }, [cluster?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* run comparison once all settled */
  const runComparison = useCallback(
    (settled: Record<string, ArticleContent>) => {
      if (!cluster || cluster.articles.length < 2) return;
      if (comparison.status !== 'idle') return;
      const allDone = cluster.articles.every(a => {
        const c = settled[a.id];
        return c && c.status !== 'loading' && c.status !== 'idle';
      });
      if (!allDone) return;

      const articlesForCompare = cluster.articles.map(a => ({
        source: a.source,
        title: a.title,
        paragraphs:
          settled[a.id]?.status === 'success' && settled[a.id].paragraphs.length > 0
            ? settled[a.id].paragraphs
            : [a.description],
      }));

      setComparison({ status: 'loading' });
      fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: articlesForCompare }),
      })
        .then(r => r.json() as Promise<CompareResponse>)
        .then(data =>
          setComparison({
            status: data.comparison ? 'success' : 'error',
            text: data.comparison,
            biasScores: data.biasScores,
          })
        )
        .catch(() => setComparison({ status: 'error' }));
    },
    [cluster, comparison.status]
  );

  useEffect(() => { runComparison(contents); }, [contents, runComparison]);

  /* lock body scroll when open */
  useEffect(() => {
    if (cluster) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [cluster]);

  /* close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (cluster) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cluster, onClose]);

  const isMulti = cluster ? new Set(cluster.articles.map(a => a.source)).size > 1 : false;

  return (
    <AnimatePresence>
      {cluster && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 pointer-events-none"
          >
            <div
              className="pointer-events-auto bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
              dir="rtl"
              onClick={e => e.stopPropagation()}
            >
              {/* Spectrum bar + Header — sticky */}
              <div className="shrink-0">
                <div className="spectrum-bar h-[5px] rounded-t-2xl flex">
                  {cluster.articles.map(a => <SourceStrip key={a.id} source={a.source} />)}
                </div>
                <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {cluster.articles.map(a => <SourceBadge key={a.id} source={a.source} />)}
                    </div>
                    <h2 className="text-lg font-bold leading-snug">
                      {cluster.representativeTitle}
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-1"
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto">

                {/* AI comparison — only for multi-source */}
                {isMulti && (
                  <div className="px-6 py-5 border-b border-border bg-amber-500/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={15} className="text-amber-500" />
                      <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">ניתוח השוואתי</span>
                    </div>

                    {(comparison.status === 'idle' || comparison.status === 'loading') && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 size={14} className="animate-spin shrink-0" />
                        <span>
                          {comparison.status === 'idle'
                            ? 'טוען כתבות לניתוח...'
                            : 'מנתח את ההבדלים בין המקורות...'}
                        </span>
                      </div>
                    )}

                    {comparison.status === 'success' && comparison.text && (
                      <>
                        <div className="text-sm leading-[1.75] whitespace-pre-line text-foreground/90">
                          {comparison.text}
                        </div>
                        {comparison.biasScores && comparison.biasScores.length > 0 && (
                          <BiasScorePanel scores={comparison.biasScores} />
                        )}
                      </>
                    )}

                    {comparison.status === 'error' && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertCircle size={14} />
                        <span>לא הצלחנו לנתח את ההבדלים</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Source tabs (multi) or single article */}
                {isMulti ? (
                  <>
                    {/* Tab strip — sticky within scroll */}
                    <div className="sticky top-0 z-10 bg-card flex gap-1 px-6 pt-3 pb-0 border-b border-border overflow-x-auto">
                      {cluster.articles.map(a => {
                        const active = activeTab === a.id;
                        const color = SOURCE_CONFIG[a.source].bg;
                        return (
                          <button
                            key={a.id}
                            onClick={() => setActiveTab(a.id)}
                            className="relative shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors"
                            style={active ? { color } : { color: 'var(--muted-foreground)' }}
                          >
                            {SOURCE_CONFIG[a.source].label}
                            {active && (
                              <motion.div
                                layoutId="tab-underline"
                                className="absolute bottom-0 inset-x-0 h-[2.5px] rounded-full"
                                style={{ background: color }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {cluster.articles.map(a => (
                      <div key={a.id} className={activeTab === a.id ? 'block' : 'hidden'}>
                        <ArticleBody
                          content={contents[a.id]}
                          fallback={a.description}
                          url={a.url}
                        />
                      </div>
                    ))}
                  </>
                ) : (
                  <ArticleBody
                    content={contents[cluster.articles[0]?.id]}
                    fallback={cluster.articles[0]?.description}
                    url={cluster.articles[0]?.url}
                  />
                )}

              </div>{/* end scrollable body */}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Bias score panel ────────────────────────────────────────────── */
function biasColor(score: number): string {
  if (score <= 2) return '#ef4444';
  if (score <= 4) return '#f97316';
  if (score <= 6) return '#eab308';
  if (score <= 8) return '#84cc16';
  return '#22c55e';
}

function biasLabel(score: number): string {
  if (score <= 2) return 'נגד חזק';
  if (score <= 4) return 'נגד';
  if (score <= 6) return 'ניטרלי';
  if (score <= 8) return 'בעד';
  return 'בעד חזק';
}

function BiasScorePanel({ scores }: { scores: BiasScore[] }) {
  return (
    <div className="mt-5 pt-4 border-t border-border/60">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">עמדה לגבי הממשלה</span>
      </div>

      <div className="space-y-4">
        {scores.map(item => {
          const color = biasColor(item.score);
          const pct = ((item.score - 1) / 9) * 100;
          const cfg = SOURCE_CONFIG[item.source as keyof typeof SOURCE_CONFIG];
          const label = cfg?.label ?? item.source;
          const sourceBg = cfg?.bg ?? '#888';

          return (
            <div key={item.source}>
              {/* Source name + score badge */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: sourceBg }}
                  >
                    {cfg && (
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${cfg.domain}&sz=32`}
                        alt=""
                        width={11}
                        height={11}
                        className="rounded-sm"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    {label}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.brief}</span>
                </div>
                <span
                  className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: color + '22', color }}
                >
                  {item.score}/10 · {biasLabel(item.score)}
                </span>
              </div>

              {/* Bar track */}
              <div className="relative h-2 rounded-full bg-muted overflow-hidden" dir="ltr">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-2" dir="ltr">
        <span className="text-[10px] text-muted-foreground">① נגד הממשלה</span>
        <span className="text-[10px] text-muted-foreground">בעד הממשלה ⑩</span>
      </div>
    </div>
  );
}

/* ── Article body ────────────────────────────────────────────────── */
interface ArticleBodyProps {
  content: ArticleContent | undefined;
  fallback: string;
  url: string;
}

function ArticleBody({ content, fallback, url }: ArticleBodyProps) {
  if (!content || content.status === 'loading' || content.status === 'idle') {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 size={24} className="animate-spin" />
        <span className="text-sm">טוען כתבה...</span>
      </div>
    );
  }

  return (
    <div className="px-6 py-5 article-body" dir="rtl">
      {content.author && (
        <p className="text-xs text-muted-foreground mb-4 font-medium">{content.author}</p>
      )}

      {content.status === 'error' || content.paragraphs.length === 0 ? (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 p-3 bg-muted/60 rounded-xl">
            <AlertCircle size={14} className="shrink-0" />
            <span>לא הצלחנו לטעון את הכתבה המלאה</span>
          </div>
          {fallback && <p className="text-sm text-foreground/80 leading-relaxed mb-4">{fallback}</p>}
        </>
      ) : (
        content.paragraphs.map((p, i) => (
          <p
            key={i}
            className="text-[15px] leading-[1.8] text-foreground/90 mb-4 last:mb-0"
          >
            {p}
          </p>
        ))
      )}

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 rounded-xl px-4 py-2 mt-4 transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <ExternalLink size={13} />
        קרא באתר המקור
      </a>
    </div>
  );
}

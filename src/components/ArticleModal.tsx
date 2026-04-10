import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, Sparkles, ExternalLink } from 'lucide-react';
import { SourceBadge, SourceStrip, SOURCE_CONFIG } from './SourceBadge';
import type { Cluster, ArticleContent, ComparisonState } from '@/types';

interface ArticleResponse {
  paragraphs?: string[];
  title?: string;
  author?: string;
  publishedDate?: string;
  error?: string;
}

interface CompareResponse {
  comparison?: string;
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
          setComparison({ status: data.comparison ? 'success' : 'error', text: data.comparison })
        )
        .catch(() => setComparison({ status: 'error' }));
    },
    [cluster, comparison.status]
  );

  useEffect(() => { runComparison(contents); }, [contents, runComparison]);

  /* close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (cluster) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cluster, onClose]);

  const isMulti = cluster ? cluster.articles.length > 1 : false;

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
              {/* Source spectrum bar */}
              <div className="spectrum-bar h-[5px] rounded-t-2xl flex shrink-0">
                {cluster.articles.map(a => <SourceStrip key={a.id} source={a.source} />)}
              </div>

              {/* Header */}
              <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-border shrink-0">
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

              {/* AI comparison — only for multi-source */}
              {isMulti && (
                <div className="px-6 py-4 border-b border-border bg-muted/50 shrink-0">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Sparkles size={15} className="text-amber-500" />
                    <span className="text-sm font-semibold">ניתוח השוואתי</span>
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
                    <div className="text-sm leading-relaxed whitespace-pre-line text-foreground/85 max-h-48 overflow-y-auto">
                      {comparison.text}
                    </div>
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
                <div className="flex flex-col flex-1 min-h-0">
                  {/* Tab strip */}
                  <div className="flex gap-1 px-6 pt-3 pb-0 shrink-0 border-b border-border overflow-x-auto">
                    {cluster.articles.map(a => {
                      const active = activeTab === a.id;
                      const color = SOURCE_CONFIG[a.source].bg;
                      return (
                        <button
                          key={a.id}
                          onClick={() => setActiveTab(a.id)}
                          className="relative shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors"
                          style={
                            active
                              ? { color }
                              : { color: 'var(--muted-foreground)' }
                          }
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

                  {/* Article content */}
                  {cluster.articles.map(a => (
                    <div
                      key={a.id}
                      className={`flex-1 min-h-0 overflow-y-auto ${activeTab === a.id ? 'block' : 'hidden'}`}
                    >
                      <ArticleBody
                        content={contents[a.id]}
                        fallback={a.description}
                        url={a.url}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <ArticleBody
                    content={contents[cluster.articles[0]?.id]}
                    fallback={cluster.articles[0]?.description}
                    url={cluster.articles[0]?.url}
                  />
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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

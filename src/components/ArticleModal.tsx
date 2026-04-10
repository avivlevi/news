import { useEffect, useState, useCallback } from 'react';
import { X, Loader2, AlertCircle, Brain } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SourceBadge } from './SourceBadge';
import type { Cluster, ArticleContent, ComparisonState } from '@/types';

interface ArticleModalProps {
  cluster: Cluster | null;
  onClose: () => void;
}

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

export function ArticleModal({ cluster, onClose }: ArticleModalProps) {
  const [contents, setContents] = useState<Record<string, ArticleContent>>({});
  const [comparison, setComparison] = useState<ComparisonState>({ status: 'idle' });
  const [activeTab, setActiveTab] = useState<string>('');

  // Reset state when cluster changes
  useEffect(() => {
    if (!cluster) return;
    setContents({});
    setComparison({ status: 'idle' });
    setActiveTab(cluster.articles[0]?.id ?? '');
  }, [cluster?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch ALL articles in parallel on open
  useEffect(() => {
    if (!cluster) return;

    cluster.articles.forEach(article => {
      setContents(prev => ({
        ...prev,
        [article.id]: { status: 'loading', paragraphs: [] },
      }));

      fetch(`/api/article?url=${encodeURIComponent(article.url)}`)
        .then(r => r.json() as Promise<ArticleResponse>)
        .then(data => {
          setContents(prev => ({
            ...prev,
            [article.id]: {
              status: data.paragraphs && data.paragraphs.length > 0 ? 'success' : 'error',
              paragraphs: data.paragraphs ?? [],
              title: data.title,
              author: data.author,
              error: data.error,
            },
          }));
        })
        .catch(err => {
          setContents(prev => ({
            ...prev,
            [article.id]: {
              status: 'error',
              paragraphs: [],
              error: String(err),
            },
          }));
        });
    });
  }, [cluster?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Run comparison once all articles have settled (and we have 2+ sources)
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
        .then(data => {
          setComparison({
            status: data.comparison ? 'success' : 'error',
            text: data.comparison,
          });
        })
        .catch(() => setComparison({ status: 'error' }));
    },
    [cluster, comparison.status]
  );

  useEffect(() => {
    runComparison(contents);
  }, [contents, runComparison]);

  if (!cluster) return null;

  const isMultiSource = cluster.articles.length > 1;

  return (
    <Dialog open={!!cluster} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-3xl w-full h-[90vh] p-0 flex flex-col gap-0 overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex flex-wrap gap-1.5">
              {cluster.articles.map(a => (
                <SourceBadge key={a.id} source={a.source} />
              ))}
            </div>
            <h2 className="text-lg font-bold leading-snug">
              {cluster.representativeTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* AI comparison panel — only for multi-source clusters */}
        {isMultiSource && (
          <div className="px-6 py-4 border-b border-border bg-muted/40 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Brain size={16} className="text-primary" />
              <span className="text-sm font-semibold">ניתוח השוואתי</span>
            </div>
            {comparison.status === 'loading' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                <span>מנתח את ההבדלים בין המקורות...</span>
              </div>
            )}
            {comparison.status === 'success' && comparison.text && (
              <div className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
                {comparison.text}
              </div>
            )}
            {comparison.status === 'error' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle size={14} />
                <span>לא הצלחנו לנתח את ההבדלים</span>
              </div>
            )}
            {comparison.status === 'idle' && (
              <div className="text-sm text-muted-foreground">טוען כתבות...</div>
            )}
          </div>
        )}

        {/* Article content */}
        {isMultiSource ? (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 min-h-0"
          >
            <TabsList className="mx-6 mt-3 mb-0 shrink-0 self-start">
              {cluster.articles.map(a => (
                <TabsTrigger key={a.id} value={a.id}>
                  <SourceBadge source={a.source} />
                </TabsTrigger>
              ))}
            </TabsList>
            {cluster.articles.map(a => (
              <TabsContent
                key={a.id}
                value={a.id}
                className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col"
              >
                <ArticleContentView
                  content={contents[a.id]}
                  fallbackDescription={a.description}
                  sourceUrl={a.url}
                  sourceName={a.source}
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <ArticleContentView
            content={contents[cluster.articles[0]?.id]}
            fallbackDescription={cluster.articles[0]?.description}
            sourceUrl={cluster.articles[0]?.url}
            sourceName={cluster.articles[0]?.source}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Article content renderer ────────────────────────────────────────────────

interface ArticleContentViewProps {
  content: ArticleContent | undefined;
  fallbackDescription: string;
  sourceUrl: string;
  sourceName: string;
}

function ArticleContentView({
  content,
  fallbackDescription,
  sourceUrl,
  sourceName: _sourceName,
}: ArticleContentViewProps) {
  if (!content || content.status === 'loading' || content.status === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 size={28} className="animate-spin" />
          <span className="text-sm">טוען כתבה...</span>
        </div>
      </div>
    );
  }

  if (content.status === 'error' || content.paragraphs.length === 0) {
    return (
      <ScrollArea className="flex-1">
        <div className="px-6 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <AlertCircle size={14} />
            <span>לא הצלחנו לטעון את הכתבה המלאה</span>
          </div>
          {fallbackDescription && (
            <p className="text-sm text-foreground/80 leading-relaxed">{fallbackDescription}</p>
          )}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline mt-2 inline-flex items-center gap-1"
          >
            קרא את הכתבה המלאה באתר המקור ←
          </a>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="px-6 py-4 flex flex-col gap-3" dir="rtl">
        {content.author && (
          <p className="text-xs text-muted-foreground">{content.author}</p>
        )}
        {content.paragraphs.map((p, i) => (
          <p
            key={i}
            className={
              p.startsWith('•')
                ? 'text-sm leading-relaxed text-foreground/90 pr-2'
                : 'text-sm leading-relaxed text-foreground/90'
            }
          >
            {p}
          </p>
        ))}
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline mt-4 inline-flex items-center gap-1 border-t border-border pt-4"
        >
          קרא את הכתבה המלאה באתר המקור ←
        </a>
      </div>
    </ScrollArea>
  );
}

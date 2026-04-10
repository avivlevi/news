import { Newspaper, AlertCircle } from 'lucide-react';
import type { SummaryState } from '@/types';

interface NewsSummaryProps {
  state: SummaryState;
}

export function NewsSummary({ state }: NewsSummaryProps) {
  return (
    <div className="mb-10 rounded-2xl border border-border bg-card overflow-hidden">
      {/* Top accent bar */}
      <div className="h-[3px] bg-gradient-to-l from-amber-400 via-orange-500 to-red-500" />

      <div className="px-6 py-5">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper size={15} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
            תמצית יומית
          </span>
        </div>

        {/* Loading skeleton */}
        {(state.status === 'idle' || state.status === 'loading') && (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-5/6" />
            <div className="h-4 bg-muted rounded w-4/6" />
            <div className="flex gap-2 pt-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-6 w-16 bg-muted rounded-full" />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {state.status === 'error' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle size={14} />
            <span>לא הצלחנו לייצר תמצית</span>
          </div>
        )}

        {/* Content */}
        {state.status === 'success' && (
          <>
            {state.summary && (
              <p className="text-[15px] leading-[1.8] text-foreground/90 mb-4">
                {state.summary}
              </p>
            )}

            {state.topics && state.topics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {state.topics.map(topic => (
                  <span
                    key={topic}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

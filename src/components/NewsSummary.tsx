import { Newspaper, AlertCircle } from 'lucide-react';
import type { SummaryState } from '@/types';

interface NewsSummaryProps {
  state: SummaryState;
}

export function NewsSummary({ state }: NewsSummaryProps) {
  return (
    <div className="mb-10 rounded-2xl border border-border bg-card overflow-hidden">
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
          <div className="animate-pulse space-y-2.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-muted" />
                <div className="h-4 bg-muted rounded flex-1" style={{ width: `${75 + (i % 3) * 10}%` }} />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
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
            {Array.isArray(state.points) && state.points.length > 0 && (
              <ul className="space-y-2.5 mb-4">
                {state.points.map((point, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-[7px] shrink-0 w-1.5 h-1.5 rounded-full bg-orange-500" />
                    <span className="text-[14px] leading-[1.75] text-foreground/90">{point}</span>
                  </li>
                ))}
              </ul>
            )}

            {Array.isArray(state.topics) && state.topics.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
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

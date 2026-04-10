import { Moon, Sun, Rss } from 'lucide-react';
import type { SourceId } from '@/types';

const SOURCE_FILTERS: { id: SourceId | 'all'; label: string }[] = [
  { id: 'all',         label: 'הכל' },
  { id: 'ynet',        label: 'ynet' },
  { id: 'walla',       label: 'וואלה' },
  { id: 'n12',         label: 'N12' },
  { id: 'israelhayom', label: 'ישראל היום' },
  { id: 'maariv',      label: 'מעריב' },
  { id: 'c14',         label: 'ערוץ 14' },
  { id: 'globes',      label: 'גלובס' },
  { id: 'haaretz',     label: 'הארץ' },
];

const SOURCE_COLORS: Record<SourceId, string> = {
  ynet:        '#e0001a',
  walla:       '#e8003d',
  n12:         '#007aaa',
  israelhayom: '#1a4fa0',
  maariv:      '#0d2f6e',
  c14:         '#f97316',
  globes:      '#0057a8',
  haaretz:     '#006b77',
};

function hebrewDate() {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

interface NewsHeaderProps {
  fetchedAt: string | null;
  activeSource: SourceId | 'all';
  onSourceChange: (source: SourceId | 'all') => void;
  dark: boolean;
  onToggleDark: () => void;
}

export function NewsHeader({
  fetchedAt,
  activeSource,
  onSourceChange,
  dark,
  onToggleDark,
}: NewsHeaderProps) {
  const timeLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
      {/* Masthead row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between py-3 border-b border-border/50">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
              <Rss size={16} className="text-background" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none tracking-tight">חדשות</h1>
              <p className="text-[11px] text-muted-foreground leading-none mt-0.5 tracking-wide">
                כל המקורות, מקום אחד
              </p>
            </div>
          </div>

          {/* Right: date + live + dark toggle */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-muted-foreground">
              {hebrewDate()}
            </span>

            {timeLabel && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="live-dot w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                {timeLabel}
              </div>
            )}

            <button
              onClick={onToggleDark}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={dark ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* Source filter pills */}
        <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto no-scrollbar">
          {SOURCE_FILTERS.map(s => {
            const active = activeSource === s.id;
            const color = s.id !== 'all' ? SOURCE_COLORS[s.id as SourceId] : undefined;
            return (
              <button
                key={s.id}
                onClick={() => onSourceChange(s.id)}
                className="shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
                style={
                  active && color
                    ? { background: color, color: '#fff', border: `1.5px solid ${color}` }
                    : active
                    ? {
                        background: 'var(--foreground)',
                        color: 'var(--background)',
                        border: '1.5px solid var(--foreground)',
                      }
                    : {
                        background: 'transparent',
                        color: 'var(--muted-foreground)',
                        border: '1.5px solid var(--border)',
                      }
                }
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

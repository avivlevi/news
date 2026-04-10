import { RefreshCw } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SourceId } from '@/types';

const SOURCES: { id: SourceId | 'all'; label: string }[] = [
  { id: 'all',         label: 'הכל' },
  { id: 'ynet',        label: 'ynet' },
  { id: 'n12',         label: 'N12' },
  { id: 'israelhayom', label: 'ישראל היום' },
  { id: 'c14',         label: 'ערוץ 14' },
];

interface NewsHeaderProps {
  fetchedAt: string | null;
  activeSource: SourceId | 'all';
  onSourceChange: (source: SourceId | 'all') => void;
}

export function NewsHeader({ fetchedAt, activeSource, onSourceChange }: NewsHeaderProps) {
  const timeLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <header className="sticky top-0 z-10 bg-background border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">חדשות</h1>
        {timeLabel && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <RefreshCw size={12} />
            עודכן ב-{timeLabel}
          </span>
        )}
      </div>
      <div className="max-w-7xl mx-auto px-4 pb-2 overflow-x-auto">
        <Tabs value={activeSource} onValueChange={v => onSourceChange(v as SourceId | 'all')}>
          <TabsList className="flex-nowrap">
            {SOURCES.map(s => (
              <TabsTrigger key={s.id} value={s.id}>{s.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </header>
  );
}

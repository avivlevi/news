import type { SourceId } from '@/types';

const SOURCE_CONFIG: Record<SourceId, { label: string; color: string; bg: string }> = {
  ynet:        { label: 'ynet',        color: '#ffffff', bg: '#e0001a' },
  n12:         { label: 'N12',         color: '#ffffff', bg: '#008080' },
  israelhayom: { label: 'ישראל היום',  color: '#ffffff', bg: '#1a4fa0' },
  c14:         { label: 'ערוץ 14',     color: '#ffffff', bg: '#f97316' },
};

interface SourceBadgeProps {
  source: SourceId;
  className?: string;
}

export function SourceBadge({ source, className = '' }: SourceBadgeProps) {
  const cfg = SOURCE_CONFIG[source];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 ${className}`}
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

export { SOURCE_CONFIG };

import type { SourceId } from '@/types';

export const SOURCE_CONFIG: Record<SourceId, { label: string; color: string; bg: string }> = {
  ynet:        { label: 'ynet',        color: '#ffffff', bg: '#e0001a' },
  n12:         { label: 'N12',         color: '#ffffff', bg: '#008080' },
  israelhayom: { label: 'ישראל היום',  color: '#ffffff', bg: '#1a4fa0' },
  c14:         { label: 'ערוץ 14',     color: '#ffffff', bg: '#f97316' },
};

interface SourceBadgeProps {
  source: SourceId;
  size?: 'sm' | 'md';
  className?: string;
}

export function SourceBadge({ source, size = 'sm', className = '' }: SourceBadgeProps) {
  const cfg = SOURCE_CONFIG[source];
  const sizeClass = size === 'md'
    ? 'px-3 py-1 text-sm font-semibold'
    : 'px-2 py-0.5 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center rounded-full shrink-0 tracking-wide ${sizeClass} ${className}`}
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

/** Thin colored strip — used in the spectrum bar */
export function SourceStrip({ source }: { source: SourceId }) {
  return (
    <div
      className="flex-1 h-full"
      style={{ background: SOURCE_CONFIG[source].bg }}
      title={SOURCE_CONFIG[source].label}
    />
  );
}

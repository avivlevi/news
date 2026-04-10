import type { SourceId } from '@/types';

export const SOURCE_CONFIG: Record<SourceId, { label: string; color: string; bg: string; domain: string }> = {
  ynet:        { label: 'ynet',        color: '#ffffff', bg: '#e0001a', domain: 'ynet.co.il' },
  walla:       { label: 'וואלה',       color: '#ffffff', bg: '#e8003d', domain: 'walla.co.il' },
  n12:         { label: 'N12',         color: '#ffffff', bg: '#007aaa', domain: 'n12.co.il' },
  israelhayom: { label: 'ישראל היום',  color: '#ffffff', bg: '#1a4fa0', domain: 'israelhayom.co.il' },
  maariv:      { label: 'מעריב',       color: '#ffffff', bg: '#0d2f6e', domain: 'maariv.co.il' },
  c14:         { label: 'ערוץ 14',     color: '#ffffff', bg: '#f97316', domain: 'c14.co.il' },
  globes:      { label: 'גלובס',       color: '#ffffff', bg: '#0057a8', domain: 'globes.co.il' },
  haaretz:     { label: 'הארץ',        color: '#ffffff', bg: '#006b77', domain: 'haaretz.co.il' },
};

function faviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

interface SourceBadgeProps {
  source: SourceId;
  size?: 'sm' | 'md';
  className?: string;
}

export function SourceBadge({ source, size = 'sm', className = '' }: SourceBadgeProps) {
  const cfg = SOURCE_CONFIG[source];
  const sizeClass = size === 'md'
    ? 'px-2.5 py-1 text-sm font-semibold gap-1.5'
    : 'px-2 py-0.5 text-xs font-semibold gap-1';
  const iconSize = size === 'md' ? 14 : 12;

  return (
    <span
      className={`inline-flex items-center rounded-full shrink-0 tracking-wide ${sizeClass} ${className}`}
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <img
        src={faviconUrl(cfg.domain)}
        alt=""
        width={iconSize}
        height={iconSize}
        className="rounded-sm shrink-0"
        style={{ imageRendering: 'auto' }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
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

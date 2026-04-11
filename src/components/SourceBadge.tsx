import type { SourceId } from '@/types';

/**
 * Static political bias score per source: 1 = strongly anti-government, 10 = strongly pro-government.
 * Based on well-established Israeli media editorial positions.
 */
export const SOURCE_BIAS: Record<SourceId, number> = {
  haaretz:     2,  // strongly left / anti-government
  ynet:        4,  // center-left, often critical
  walla:       4,  // center, somewhat critical
  n12:         5,  // center / balanced
  globes:      5,  // business-focused / neutral
  maariv:      6,  // center-right
  israelhayom: 9,  // strongly pro-Netanyahu (Adelson-founded)
  c14:         9,  // right-wing / strongly pro-government
};

export function biasBarColor(score: number): string {
  if (score <= 2) return '#ef4444';
  if (score <= 4) return '#f97316';
  if (score <= 6) return '#eab308';
  if (score <= 8) return '#84cc16';
  return '#22c55e';
}

/** Horizontal bar showing political bias for one source. */
export function BiasBar({ source, score: scoreProp }: { source: SourceId; score?: number }) {
  const score = scoreProp ?? SOURCE_BIAS[source];
  const pct = ((score - 1) / 9) * 100;
  const color = biasBarColor(score);

  return (
    <div className="w-full" dir="ltr">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-muted-foreground">נגד</span>
        <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{score}/10</span>
        <span className="text-[10px] text-muted-foreground">בעד</span>
      </div>
      <div className="relative h-1.5 rounded-full overflow-hidden bg-muted">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/** Stacked bias bars for multiple sources in a cluster. */
export function ClusterBiasBar({ sources, sourceScores = {} }: { sources: SourceId[]; sourceScores?: Partial<Record<SourceId, number>> }) {
  return (
    <div className="w-full space-y-1.5" dir="ltr">
      {sources.map(source => {
        const score = sourceScores[source] ?? SOURCE_BIAS[source];
        const pct = ((score - 1) / 9) * 100;
        const color = biasBarColor(score);
        const cfg = SOURCE_CONFIG[source];
        return (
          <div key={source} className="flex items-center gap-2">
            <span
              className="text-[10px] font-semibold shrink-0 w-14 text-right truncate"
              style={{ color: cfg.bg }}
            >
              {cfg.label}
            </span>
            <div className="relative flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-[10px] font-bold tabular-nums shrink-0 w-6" style={{ color }}>
              {score}
            </span>
          </div>
        );
      })}
      <div className="flex justify-between pt-0.5">
        <span className="text-[9px] text-muted-foreground/60">נגד הממשלה</span>
        <span className="text-[9px] text-muted-foreground/60">בעד הממשלה</span>
      </div>
    </div>
  );
}

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

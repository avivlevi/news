import type { SourceId } from '@/types';

export interface SourceMeta {
  name: string;
  color: string;
  logo: string;
}

/**
 * Brand marks and colours only. This site makes no claim about any outlet's
 * politics — the comparison is built from what each one printed.
 */
export const SOURCE_META: Record<SourceId, SourceMeta> = {
  c14:         { name: 'ערוץ 14',    color: '#f5a300', logo: '/logos/c14.png' },
  ynet:        { name: 'ynet',       color: '#d8232a', logo: '/logos/ynet.ico' },
  n12:         { name: 'N12',        color: '#0a6ed1', logo: '/logos/n12.ico' },
  i24:         { name: 'i24NEWS',    color: '#e31e24', logo: '/logos/i24.png' },
  t13:         { name: 'חדשות 13',  color: '#c8102e', logo: '/logos/t13.png' },
  haaretz:     { name: 'הארץ',       color: '#00539b', logo: '/logos/haaretz.png' },
};

export const ALL_SOURCES = Object.keys(SOURCE_META) as SourceId[];
export const TOTAL_SOURCES = ALL_SOURCES.length;

export const meta = (id: SourceId) => SOURCE_META[id];
export const sourceName = (id: SourceId) => SOURCE_META[id]?.name ?? id;
export const sourceColor = (id: SourceId) => SOURCE_META[id]?.color ?? '#888';

/** Fixed alphabetical, so position carries no meaning. */
export function alphabetical(a: SourceId, b: SourceId): number {
  return sourceName(a).localeCompare(sourceName(b), 'he');
}

export const ORDERED_SOURCES = [...ALL_SOURCES].sort(alphabetical);

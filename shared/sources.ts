import type { SourceId } from './types.js';

export interface SourceMeta {
  id: SourceId;
  name: string;
  color: string;
  logo: string;
}

/**
 * Brand marks and colours only. This site makes no claim about any outlet's
 * politics — the comparison is built from what each one printed.
 */
export const SOURCES: Record<SourceId, SourceMeta> = {
  c14:     { id: 'c14',     name: 'ערוץ 14',   color: '#f5a300', logo: '/logos/c14.png' },
  ynet:    { id: 'ynet',    name: 'ynet',      color: '#d8232a', logo: '/logos/ynet.ico' },
  n12:     { id: 'n12',     name: 'N12',       color: '#0a6ed1', logo: '/logos/n12.ico' },
  i24:     { id: 'i24',     name: 'i24NEWS',   color: '#e31e24', logo: '/logos/i24.png' },
  t13:     { id: 't13',     name: 'חדשות 13', color: '#c8102e', logo: '/logos/t13.png' },
  haaretz: { id: 'haaretz', name: 'הארץ',      color: '#00539b', logo: '/logos/haaretz.png' },
};

export const ALL_SOURCES = Object.keys(SOURCES) as SourceId[];
export const TOTAL_SOURCES = ALL_SOURCES.length;

export const sourceName = (id: SourceId) => SOURCES[id]?.name ?? id;
export const sourceColor = (id: SourceId) => SOURCES[id]?.color ?? '#888';

/** Fixed alphabetical, so position carries no meaning. */
export function alphabetical(a: SourceId, b: SourceId): number {
  return sourceName(a).localeCompare(sourceName(b), 'he');
}

export const ORDERED_SOURCES = [...ALL_SOURCES].sort(alphabetical);

/**
 * Outlets whose front page renders only its top screens to a server; the rest
 * loads as the reader scrolls. For them, "not found on the front page" means
 * "not in its top part", nothing more.
 */
export const PARTIAL_FRONT: ReadonlySet<SourceId> = new Set<SourceId>(['haaretz', 'i24']);

export const notOnFront = (id: SourceId) =>
  PARTIAL_FRONT.has(id) ? 'לא בחלק העליון של העמוד' : 'לא הופיע';

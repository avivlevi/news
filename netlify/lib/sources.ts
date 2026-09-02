export type SourceId =
  | 'ynet' | 'n12' | 'c14' | 'haaretz' | 'i24' | 't13';

export interface SourceMeta {
  id: SourceId;
  name: string;
  color: string;
  logo: string;
  feed: string;
  viaGoogleNews?: boolean;
  needsBrowserHeaders?: boolean;
}

export const SOURCES: Record<SourceId, SourceMeta> = {
  c14: {
    id: 'c14', name: 'ערוץ 14', color: '#f5a300', logo: '/logos/c14.png',
    feed: 'https://news.google.com/rss/search?q=site:c14.co.il&hl=he&gl=IL&ceid=IL:he',
    viaGoogleNews: true,
  },
  ynet: {
    id: 'ynet', name: 'ynet', color: '#d8232a', logo: '/logos/ynet.ico',
    feed: 'https://www.ynet.co.il/Integration/StoryRss2.xml',
  },
  n12: {
    id: 'n12', name: 'N12', color: '#0a6ed1', logo: '/logos/n12.ico',
    feed: 'https://rcs.mako.co.il/rss/news-israel.xml',
  },
  i24: {
    id: 'i24', name: 'i24NEWS', color: '#e31e24', logo: '/logos/i24.png',
    feed: 'https://news.google.com/rss/search?q=site:i24news.tv&hl=he&gl=IL&ceid=IL:he',
    viaGoogleNews: true,
  },
  t13: {
    id: 't13', name: 'חדשות 13', color: '#c8102e', logo: '/logos/t13.png',
    feed: 'https://news.google.com/rss/search?q=site:13tv.co.il&hl=he&gl=IL&ceid=IL:he',
    viaGoogleNews: true,
  },
  haaretz: {
    id: 'haaretz', name: 'הארץ', color: '#00539b', logo: '/logos/haaretz.png',
    feed: 'https://news.google.com/rss/search?q=site:haaretz.co.il&hl=he&gl=IL&ceid=IL:he',
    viaGoogleNews: true,
  },
};

export const SOURCE_IDS = Object.keys(SOURCES) as SourceId[];

/** Fixed alphabetical order everywhere, so the sequence implies nothing. */
export const ORDERED_SOURCES = [...SOURCE_IDS].sort((a, b) =>
  SOURCES[a].name.localeCompare(SOURCES[b].name, 'he')
);

import type { Handler } from '@netlify/functions';
import { XMLParser } from 'fast-xml-parser';

type SourceId = 'ynet' | 'n12' | 'israelhayom' | 'c14';

interface Article {
  id: string;
  title: string;
  description: string;
  url: string;
  source: SourceId;
  imageUrl?: string;
  publishedAt: string;
}

interface RssItem {
  title?: string | { '#text': string };
  link?: string;
  description?: string | { '#text': string };
  pubDate?: string;
  enclosure?: { '@_url'?: string; '@_type'?: string };
  'media:content'?: { '@_url'?: string } | Array<{ '@_url'?: string }>;
  'media:thumbnail'?: { '@_url'?: string };
  guid?: string | { '#text': string; '@_isPermaLink'?: string };
}

interface FeedConfig {
  source: SourceId;
  url: string;
  headers?: Record<string, string>;
}

const FEEDS: FeedConfig[] = [
  {
    source: 'ynet',
    url: 'https://www.ynet.co.il/Integration/StoryRss2.xml',
  },
  {
    source: 'n12',
    url: 'https://rcs.mako.co.il/rss/news-israel.xml',
  },
  {
    source: 'israelhayom',
    url: 'https://www.israelhayom.co.il/rss.xml',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
      'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
    },
  },
  {
    source: 'c14',
    url: 'https://news.google.com/rss/search?q=site:c14.co.il&hl=he&gl=IL&ceid=IL:he',
  },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseTagValue: true,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (_name, jpath) => jpath === 'rss.channel.item',
});

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function getText(val: unknown): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && '#text' in (val as object)) {
    return String((val as Record<string, unknown>)['#text']);
  }
  return '';
}

function extractImage(item: RssItem): string | undefined {
  const mc = item['media:content'];
  if (mc) {
    if (Array.isArray(mc)) {
      const found = mc.find(m => m['@_url']);
      if (found?.['@_url']) return found['@_url'];
    } else if (mc['@_url']) {
      return mc['@_url'];
    }
  }
  if (item['media:thumbnail']?.['@_url']) {
    return item['media:thumbnail']['@_url'];
  }
  if (item.enclosure?.['@_url'] && item.enclosure?.['@_type']?.startsWith('image')) {
    return item.enclosure['@_url'];
  }
  return undefined;
}

function parseItems(xml: string, source: SourceId): Article[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = parser.parse(xml) as any;
  const items: RssItem[] = parsed?.rss?.channel?.item ?? [];
  if (!Array.isArray(items)) return [];

  return items.slice(0, 20).map((item: RssItem): Article => {
    const rawUrl = getText(item.link) || getText(item.guid);
    const url = rawUrl.trim();
    // Google News RSS appends " - Source Name" to titles — strip it for c14
    const rawTitle = getText(item.title).trim();
    const title = source === 'c14' ? rawTitle.replace(/\s*[-–]\s*[^-–]+$/, '').trim() : rawTitle;
    const rawDesc = getText(item.description);
    const description = rawDesc.replace(/<[^>]+>/g, '').trim().slice(0, 300);
    const publishedAt = item.pubDate
      ? new Date(item.pubDate).toISOString()
      : new Date().toISOString();

    return {
      id: `${source}-${simpleHash(url || title)}`,
      title,
      description,
      url,
      source,
      imageUrl: extractImage(item),
      publishedAt,
    };
  });
}

async function fetchFeed(config: FeedConfig): Promise<Article[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(config.url, {
      headers: {
        'Cache-Control': 'no-cache',
        ...config.headers,
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseItems(xml, config.source);
  } finally {
    clearTimeout(timer);
  }
}

export const handler: Handler = async () => {
  const results = await Promise.allSettled(FEEDS.map(f => fetchFeed(f)));

  const articles: Article[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
    }
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=120',
    },
    body: JSON.stringify({ articles, fetchedAt: new Date().toISOString() }),
  };
};

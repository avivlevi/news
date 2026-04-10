export type SourceId = 'ynet' | 'n12' | 'israelhayom' | 'c14';

export interface Article {
  id: string;
  title: string;
  description: string;
  url: string;
  source: SourceId;
  imageUrl?: string;
  publishedAt: string;
}

export interface Cluster {
  id: string;
  articles: Article[];
  representativeTitle: string;
}

export interface NewsApiResponse {
  articles: Article[];
  fetchedAt: string;
}

export interface ArticleContent {
  status: 'idle' | 'loading' | 'success' | 'error';
  paragraphs: string[];
  title?: string;
  author?: string;
  error?: string;
}

export interface ComparisonState {
  status: 'idle' | 'loading' | 'success' | 'error';
  text?: string;
}

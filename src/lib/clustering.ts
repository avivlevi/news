import type { Article, Cluster } from '@/types';

const HEBREW_STOP_WORDS = new Set([
  'של', 'על', 'את', 'עם', 'הם', 'כי', 'לא', 'גם', 'אם',
  'כך', 'עד', 'אחרי', 'לפני', 'היה', 'היא', 'הוא',
  'אחד', 'כל', 'עוד', 'רק', 'אבל', 'או', 'כבר',
  'בין', 'אל', 'מה', 'זה', 'זו', 'אני', 'אתה',
  'בו', 'לו', 'לה', 'בה', 'שם', 'כן', 'לי',
  'יש', 'אין', 'ה', 'ב', 'מ', 'ל', 'ו', 'כ', 'מי',
  'כן', 'לנו', 'לכם', 'הן', 'אנו', 'אנחנו', 'אלה', 'אלו',
  'שהם', 'שהיה', 'שהיא', 'בישראל', 'לישראל',
]);

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .split(/[\s,.\-–—:!?"'״׳()[\]|/\\]+/)
      .map(w => w.trim())
      .filter(w => w.length > 2 && !HEBREW_STOP_WORDS.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter(w => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array<number>(n).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  union(x: number, y: number): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;
    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY;
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      this.rank[rootX]++;
    }
  }
}

const SOURCE_PRIORITY: Article['source'][] = ['ynet', 'n12', 'israelhayom', 'c14'];

export function clusterArticles(articles: Article[]): Cluster[] {
  const THRESHOLD = 0.2;
  const tokenSets = articles.map(a => tokenize(a.title));
  const uf = new UnionFind(articles.length);

  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      if (jaccardSimilarity(tokenSets[i], tokenSets[j]) >= THRESHOLD) {
        uf.union(i, j);
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < articles.length; i++) {
    const root = uf.find(i);
    const group = groups.get(root) ?? [];
    group.push(i);
    groups.set(root, group);
  }

  const clusters: Cluster[] = [];
  for (const indices of groups.values()) {
    const clusterArticles = indices.map(i => articles[i]);
    const sorted = [...clusterArticles].sort(
      (a, b) => SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source)
    );
    const representative = sorted[0];
    clusters.push({
      id: `cluster-${representative.id}`,
      articles: clusterArticles,
      representativeTitle: representative.title,
    });
  }

  return clusters.sort((a, b) => {
    if (b.articles.length !== a.articles.length) {
      return b.articles.length - a.articles.length;
    }
    const aTime = new Date(a.articles[0].publishedAt).getTime();
    const bTime = new Date(b.articles[0].publishedAt).getTime();
    return bTime - aTime;
  });
}

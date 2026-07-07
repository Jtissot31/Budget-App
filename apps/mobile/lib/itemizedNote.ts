export type ItemizedNote = {
  name: string;
  price: number;
  categoryId?: string | null;
  categoryName?: string | null;
};

/** Rounds to cents — matches article price storage in notes. */
export function roundArticlePrice(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumArticlePrices(articles: ItemizedNote[]): number {
  return roundArticlePrice(articles.reduce((sum, article) => sum + article.price, 0));
}

/** Absolute transaction amount used as the articles budget ceiling. */
export function getTransactionArticlesBudget(transactionAmount: number): number {
  if (!Number.isFinite(transactionAmount)) return 0;
  return roundArticlePrice(Math.abs(transactionAmount));
}

/**
 * Remaining budget for a new or edited manual article.
 * @param excludeArticleIndex — when editing, omit that article from the existing sum.
 */
export function getRemainingArticleBudget(
  transactionAmount: number,
  articles: ItemizedNote[],
  excludeArticleIndex?: number,
): number {
  const budget = getTransactionArticlesBudget(transactionAmount);
  const existingSum = articles.reduce((sum, article, index) => {
    if (excludeArticleIndex != null && index === excludeArticleIndex) return sum;
    return sum + article.price;
  }, 0);
  return roundArticlePrice(Math.max(0, budget - roundArticlePrice(existingSum)));
}

export function isArticlePriceWithinBudget(price: number, maxArticlePrice: number): boolean {
  if (!Number.isFinite(price) || price <= 0) return false;
  return roundArticlePrice(price) <= roundArticlePrice(maxArticlePrice) + 1e-9;
}

export type DerivedArticleCategory = {
  id: string | null;
  name: string;
};

/** Unique categories from line items (order preserved, id preferred for dedup). */
export function deriveUniqueCategoriesFromArticles(articles: ItemizedNote[]): DerivedArticleCategory[] {
  const seen = new Set<string>();
  const result: DerivedArticleCategory[] = [];

  for (const article of articles) {
    const name = article.categoryName?.trim();
    if (!name) continue;
    const key = article.categoryId?.trim() || name;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      id: article.categoryId?.trim() || null,
      name,
    });
  }

  return result;
}

export function parseItemizedNote(note?: string): ItemizedNote[] {
  const line = note?.split('\n').find((part) => part.startsWith('articles:'));
  if (!line) return [];

  try {
    const parsed = JSON.parse(line.slice('articles:'.length));
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): ItemizedNote[] => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      const price = typeof record.price === 'number' ? record.price : Number(record.price);
      if (!name || Number.isNaN(price)) return [];
      return [{
        name,
        price,
        categoryId: typeof record.categoryId === 'string' ? record.categoryId : null,
        categoryName: typeof record.categoryName === 'string' ? record.categoryName : null,
      }];
    });
  } catch {
    return [];
  }
}

export function normalizeArticleSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase();
}

export function buildArticlesNoteLine(articles: ItemizedNote[]): string {
  const payload = articles
    .filter((item) => item.name.trim() && Number.isFinite(item.price) && item.price >= 0)
    .map((item) => ({
      name: item.name.trim(),
      price: Math.round(item.price * 100) / 100,
      categoryId: item.categoryId ?? null,
      categoryName: item.categoryName ?? null,
    }));
  return `articles:${JSON.stringify(payload)}`;
}

export function mergeArticlesIntoNote(note: string | undefined, articles: ItemizedNote[]): string {
  const accountLine = note?.split('\n').find((part) => part.startsWith('compte:'));
  const transferLine = note?.split('\n').find((part) => part.startsWith('transfert:'));
  const prefix = transferLine ?? accountLine ?? 'compte:checking';
  const articleLine = buildArticlesNoteLine(articles);
  return articles.length > 0 ? `${prefix}\n${articleLine}` : prefix;
}

export function createEmptyItemizedRow(id?: string): { id: string; name: string; price: string; categoryId: string | null } {
  return {
    id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    price: '',
    categoryId: null,
  };
}

export function parseItemizedRowsFromNote(note?: string): Array<{ id: string; name: string; price: string; categoryId: string | null }> {
  return parseItemizedNote(note).map((item, index) => ({
    id: `${Date.now()}-${index}`,
    name: item.name,
    price: Number.isInteger(item.price) ? String(item.price) : item.price.toFixed(2).replace(/\.?0+$/, ''),
    categoryId: item.categoryId ?? null,
  }));
}

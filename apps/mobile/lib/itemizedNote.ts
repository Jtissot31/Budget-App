export type ItemizedNote = {
  name: string;
  price: number;
  categoryId?: string | null;
  categoryName?: string | null;
};

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

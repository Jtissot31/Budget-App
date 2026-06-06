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

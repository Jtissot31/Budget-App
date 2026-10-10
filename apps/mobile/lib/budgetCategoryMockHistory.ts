/**
 * Demo history for a budget category that has no real transactions yet (mock budget
 * categories, fresh installs). Deterministic per category so the detail view looks
 * the same every time: typical merchants, this month's spend split into purchases,
 * and five previous months around the limit.
 */
import type { Transaction } from '@/types';

const MERCHANTS_BY_KEYWORD: { keys: string[]; merchants: string[] }[] = [
  { keys: ['epicerie', 'grocery'], merchants: ['IGA', 'Metro', 'Maxi', 'Costco', 'Super C'] },
  { keys: ['restaurant', 'resto', 'cafe'], merchants: ['Tim Hortons', 'Subway', 'A&W', 'Starbucks'] },
  { keys: ['transport', 'essence', 'auto'], merchants: ['Petro-Canada', 'Shell', 'STM — Opus', 'Esso'] },
  { keys: ['logement', 'loyer', 'appartement', 'maison'], merchants: ['Loyer', 'Hydro-Québec'] },
  { keys: ['telephone', 'internet'], merchants: ['Vidéotron', 'Fizz Mobile', 'Bell Mobilité'] },
  { keys: ['loisir', 'divertissement'], merchants: ['Netflix', 'Cinéplex', 'Spotify', 'Steam'] },
  { keys: ['vetement'], merchants: ['Simons', 'Uniqlo', 'Sports Experts'] },
  { keys: ['sante', 'pharmacie'], merchants: ['Jean Coutu', 'Pharmaprix', 'Familiprix'] },
  { keys: ['inutile', 'impulsif'], merchants: ['Amazon', 'Dollarama', 'Couche-Tard'] },
];

/** Past-month spend as a share of the limit (oldest → newest). */
const PAST_FACTORS = [0.82, 1.06, 0.91, 0.76, 0.97];

function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function seedFrom(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

export function mockMerchantsFor(categoryName: string): string[] {
  const folded = fold(categoryName);
  return MERCHANTS_BY_KEYWORD.find((entry) => entry.keys.some((key) => folded.includes(key)))?.merchants ?? [
    'Achat',
  ];
}

/** Split `total` into a few purchases dated within `monthStart` up to `upTo`. */
export function buildMockMonthTransactions(
  categoryId: string,
  categoryName: string,
  monthStart: Date,
  total: number,
  upTo: Date,
): Transaction[] {
  if (total <= 0) return [];
  const merchants = mockMerchantsFor(categoryName);
  const seed = seedFrom(`${categoryId}:${monthStart.getFullYear()}-${monthStart.getMonth()}`);
  const count = Math.max(1, Math.min(6, Math.round(total / 60)));
  const lastDay = Math.max(
    1,
    upTo.getFullYear() === monthStart.getFullYear() && upTo.getMonth() === monthStart.getMonth()
      ? upTo.getDate()
      : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate(),
  );

  // Uneven weights so purchases don't all look identical.
  const weights = Array.from({ length: count }, (_, i) => 1 + ((seed >> (i * 3)) % 7) / 4);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  let assigned = 0;

  return weights.map((weight, i) => {
    const isLast = i === count - 1;
    const amount = isLast ? total - assigned : Math.round((total * weight) / weightSum * 100) / 100;
    assigned += amount;
    const day = Math.max(1, lastDay - Math.floor(((seed >> (i * 2)) % lastDay + i * 5) % lastDay));
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day, 12 + (i % 6), 15);
    return {
      id: `mock-${categoryId}-${monthStart.getMonth()}-${i}`,
      label: merchants[(seed + i) % merchants.length]!,
      amount: -Math.abs(amount),
      type: 'expense',
      date: date.toISOString(),
      categoryId,
      categoryName,
      syncStatus: 'synced',
    } satisfies Transaction;
  });
}

export function mockPastMonthTotal(limit: number, indexFromOldest: number): number {
  const factor = PAST_FACTORS[indexFromOldest % PAST_FACTORS.length] ?? 0.9;
  return Math.round(Math.max(limit, 50) * factor * 100) / 100;
}

export function isMockTransactionId(id: string): boolean {
  return id.startsWith('mock-');
}

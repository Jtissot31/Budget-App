import { sortTransactionsNewestFirst } from '@/lib/db';
import type { Transaction } from '@/types';

export type HistoryTypeFilter = 'all' | 'expense' | 'income';

export const HISTORY_FILTER_OPTIONS: { id: HistoryTypeFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'expense', label: 'Dépenses' },
  { id: 'income', label: 'Revenus' },
];

export function getLocalDayKey(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTransactionGroupDateLabel(dayKey: string) {
  return new Date(`${dayKey}T12:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  });
}

/** Client-side equivalent of getTransactions(search) — label and category name. */
export function transactionMatchesSearch(tx: Transaction, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    tx.label.toLowerCase().includes(q) ||
    (tx.categoryName ?? '').toLowerCase().includes(q)
  );
}

export function filterTransactionsByType(
  transactions: Transaction[],
  filter: HistoryTypeFilter,
): Transaction[] {
  if (filter === 'all') return transactions;
  return transactions.filter((tx) => tx.type === filter);
}

export function groupTransactionsByDay(transactions: Transaction[]): [string, Transaction[]][] {
  const groups: Record<string, Transaction[]> = {};
  transactions.forEach((tx) => {
    const key = getLocalDayKey(tx.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  });
  return Object.entries(groups)
    .map(([day, txs]) => [day, sortTransactionsNewestFirst(txs)] as [string, Transaction[]])
    .sort(([a], [b]) => b.localeCompare(a));
}

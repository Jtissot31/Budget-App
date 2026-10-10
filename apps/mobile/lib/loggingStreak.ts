/**
 * Logging habit helpers — streak of consecutive days with at least one entry,
 * today's spend, and the merchants the user logs most (quick-add shortcuts).
 */
import { getLocalDayKey } from '@/lib/transactionListUtils';
import type { Transaction } from '@/types';

export type LoggingStreak = {
  /** Consecutive days ending today (or yesterday when today is still empty). */
  days: number;
  loggedToday: boolean;
  /** Streak exists but nothing logged yet today — nudge before it breaks. */
  atRisk: boolean;
};

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function computeLoggingStreak(transactions: readonly Transaction[], now = new Date()): LoggingStreak {
  const days = new Set(transactions.map((tx) => getLocalDayKey(tx.date)));
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  const loggedToday = days.has(dayKey(cursor));
  if (!loggedToday) cursor.setDate(cursor.getDate() - 1);

  let count = 0;
  while (days.has(dayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { days: count, loggedToday, atRisk: !loggedToday && count > 0 };
}

export type QuickAddMerchant = {
  label: string;
  categoryId?: string;
  categoryIcon?: string;
  /** Typical amount (median of recent entries) — shown as a hint. */
  typicalAmount: number;
  count: number;
};

/** Most-logged expense merchants (last entries win for category). */
export function topQuickAddMerchants(transactions: readonly Transaction[], limit = 4): QuickAddMerchant[] {
  const byLabel = new Map<string, { label: string; categoryId?: string; categoryIcon?: string; amounts: number[] }>();
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const label = tx.label.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const entry = byLabel.get(key) ?? { label, amounts: [] as number[] };
    entry.amounts.push(Math.abs(tx.amount));
    entry.categoryId ??= tx.categoryId || undefined;
    entry.categoryIcon ??= tx.categoryIcon || undefined;
    byLabel.set(key, entry);
  }
  return [...byLabel.values()]
    .filter((entry) => entry.amounts.length >= 2)
    .sort((a, b) => b.amounts.length - a.amounts.length)
    .slice(0, limit)
    .map((entry) => {
      const sorted = [...entry.amounts].sort((a, b) => a - b);
      return {
        label: entry.label,
        categoryId: entry.categoryId,
        categoryIcon: entry.categoryIcon,
        typicalAmount: sorted[Math.floor(sorted.length / 2)] ?? 0,
        count: entry.amounts.length,
      };
    });
}

export function todaySpend(transactions: readonly Transaction[], now = new Date()): { total: number; count: number } {
  const key = dayKey(now);
  let total = 0;
  let count = 0;
  for (const tx of transactions) {
    if (getLocalDayKey(tx.date) !== key) continue;
    count += 1;
    if (tx.type === 'expense') total += Math.abs(tx.amount);
  }
  return { total, count };
}

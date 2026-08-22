/**
 * Resolve live budget-overrun diagnostics for alert-detail
 * (category, allocated, spent, surplus, busting transactions).
 *
 * Run tests: npx --yes tsx --tsconfig tsconfig.json lib/resolveBudgetOverrun.test.ts
 */

import type { AlertCenterItem } from '@/lib/alerts';
import { budgetOverAlertKey, extractBudgetOverCategory } from '@/lib/alertIdentity';
import { isCurrentMonth, startOfMonth } from '@/lib/budgetMonth';
import { getCategoryBudgetUsage } from '@/lib/categoryBudgetUsage';
import { normalizeSearch } from '@/lib/categoryInference';
import { monthKeyFromDate, parseMonthKey } from '@/lib/monthRangeFilter';
import type { CategoryBudget, Transaction } from '@/types';

export type BudgetOverrunData = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  allocated: number;
  spent: number;
  surplus: number;
  usagePercent: number;
  monthDate: Date;
  isCurrentMonth: boolean;
  transactions: Transaction[];
  /** Chronological txs that crossed / followed the allocated ceiling. */
  overspendTransactionIds: Set<string>;
};

const BUDGET_OVER_DEDUPE = /^budget_over:(.+):(\d{4}-\d{2})$/;

export function parseBudgetOverDedupeKey(
  key?: string | null,
): { refSlug: string; monthKey: string } | null {
  const match = key?.trim().match(BUDGET_OVER_DEDUPE);
  if (!match) return null;
  return { refSlug: match[1], monthKey: match[2] };
}

export function monthDateForBudgetAlert(
  item: Pick<AlertCenterItem, 'dedupeKey' | 'timestamp'>,
): Date {
  const parsed = parseBudgetOverDedupeKey(item.dedupeKey);
  if (parsed) {
    const fromKey = parseMonthKey(parsed.monthKey);
    if (fromKey) return startOfMonth(fromKey);
  }
  const fromTimestamp = Date.parse(item.timestamp);
  if (Number.isFinite(fromTimestamp)) {
    return startOfMonth(new Date(fromTimestamp));
  }
  return startOfMonth(new Date());
}

export function matchCategoryBudgetForAlert(
  budgets: readonly CategoryBudget[],
  item: Pick<AlertCenterItem, 'title' | 'message' | 'dedupeKey'>,
  monthKey: string,
): CategoryBudget | undefined {
  if (item.dedupeKey) {
    const byIdentity = budgets.find(
      (budget) =>
        budgetOverAlertKey(budget.categoryId, monthKey) === item.dedupeKey ||
        budgetOverAlertKey(budget.categoryName, monthKey) === item.dedupeKey,
    );
    if (byIdentity) return byIdentity;
  }

  const categoryName = extractBudgetOverCategory(item.title, item.message);
  if (!categoryName) return undefined;
  const needle = normalizeSearch(categoryName);
  return budgets.find((budget) => normalizeSearch(budget.categoryName) === needle);
}

/**
 * Oldest-first running spend: the tx that first exceeds `allocated`, plus every later one.
 * Zero allocated → every expense is treated as overspend.
 */
export function identifyOverspendTransactionIds(
  transactions: readonly Transaction[],
  allocated: number,
): Set<string> {
  const ids = new Set<string>();
  const chronological = [...transactions].sort((a, b) => {
    const delta = Date.parse(a.date) - Date.parse(b.date);
    if (delta !== 0) return delta;
    return a.id.localeCompare(b.id);
  });

  if (allocated <= 0) {
    for (const tx of chronological) ids.add(tx.id);
    return ids;
  }

  let running = 0;
  let crossed = false;
  for (const tx of chronological) {
    running += Math.abs(tx.amount);
    if (crossed || running > allocated) {
      ids.add(tx.id);
      crossed = true;
    }
  }
  return ids;
}

function sortNewestFirst(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    const delta = Date.parse(b.date) - Date.parse(a.date);
    if (delta !== 0) return delta;
    return b.id.localeCompare(a.id);
  });
}

export function buildBudgetOverrunData(params: {
  budget: CategoryBudget;
  transactions: Transaction[];
  monthDate: Date;
  fallbackSurplus?: number | null;
}): BudgetOverrunData {
  const allocated = Math.max(0, params.budget.limitAmount);
  const spent = Math.max(0, params.budget.spent);
  const usage = getCategoryBudgetUsage(allocated, spent);
  const liveSurplus = Math.max(0, Math.round((spent - allocated) * 100) / 100);
  const surplus =
    liveSurplus > 0
      ? liveSurplus
      : typeof params.fallbackSurplus === 'number' && Number.isFinite(params.fallbackSurplus)
        ? Math.max(0, params.fallbackSurplus)
        : 0;

  return {
    categoryId: params.budget.categoryId,
    categoryName: params.budget.categoryName,
    categoryIcon: params.budget.categoryIcon,
    categoryColor: params.budget.categoryColor,
    allocated,
    spent,
    surplus,
    usagePercent: usage.usagePercent,
    monthDate: params.monthDate,
    isCurrentMonth: isCurrentMonth(params.monthDate),
    transactions: sortNewestFirst(params.transactions),
    overspendTransactionIds: identifyOverspendTransactionIds(params.transactions, allocated),
  };
}

export async function resolveBudgetOverrunData(
  item: Pick<AlertCenterItem, 'kind' | 'id' | 'title' | 'message' | 'dedupeKey' | 'timestamp' | 'montant'>,
): Promise<BudgetOverrunData | null> {
  if (item.kind !== 'budget_over') return null;
  if (item.id.startsWith('aggregate-')) return null;

  const monthDate = monthDateForBudgetAlert(item);
  const monthKey = monthKeyFromDate(monthDate);
  const { getCategoryBudgetsForMonth, getTransactionsForBudgetCategoryInMonth } = await import('@/lib/db');
  const budgets = await getCategoryBudgetsForMonth(monthDate);
  const budget = matchCategoryBudgetForAlert(budgets, item, monthKey);
  if (!budget) return null;

  const transactions = await getTransactionsForBudgetCategoryInMonth(budget.categoryId, monthDate);
  return buildBudgetOverrunData({
    budget,
    transactions,
    monthDate,
    fallbackSurplus: item.montant,
  });
}

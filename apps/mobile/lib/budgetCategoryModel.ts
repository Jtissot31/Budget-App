import { assignCategoryColor, getColorForCategoryIndex } from '@/constants/budgetCategoryColors';
import type { BudgetCategory } from '@/lib/budgetCategories';
import {
  getCategoryBudgetUsage,
  type CategoryBudgetUsage,
} from '@/lib/categoryBudgetUsage';
import type { CategoryBudget } from '@/types';

export const MAX_BUDGET_CATEGORIES = 10;

export type BudgetCategoryUiModel = {
  id: string;
  name: string;
  icon: string;
  color: string;
  limit: number;
  spent: number;
  usage: CategoryBudgetUsage;
  /** Share of total allocated limits (0–1) for donut proportions. */
  limitFraction: number;
};

export type BudgetCategoryTotals = {
  totalAllocated: number;
  totalSpent: number;
};

function resolveDisplayColor(budget: CategoryBudget, index: number): string {
  const stored = budget.categoryColor?.trim();
  if (stored) return stored;
  return getColorForCategoryIndex(index);
}

function mapBudgetEntryToUi(
  entry: {
    id: string;
    name: string;
    icon: string;
    color: string;
    limit: number;
    spent: number;
  },
  index: number,
  totalAllocated: number,
): BudgetCategoryUiModel {
  const limit = Math.max(0, entry.limit);
  const spent = Math.max(0, entry.spent);
  const usage = getCategoryBudgetUsage(limit, spent);
  const limitFraction = totalAllocated > 0 && limit > 0 ? limit / totalAllocated : 0;
  const storedColor = entry.color?.trim();

  return {
    id: entry.id,
    name: entry.name,
    icon: entry.icon,
    color: storedColor || getColorForCategoryIndex(index),
    limit,
    spent,
    usage,
    limitFraction,
  };
}

/** Map AsyncStorage budget categories to UI models with usage + donut fractions. */
export function mapBudgetCategoriesToUi(
  categories: readonly BudgetCategory[],
): BudgetCategoryUiModel[] {
  const withLimits = categories.filter((category) => category.limit > 0);
  const totalAllocated = withLimits.reduce((sum, category) => sum + category.limit, 0);

  return categories.map((category, index) =>
    mapBudgetEntryToUi(category, index, totalAllocated),
  );
}

/** Map SQLite category budgets to UI models with usage + donut fractions. */
export function mapCategoryBudgetsToUi(budgets: readonly CategoryBudget[]): BudgetCategoryUiModel[] {
  const withLimits = budgets.filter((budget) => budget.limitAmount > 0);
  const totalAllocated = withLimits.reduce((sum, budget) => sum + budget.limitAmount, 0);

  return budgets.map((budget, index) =>
    mapBudgetEntryToUi(
      {
        id: budget.categoryId,
        name: budget.categoryName,
        icon: budget.categoryIcon,
        color: resolveDisplayColor(budget, index),
        limit: budget.limitAmount,
        spent: budget.spent,
      },
      index,
      totalAllocated,
    ),
  );
}

export function sortBudgetCategoriesByLimitDesc(
  categories: readonly BudgetCategoryUiModel[],
): BudgetCategoryUiModel[] {
  return [...categories].sort((a, b) => {
    if (b.limit !== a.limit) return b.limit - a.limit;
    return a.name.localeCompare(b.name, 'fr');
  });
}

export function computeBudgetTotals(categories: readonly BudgetCategoryUiModel[]): BudgetCategoryTotals {
  return categories.reduce(
    (acc, category) => ({
      totalAllocated: acc.totalAllocated + category.limit,
      totalSpent: acc.totalSpent + category.spent,
    }),
    { totalAllocated: 0, totalSpent: 0 },
  );
}

/** Pick the next palette color not already assigned to existing categories. */
export function pickNextCategoryColor(existing: readonly BudgetCategoryUiModel[]): string {
  return assignCategoryColor(existing.map((category) => category.color));
}

export function canAddBudgetCategory(count: number): boolean {
  return count < MAX_BUDGET_CATEGORIES;
}

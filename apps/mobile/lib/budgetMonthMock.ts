import { isSameMonth, startOfMonth } from '@/lib/budgetMonth';

export type BudgetMonthScenario = 'over' | 'under-savings' | 'exact';

export type BudgetMonthCategorySnapshot = {
  limit: number;
  spent: number;
};

export type BudgetMonthSnapshot = {
  scenario: BudgetMonthScenario;
  categories: Record<string, BudgetMonthCategorySnapshot>;
};

const BASELINE_LIMITS: Record<string, number> = {
  'cat-budget-logement': 1200,
  'cat-budget-epicerie': 400,
  'cat-budget-transport': 300,
  'cat-budget-telephone': 100,
  'cat-budget-restaurants': 200,
  'cat-budget-loisirs': 150,
  'cat-budget-vetements': 100,
  'cat-budget-sante': 100,
  'cat-budget-depenses-inutiles': 150,
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function snapshotFromSpent(
  spentById: Record<string, number>,
  limitOverrides: Partial<Record<string, number>> = {},
): BudgetMonthSnapshot['categories'] {
  const categories: BudgetMonthSnapshot['categories'] = {};
  for (const [id, limit] of Object.entries(BASELINE_LIMITS)) {
    categories[id] = {
      limit: limitOverrides[id] ?? limit,
      spent: spentById[id] ?? 0,
    };
  }
  return categories;
}

/**
 * Month B allocates 2 750 $ by adding +50 to Loisirs (150 → 200) instead of
 * spreading across categories — keeps the savings story visible on one leisure line.
 */
function buildHistoricalSnapshots(reference: Date): Map<string, BudgetMonthSnapshot> {
  const current = startOfMonth(reference);
  const monthMinus3 = new Date(current.getFullYear(), current.getMonth() - 3, 1);
  const monthMinus2 = new Date(current.getFullYear(), current.getMonth() - 2, 1);
  const monthMinus1 = new Date(current.getFullYear(), current.getMonth() - 1, 1);

  const overBudgetSpent = {
    'cat-budget-logement': 1200,
    'cat-budget-epicerie': 450,
    'cat-budget-transport': 320,
    'cat-budget-telephone': 100,
    'cat-budget-restaurants': 230,
    'cat-budget-loisirs': 180,
    'cat-budget-vetements': 100,
    'cat-budget-sante': 100,
    'cat-budget-depenses-inutiles': 200,
  };

  const underBudgetSpent = {
    'cat-budget-logement': 1150,
    'cat-budget-epicerie': 380,
    'cat-budget-transport': 280,
    'cat-budget-telephone': 95,
    'cat-budget-restaurants': 175,
    'cat-budget-loisirs': 170,
    'cat-budget-vetements': 80,
    'cat-budget-sante': 90,
    'cat-budget-depenses-inutiles': 80,
  };

  const exactSpent = { ...BASELINE_LIMITS };

  return new Map([
    [
      monthKey(monthMinus3),
      {
        scenario: 'over',
        categories: snapshotFromSpent(overBudgetSpent),
      },
    ],
    [
      monthKey(monthMinus2),
      {
        scenario: 'under-savings',
        categories: snapshotFromSpent(underBudgetSpent, { 'cat-budget-loisirs': 200 }),
      },
    ],
    [
      monthKey(monthMinus1),
      {
        scenario: 'exact',
        categories: snapshotFromSpent(exactSpent),
      },
    ],
  ]);
}

function getSnapshots(): Map<string, BudgetMonthSnapshot> {
  return buildHistoricalSnapshots(new Date());
}

/** First selectable month in the mock history (3 months before the current month). */
export function getMockBudgetEarliestMonthStart(reference: Date = new Date()): Date {
  const current = startOfMonth(reference);
  return new Date(current.getFullYear(), current.getMonth() - 3, 1);
}

/** Returns mock spent/limits for historical months; null for the current month. */
export function getMockBudgetSnapshotForMonth(monthDate: Date): BudgetMonthSnapshot | null {
  if (isSameMonth(monthDate, new Date())) return null;
  return getSnapshots().get(monthKey(startOfMonth(monthDate))) ?? null;
}

export function sumSnapshotTotals(snapshot: BudgetMonthSnapshot): {
  totalAllocated: number;
  totalSpent: number;
} {
  let totalAllocated = 0;
  let totalSpent = 0;
  for (const entry of Object.values(snapshot.categories)) {
    totalAllocated += entry.limit;
    totalSpent += entry.spent;
  }
  return { totalAllocated, totalSpent };
}

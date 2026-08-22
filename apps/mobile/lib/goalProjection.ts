import { savingsGoalIncrementalProgress } from '@/lib/savingsGoalProgress';
import type { CategoryBudget, DashboardSummary, RecurringPayment, SavingsGoal } from '@/types';

/** Weeks-per-month used for budget / obligation weekly conversion (same as projection card). */
export const GOAL_PROJECTION_WEEKS_PER_MONTH = 4;

export type GoalProjection = {
  progress: number;
  remaining: number;
  weeksToGoal: number | null;
  requiredWeekly: number | null;
  monthlyContribution: number;
  weeklyObligationsTotal: number;
  /** Weekly free cashflow after budgets, outside-budget obligations, and goal contribution. */
  cashflowImpactWeekly: number | null;
  budgetUseRatio: number | null;
  freeMoneyLeftRatio: number | null;
  targetDate: string | null;
  hint: string;
};

export function projectedCompletionLabel(goal: SavingsGoal): string | null {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  if (remaining <= 0) return 'Objectif atteint';
  const weekly = goal.weeklyContribution ?? 0;
  if (weekly > 0) {
    const weeks = Math.ceil(remaining / weekly);
    const date = new Date();
    date.setDate(date.getDate() + weeks * 7);
    return date.toISOString().slice(0, 10);
  }
  if (goal.dueDate?.trim()) return goal.dueDate.trim();
  return null;
}

/**
 * Shared cashflow math for goal projection cards.
 *
 * Impact ≈ weeklyIncome − (budgetLimits / 4) − weeklyObligationsOutsideBudget − weeklyGoalContribution
 *
 * Recurring expenses linked to a budget category (categoryId with a limit) are excluded from
 * obligations so they are not double-counted with category allocations.
 */
export function computeGoalCashflowProjection(input: {
  weeklyContribution: number;
  requiredWeekly: number | null;
  dashboard: DashboardSummary | null;
  categoryBudgets: CategoryBudget[];
  recurringPayments: RecurringPayment[];
}): Pick<
  GoalProjection,
  | 'monthlyContribution'
  | 'weeklyObligationsTotal'
  | 'cashflowImpactWeekly'
  | 'budgetUseRatio'
  | 'freeMoneyLeftRatio'
  | 'hint'
> {
  const { weeklyContribution, requiredWeekly, dashboard, categoryBudgets, recurringPayments } = input;
  const monthlyContribution = (weeklyContribution * 52) / 12;
  const monthlyIncome = resolveMonthlyIncome(dashboard, recurringPayments);
  const categoryLimits = sumCategoryBudgetLimits(categoryBudgets);
  const recurringOutsideBudget = sumMonthlyRecurringExpensesOutsideBudget(
    recurringPayments,
    categoryBudgets,
  );
  const monthlyLoadWithoutGoal = categoryLimits + recurringOutsideBudget;
  const weeklyObligationsTotal =
    monthlyLoadWithoutGoal / GOAL_PROJECTION_WEEKS_PER_MONTH + weeklyContribution;
  const weeklyIncome = monthlyIncome / GOAL_PROJECTION_WEEKS_PER_MONTH;
  const cashflowImpactWeekly =
    monthlyIncome > 0 ? weeklyIncome - weeklyObligationsTotal : null;
  const plannedTotal = monthlyLoadWithoutGoal + monthlyContribution;
  const freeMoneyLeft = monthlyIncome > 0 ? monthlyIncome - plannedTotal : null;
  const budgetUseRatio =
    monthlyIncome > 0 && monthlyContribution > 0 ? monthlyContribution / monthlyIncome : null;
  const freeMoneyLeftRatio =
    monthlyIncome > 0 && freeMoneyLeft != null ? freeMoneyLeft / monthlyIncome : null;

  return {
    monthlyContribution,
    weeklyObligationsTotal,
    cashflowImpactWeekly,
    budgetUseRatio,
    freeMoneyLeftRatio,
    hint: getSavingsHint(freeMoneyLeftRatio, requiredWeekly, weeklyContribution),
  };
}

/**
 * Full projection for a persisted savings goal (detail screen).
 * Form editing uses a parallel helper in `SavingsGoalsForm`.
 */
export function getGoalProjection(
  goal: SavingsGoal,
  dashboard: DashboardSummary | null,
  categoryBudgets: CategoryBudget[],
  recurringPayments: RecurringPayment[],
): GoalProjection | null {
  const targetAmount = goal.targetAmount;
  const currentAmount = goal.currentAmount;
  const weeklyContribution = goal.weeklyContribution ?? 0;

  if (
    !Number.isFinite(targetAmount) ||
    !Number.isFinite(currentAmount) ||
    !Number.isFinite(weeklyContribution) ||
    targetAmount < 0 ||
    currentAmount < 0 ||
    weeklyContribution < 0
  ) {
    return null;
  }

  const initialForProgress = Math.min(
    Math.max(goal.initialSavedAmount ?? currentAmount, 0),
    currentAmount,
  );
  const remaining = Math.max(0, targetAmount - currentAmount);
  const weeksToGoal =
    weeklyContribution > 0 && remaining > 0
      ? Math.ceil(remaining / weeklyContribution)
      : null;
  const requiredWeekly = getRequiredWeekly(remaining, goal.dueDate);
  const cashflow = computeGoalCashflowProjection({
    weeklyContribution,
    requiredWeekly,
    dashboard,
    categoryBudgets,
    recurringPayments,
  });
  const targetDate =
    weeklyContribution > 0 && remaining > 0
      ? addWeeks(new Date(), Math.ceil(remaining / weeklyContribution))
      : remaining <= 0
        ? new Date()
        : null;

  return {
    progress: savingsGoalIncrementalProgress({
      targetAmount,
      currentAmount,
      initialSavedAmount: initialForProgress,
    }),
    remaining,
    weeksToGoal,
    requiredWeekly,
    ...cashflow,
    targetDate: targetDate ? formatDateKey(targetDate) : null,
  };
}

export function formatGoalDuration(weeks: number) {
  if (weeks < 4) return `${weeks} sem.`;

  const totalDays = weeks * 7;
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  const parts: string[] = [];

  if (months > 0) {
    parts.push(`${months} mois`);
  }
  if (days > 0) {
    parts.push(`${days} jour${days > 1 ? 's' : ''}`);
  }

  return parts.length > 0 ? parts.join(' ') : `${weeks} sem.`;
}

export function formatGoalProjectionPercent(value: number) {
  return `${Math.round(value * 100)} %`;
}

/** Category ids that have a positive monthly limit (covers linked recurrings). */
export function budgetedCategoryIdSet(categoryBudgets: CategoryBudget[]): Set<string> {
  const ids = new Set<string>();
  for (const budget of categoryBudgets) {
    if (toPositiveAmount(budget.limitAmount) > 0 && budget.categoryId) {
      ids.add(budget.categoryId);
    }
  }
  return ids;
}

export function sumCategoryBudgetLimits(categoryBudgets: CategoryBudget[]): number {
  return categoryBudgets.reduce((sum, item) => sum + toPositiveAmount(item.limitAmount), 0);
}

/**
 * Active non-income recurrings whose category is not already covered by a budget limit.
 * Matches the linked-category pattern used by recurring impact summaries.
 */
export function sumMonthlyRecurringExpensesOutsideBudget(
  recurringPayments: RecurringPayment[],
  categoryBudgets: CategoryBudget[],
): number {
  const budgetedIds = budgetedCategoryIdSet(categoryBudgets);
  return recurringPayments.reduce((sum, payment) => {
    if (!payment.active || payment.kind === 'income') return sum;
    const categoryId = payment.categoryId?.trim();
    if (categoryId && budgetedIds.has(categoryId)) return sum;
    return sum + monthlyEquivalent(payment);
  }, 0);
}

export function sumMonthlyRecurringIncome(recurringPayments: RecurringPayment[]): number {
  return recurringPayments.reduce((sum, payment) => {
    if (!payment.active || payment.kind !== 'income') return sum;
    return sum + monthlyEquivalent(payment);
  }, 0);
}

export function resolveMonthlyIncome(
  dashboard: DashboardSummary | null,
  recurringPayments: RecurringPayment[],
): number {
  const fromRecurring = sumMonthlyRecurringIncome(recurringPayments);
  if (fromRecurring > 0) return fromRecurring;
  return toPositiveAmount(dashboard?.monthlyIncome);
}

function getRequiredWeekly(remaining: number, dueDate?: string) {
  const trimmedDueDate = dueDate?.trim() ?? '';
  const date = new Date(trimmedDueDate);
  if (!trimmedDueDate || Number.isNaN(date.getTime())) return null;
  const weeks = Math.max(
    1,
    Math.ceil((date.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)),
  );
  return Math.max(remaining, 0) / weeks;
}

function addWeeks(date: Date, weeks: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + weeks * 7);
  return next;
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getSavingsHint(
  freeMoneyLeftRatio: number | null,
  requiredWeekly: number | null,
  weeklyContribution: number,
) {
  if (requiredWeekly != null && weeklyContribution > 0 && weeklyContribution < requiredWeekly) {
    return 'À ce rythme, la date cible risque de ne pas être atteinte.';
  }
  if (freeMoneyLeftRatio == null) {
    return 'Entre une contribution hebdomadaire pour estimer sa place dans ton budget.';
  }
  if (freeMoneyLeftRatio < 0) {
    return 'Projection prudente: les limites, paiements récurrents et objectifs dépassent les revenus connus.';
  }
  if (freeMoneyLeftRatio < 0.1) {
    return 'Projection serrée: garde une marge pour les imprévus.';
  }
  return 'Projection confortable après les limites, paiements récurrents et objectifs.';
}

function monthlyEquivalent(payment: RecurringPayment) {
  const amount = toPositiveAmount(payment.amount);
  if (payment.frequency === 'weekly') return (amount * 52) / 12;
  if (payment.frequency === 'biweekly') return (amount * 26) / 12;
  if (payment.frequency === 'yearly') return amount / 12;
  return amount;
}

function toPositiveAmount(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

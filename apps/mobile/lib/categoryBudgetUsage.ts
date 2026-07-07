import type { AppColors } from '@/constants/theme';

export type CategoryBudgetUsage = {
  limit: number;
  spent: number;
  /** Bar fill 0–1 (full when zero-limit overspend). */
  progress: number;
  usagePercent: number;
  /** limit = 0 and spent > 0 */
  isZeroLimitOverspend: boolean;
  /** Includes zero-limit overspend and spent > limit when limit > 0 */
  isOverBudget: boolean;
  statusLabel: string | null;
};

export type BudgetStatus = {
  color: string;
  label: string | null;
  percentage: number;
};

/** At-limit threshold — green bar + checkmark only at exactly 100 %. */
export const BUDGET_GREEN_MAX_PERCENT = 100;
/** Amber bar: 101 <= usagePercent <= 115 (mild overspend). */
export const BUDGET_AMBER_MIN_PERCENT = 101;
export const BUDGET_AMBER_MAX_PERCENT = 115;

/** Under-budget bar — white-gray fill below 100 %. */
export const BUDGET_UNDER_BUDGET_COLOR = 'rgba(255,255,255,0.35)';
/** Under-budget track — muted white below 100 %. */
export const BUDGET_UNDER_BUDGET_TRACK_COLOR = 'rgba(255,255,255,0.08)';
/** Green bar — limit exactly met (100 % only). */
export const BUDGET_GREEN_COLOR = '#4ADE80';
/** Amber warning — mild overspend (101–115 %). */
export const BUDGET_WARNING_COLOR = '#C9974A';
/** Muted red — zero-limit overspend or significant overspend (>115 %). */
export const BUDGET_DANGER_COLOR = '#C96560';

/** Status tag shows at exactly 100 % or when overspent. */
export const CATEGORY_STATUS_TAG_THRESHOLD = BUDGET_GREEN_MAX_PERCENT;

/**
 * Single source of truth for budget color, status label, and usage percentage.
 * Edge cases: limit=0 & spent=0 → gray, no label; limit=0 & spent>0 → red, overspend.
 */
export function getBudgetStatus(spent: number, allocated: number): BudgetStatus {
  const spentValue = Math.max(0, spent);
  const allocatedValue = Math.max(0, allocated);

  if (allocatedValue === 0 && spentValue === 0) {
    return { color: BUDGET_UNDER_BUDGET_COLOR, label: null, percentage: 0 };
  }

  if (allocatedValue === 0 && spentValue > 0) {
    return {
      color: BUDGET_DANGER_COLOR,
      label: 'Fortement dépassé',
      percentage: 100,
    };
  }

  const percentage = Math.round((spentValue / allocatedValue) * 100);

  if (percentage < BUDGET_GREEN_MAX_PERCENT) {
    return {
      color: BUDGET_UNDER_BUDGET_COLOR,
      label: null,
      percentage,
    };
  }

  if (percentage === BUDGET_GREEN_MAX_PERCENT) {
    return {
      color: BUDGET_GREEN_COLOR,
      label: 'Limite respectée',
      percentage,
    };
  }

  if (percentage <= BUDGET_AMBER_MAX_PERCENT) {
    return {
      color: BUDGET_WARNING_COLOR,
      label: 'Légèrement dépassé',
      percentage,
    };
  }

  return {
    color: BUDGET_DANGER_COLOR,
    label: 'Fortement dépassé',
    percentage,
  };
}

export function getCategoryBudgetUsage(limitAmount: number, spent: number): CategoryBudgetUsage {
  const limit = Math.max(0, limitAmount);
  const spentValue = Math.max(0, spent);
  const isZeroLimitOverspend = limit <= 0 && spentValue > 0;
  const isOverBudget = isZeroLimitOverspend || (limit > 0 && spentValue > limit);

  const progress = isZeroLimitOverspend
    ? 1
    : limit > 0
      ? Math.min(spentValue / limit, 1)
      : 0;

  const budgetStatus = getBudgetStatus(spentValue, limit);

  return {
    limit,
    spent: spentValue,
    progress,
    usagePercent: budgetStatus.percentage,
    isZeroLimitOverspend,
    isOverBudget,
    statusLabel: budgetStatus.label,
  };
}

/** List sort tier: red (overspend) → amber (mild) → green (on track). */
export type CategoryBudgetPriorityTier = 'red' | 'amber' | 'green';

const PRIORITY_TIER_ORDER: Record<CategoryBudgetPriorityTier, number> = {
  red: 0,
  amber: 1,
  green: 2,
};

export function categoryBudgetPriorityTier(usage: CategoryBudgetUsage): CategoryBudgetPriorityTier {
  if (usage.isZeroLimitOverspend || usage.usagePercent > BUDGET_AMBER_MAX_PERCENT) {
    return 'red';
  }
  if (usage.usagePercent > BUDGET_GREEN_MAX_PERCENT) {
    return 'amber';
  }
  return 'green';
}

export function categoryBudgetPrioritySortKey(usage: CategoryBudgetUsage): number {
  return PRIORITY_TIER_ORDER[categoryBudgetPriorityTier(usage)];
}

/** Budget category progress bar fill — delegates to {@link getBudgetStatus}. */
export function categoryBudgetBarColor(
  spent: number,
  allocated: number,
  _isLight?: boolean,
  _categoryTint?: string,
  _colors?: AppColors,
): string {
  return getBudgetStatus(spent, allocated).color;
}

/** Under-budget track color; undefined for green / amber / red tiers. */
export function categoryBudgetBarTrackColor(spent: number, allocated: number): string | undefined {
  if (getBudgetStatus(spent, allocated).percentage < BUDGET_GREEN_MAX_PERCENT) {
    return BUDGET_UNDER_BUDGET_TRACK_COLOR;
  }
  return undefined;
}

export function shouldShowCategoryStatusTag(usage: CategoryBudgetUsage): boolean {
  return usage.statusLabel !== null;
}

export function categoryStatusTagLabel(usage: CategoryBudgetUsage): string {
  return usage.statusLabel ?? '';
}

/** Bar fill opacity — under-budget gray is pre-muted via color alpha. */
export function categoryBudgetBarOpacity(_usage: CategoryBudgetUsage): number {
  return 1;
}

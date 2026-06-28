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

  const usagePercent =
    limit > 0
      ? Math.round((spentValue / limit) * 100)
      : isZeroLimitOverspend
        ? 100
        : 0;

  let statusLabel: string | null = null;
  if (isZeroLimitOverspend) {
    statusLabel = 'Budget dépassé';
  } else if (limit > 0 && isOverBudget) {
    statusLabel = 'Budget dépassé';
  } else if (limit > 0 && usagePercent >= 80) {
    statusLabel = 'Limite presque atteinte';
  }

  return {
    limit,
    spent: spentValue,
    progress,
    usagePercent,
    isZeroLimitOverspend,
    isOverBudget,
    statusLabel,
  };
}

/** Amber warning — 95–100 % usage. */
const BUDGET_WARNING_COLOR = '#FBBF24';
/** Muted red — over budget. */
const BUDGET_DANGER_COLOR = '#C96560';

/**
 * Budget category progress bar fill:
 * 0–94 % → green accent (#4ADE80), 95–100 % → amber, >100 % → muted red.
 * Category tint stays on the dot only — not the bar.
 */
export function categoryBudgetBarColor(
  usagePercent: number,
  isZeroLimitOverspend: boolean,
  _isLight: boolean,
  _categoryTint: string,
  colors: AppColors,
): string {
  if (isZeroLimitOverspend || usagePercent > 100) {
    return BUDGET_DANGER_COLOR;
  }
  if (usagePercent >= 95) {
    return BUDGET_WARNING_COLOR;
  }
  return colors.accentGreen;
}

import { formatDisplayMoneyAbsolute, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';

export type BudgetCashflowImpactMode = 'add' | 'edit';

export type BudgetCashflowImpactRow = {
  id: string;
  label: string;
  value: string;
  monetary?: boolean;
  emphasize?: boolean;
};

export type BudgetCashflowImpactInput = {
  /** Monthly limit for the category being added/edited; null when unset. */
  categoryLimit: number | null;
  /** Sum of monthly limits for all other active categories (exclude the edited one). */
  otherCategoriesAllocatedTotal: number;
  /** Onboarding / pay-estimation monthly average income, when known. */
  monthlyIncome: number | null;
  mode?: BudgetCashflowImpactMode;
};

export type BudgetCashflowImpactModel = {
  rows: BudgetCashflowImpactRow[];
  shareOfAllocated: number | null;
};

function formatPercent(ratio: number): string {
  const pct = Math.round(ratio * 1000) / 10;
  const whole = Math.abs(pct - Math.round(pct)) < 1e-6;
  return `${whole ? Math.round(pct) : pct.toFixed(1).replace('.', ',')} %`;
}

/**
 * Builds impact rows for the cashflow widget (add form + category detail).
 * Same math: projected total = other categories + this category limit.
 */
export function buildBudgetCashflowImpact(
  input: BudgetCashflowImpactInput,
): BudgetCashflowImpactModel {
  const mode = input.mode ?? 'add';
  const categoryAllocated = input.categoryLimit ?? 0;
  const projectedTotal = input.otherCategoriesAllocatedTotal + categoryAllocated;
  const monthlyIncome = input.monthlyIncome;
  const hasLimit = input.categoryLimit != null;

  const shareOfAllocated = !hasLimit
    ? null
    : monthlyIncome != null && monthlyIncome > 0
      ? projectedTotal / monthlyIncome
      : projectedTotal > 0
        ? categoryAllocated / projectedTotal
        : null;

  const cashflowRemainingAfter =
    hasLimit && monthlyIncome != null ? monthlyIncome - projectedTotal : null;

  const rows: BudgetCashflowImpactRow[] = [
    {
      id: 'category-impact',
      label: 'Impact sur le cashflow',
      value: hasLimit ? formatSignedDisplayMoney(-categoryAllocated) : '—',
      monetary: hasLimit,
      emphasize: hasLimit,
    },
  ];

  if (monthlyIncome != null && monthlyIncome > 0) {
    rows.push({
      id: 'monthly-income',
      label: 'Revenu moyen / mois',
      value: formatDisplayMoneyAbsolute(monthlyIncome),
      monetary: true,
    });
  }

  if (hasLimit) {
    rows.push({
      id: 'after',
      label: mode === 'edit' ? 'Budgets alloués' : 'Budgets après ajout',
      value: formatDisplayMoneyAbsolute(projectedTotal),
      monetary: true,
      emphasize: true,
    });
    if (shareOfAllocated != null) {
      rows.push({
        id: 'share',
        label: 'Part des budgets alloués',
        value: formatPercent(shareOfAllocated),
      });
    }
    if (cashflowRemainingAfter != null) {
      rows.push({
        id: 'cashflow-remaining',
        label: 'Cashflow restant',
        value: formatSignedDisplayMoney(cashflowRemainingAfter),
        monetary: true,
        emphasize: true,
      });
    }
  }

  return { rows, shareOfAllocated };
}

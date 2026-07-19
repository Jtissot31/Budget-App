/**
 * Budget feasibility for an extra debt payment — compares the monthly
 * equivalent of the extra to free cashflow (income − expenses).
 */

import { formatDisplayMoneyAbsolute, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import type { CategoryBudget } from '@/types';
import type { PlanDebtFeasibilitySnapshot } from './Plan';

export type DebtFeasibilityInput = {
  extraMonthly: number;
  cashflow: { monthlyIncome: number; monthlyExpenses: number } | null;
  budgets?: readonly CategoryBudget[];
  /** Monthly minimums already committed to selected debts (informational). */
  selectedMinimumsMonthly?: number;
};

/**
 * Surplus minimum pour recommander un remboursement accéléré (snowball, avalanche, etc.).
 * En dessous, Fyn priorise d’abord le rééquilibrage du budget — aligné sur le wizard Extra.
 */
export const MIN_SURPLUS_FOR_ACCELERATED_DEBT_PLAN = 25;

export function monthlySurplusFromCashflow(
  cashflow: { monthlyIncome: number; monthlyExpenses: number } | null | undefined,
): number {
  const income = Math.max(0, cashflow?.monthlyIncome ?? 0);
  const expenses = Math.max(0, cashflow?.monthlyExpenses ?? 0);
  return income - expenses;
}

/** True when the monthly surplus can absorb a small extra above minimums. */
export function isCashflowViableForAcceleratedDebtPlan(surplusMensuel: number): boolean {
  return surplusMensuel >= MIN_SURPLUS_FOR_ACCELERATED_DEBT_PLAN;
}

export function assessDebtExtraFeasibility(input: DebtFeasibilityInput): PlanDebtFeasibilitySnapshot {
  const extraMensuel = Math.max(0, input.extraMonthly);
  const income = Math.max(0, input.cashflow?.monthlyIncome ?? 0);
  const expenses = Math.max(0, input.cashflow?.monthlyExpenses ?? 0);
  const surplus = income - expenses;

  const suggestions: string[] = [];

  if (income <= 0) {
    return {
      realiste: false,
      surplus_mensuel: surplus,
      extra_mensuel: extraMensuel,
      message:
        'Revenus mensuels introuvables. Ajoute tes entrées pour vérifier si ce montant supplémentaire est réaliste.',
      suggestions: ['Enregistre tes revenus récents dans l’onglet Transactions.'],
    };
  }

  if (extraMensuel <= 0) {
    return {
      realiste: surplus >= 0,
      surplus_mensuel: surplus,
      extra_mensuel: 0,
      message:
        surplus >= 0
          ? 'Sans extra, tu restes sur les minimums — c’est viable, mais la date de liberté sera plus lointaine.'
          : `Même sans extra, tes dépenses dépassent tes revenus d’environ ${formatDisplayMoneyAbsolute(Math.abs(surplus))}/mois.`,
      suggestions:
        surplus > 0
          ? [
              `Ton surplus estimé est d’environ ${formatDisplayMoneyAbsolute(surplus)}/mois — tu peux en consacrer une partie en extra.`,
            ]
          : surplus < 0
            ? ['Rééquilibre d’abord ton budget tout en maintenant les paiements minimums.']
            : undefined,
    };
  }

  const overBudget = (input.budgets ?? [])
    .filter((b) => b.limitAmount > 0 && b.spent > b.limitAmount)
    .sort((a, b) => b.spent - b.limitAmount - (a.spent - a.limitAmount))
    .slice(0, 3);

  for (const budget of overBudget) {
    const overrun = budget.spent - budget.limitAmount;
    suggestions.push(
      `Réduis « ${budget.categoryName} » d’environ ${formatDisplayMoneyAbsolute(overrun)} ce mois.`,
    );
  }

  if (surplus >= extraMensuel) {
    const cushion = surplus - extraMensuel;
    return {
      realiste: true,
      surplus_mensuel: surplus,
      extra_mensuel: extraMensuel,
      message:
        cushion >= extraMensuel * 0.25
          ? `Oui — il te reste environ ${formatDisplayMoneyAbsolute(surplus)}/mois après tes dépenses. ${formatDisplayMoneyAbsolute(extraMensuel)} d’extra est réaliste.`
          : `C’est serré mais possible : surplus d’environ ${formatDisplayMoneyAbsolute(surplus)}/mois pour ${formatDisplayMoneyAbsolute(extraMensuel)} d’extra.`,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  const shortfall = extraMensuel - surplus;
  const suggestedExtra = Math.max(0, Math.floor(Math.max(surplus, 0)));

  if (suggestedExtra > 0) {
    suggestions.unshift(
      `Baisse l’extra à environ ${formatDisplayMoneyAbsolute(suggestedExtra)}/mois pour coller à ton surplus actuel.`,
    );
  } else {
    suggestions.unshift(
      `Il manque environ ${formatDisplayMoneyAbsolute(shortfall)}/mois — réduis des dépenses avant d’ajouter un extra.`,
    );
  }

  if (input.selectedMinimumsMonthly != null && input.selectedMinimumsMonthly > 0) {
    suggestions.push(
      `Tes minimums sélectionnés totalisent déjà ${formatDisplayMoneyAbsolute(input.selectedMinimumsMonthly)}/mois.`,
    );
  }

  return {
    realiste: false,
    surplus_mensuel: surplus,
    extra_mensuel: extraMensuel,
    message: `Non — ton surplus estimé (${formatSignedDisplayMoney(surplus)}/mois) ne couvre pas ${formatDisplayMoneyAbsolute(extraMensuel)} d’extra.`,
    suggestions,
  };
}

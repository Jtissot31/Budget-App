/**
 * Eligibility rules for accelerated debt payoff plans.
 * Pure helpers — no DB / React Native imports (safe for unit checks).
 */

import type { Loan } from '@/types';
import type { PlanDebtSelection, PlanDebtSource, PlanParametres } from './Plan';

export type AcceleratedDebtCandidateRef = {
  source: PlanDebtSource;
  loanType?: Loan['type'];
};

/**
 * RFA anonymized type for `Loan.type === 'mortgage'` (`mapLoanType` in sanitizeForAI).
 * Chat / plan insights must exclude the same debts as accelerated payoff plans.
 */
export const RFA_MORTGAGE_DEBT_TYPE = 'hypotheque' as const;

/**
 * Structured eligibility for accelerated debt plans.
 * Relies on `Loan.type` — not display labels.
 */
export function isLoanEligibleForAcceleratedDebtPlan(loan: Pick<Loan, 'type'>): boolean {
  return loan.type !== 'mortgage';
}

/** Same rule as `isLoanEligibleForAcceleratedDebtPlan`, for anonymized RFA debts. */
export function isRfaDebtEligibleForAcceleratedDebtPlan(debt: { type: string }): boolean {
  return debt.type !== RFA_MORTGAGE_DEBT_TYPE;
}

export function filterRfaDebtsEligibleForAcceleratedPlan<T extends { type: string }>(
  debts: readonly T[],
): T[] {
  return debts.filter(isRfaDebtEligibleForAcceleratedDebtPlan);
}

export function isDebtPlanCandidateEligibleForAcceleratedPlan(
  candidate: AcceleratedDebtCandidateRef,
): boolean {
  if (candidate.source === 'loan' && candidate.loanType === 'mortgage') return false;
  return true;
}

export function filterEligibleDebtPlanCandidates<T extends AcceleratedDebtCandidateRef>(
  candidates: readonly T[],
): T[] {
  return candidates.filter(isDebtPlanCandidateEligibleForAcceleratedPlan);
}

/**
 * Drops mortgage selections before projection / persistence.
 * Matches live loans by `loan:{id}` when `source === 'loan'`.
 * Existing plans may keep mortgages on disk for display; callers should only
 * use this for new calculations and newly created plan payloads.
 */
export function excludeMortgagesFromDebtSelections(
  selections: readonly PlanDebtSelection[],
  loans: readonly Pick<Loan, 'id' | 'type'>[],
): PlanDebtSelection[] {
  if (selections.length === 0) return [];
  const mortgageIds = new Set(
    loans.filter((loan) => !isLoanEligibleForAcceleratedDebtPlan(loan)).map((loan) => `loan:${loan.id}`),
  );
  if (mortgageIds.size === 0) return [...selections];
  return selections.filter((selection) => {
    if (selection.source !== 'loan') return true;
    return !mortgageIds.has(selection.id);
  });
}

/** Rebuild ordre 1..n after mortgage exclusion and refresh aggregate fields. */
export function sanitizeDebtParametresForAcceleratedPlan(
  parametres: PlanParametres,
  loans: readonly Pick<Loan, 'id' | 'type'>[],
): PlanParametres {
  const raw = parametres.dettes;
  if (!raw?.length) return parametres;
  const filtered = excludeMortgagesFromDebtSelections(raw, loans);
  if (filtered.length === raw.length) return parametres;

  const dettes = filtered
    .slice()
    .sort((a, b) => a.ordre - b.ordre)
    .map((debt, index) => ({ ...debt, ordre: index + 1 }));

  const solde = dettes.reduce((sum, d) => sum + d.solde, 0);
  const mins = dettes.reduce((sum, d) => sum + d.paiement_minimum, 0);
  const extraMonthly =
    parametres.extra_paiement != null && parametres.extra_paiement > 0
      ? parametres.extra_cadence === 'week'
        ? (parametres.extra_paiement * 52) / 12
        : parametres.extra_paiement
      : 0;

  return {
    ...parametres,
    dettes,
    solde_initial: solde,
    paiement_mensuel: mins + extraMonthly,
  };
}

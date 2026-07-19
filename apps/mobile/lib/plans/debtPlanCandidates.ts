/**
 * Resolves selectable debt items for the debt-plan wizard:
 * prêts/obligations (`getLoans`) + credit card balances (`getSimulatedAccounts`).
 *
 * Mortgages (`loan.type === 'mortgage'`) are never eligible for accelerated
 * payoff strategies — they stay on their long amortization schedule.
 */

import { creditUsedFromBalance } from '@/lib/creditLimitUtilization';
import { getLoans, getSimulatedAccounts } from '@/lib/db';
import { formatLoanObligationName, loanTypeBadgeLabel } from '@/lib/loanPresentation';
import { getPaymentsPerYear } from '@/lib/mortgageAmortization';
import type { Loan, LoanPaymentFrequency, LoanType, SimulatedAccount } from '@/types';
import type { DebtPayoffInput, DebtPayoffStrategy } from './debtPayoffMath';
import {
  filterEligibleDebtPlanCandidates,
  isDebtPlanCandidateEligibleForAcceleratedPlan,
  isLoanEligibleForAcceleratedDebtPlan,
} from './debtPlanEligibility';
import type { PlanDebtSelection, PlanDebtSource, PlanSubtype } from './Plan';

export type DebtPlanCandidate = {
  id: string;
  source: PlanDebtSource;
  label: string;
  subtitle: string;
  balance: number;
  annualRatePercent: number;
  minimumMonthly: number;
  /** Set for `source: 'loan'` — used to exclude mortgages defensively. */
  loanType?: LoanType;
};

export {
  excludeMortgagesFromDebtSelections,
  filterEligibleDebtPlanCandidates,
  filterRfaDebtsEligibleForAcceleratedPlan,
  isDebtPlanCandidateEligibleForAcceleratedPlan,
  isLoanEligibleForAcceleratedDebtPlan,
  isRfaDebtEligibleForAcceleratedDebtPlan,
  RFA_MORTGAGE_DEBT_TYPE,
  sanitizeDebtParametresForAcceleratedPlan,
} from './debtPlanEligibility';

const DEFAULT_CARD_APR = 19.99;

export function strategyForDebtSubtype(subtype: PlanSubtype): DebtPayoffStrategy {
  if (subtype === 'avalanche' || subtype === 'bombe_nucleaire' || subtype === 'marge_credit') {
    return 'avalanche';
  }
  return 'snowball';
}

export function usesDebtPayoffWizard(subtype: PlanSubtype): boolean {
  return (
    subtype === 'snowball' ||
    subtype === 'avalanche' ||
    subtype === 'bombe_nucleaire' ||
    subtype === 'consolidation' ||
    subtype === 'dette_individuelle' ||
    subtype === 'marge_credit'
  );
}

/** Convert a per-period loan payment into a monthly equivalent. */
export function loanPaymentToMonthly(
  paymentAmount: number,
  frequency: LoanPaymentFrequency,
): number {
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return 0;
  return (paymentAmount * getPaymentsPerYear(frequency)) / 12;
}

/**
 * Canadian-style revolving minimum estimate when the card has no stored payment:
 * greater of 10 $ or ~3 % of the outstanding balance.
 */
export function estimateCreditCardMinimumMonthly(balance: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  return Math.max(10, Math.round(balance * 0.03 * 100) / 100);
}

export function candidateFromLoan(loan: Loan): DebtPlanCandidate | null {
  if (!isLoanEligibleForAcceleratedDebtPlan(loan)) return null;
  const balance = Math.max(0, Number(loan.balanceRemaining) || 0);
  if (balance <= 0) return null;
  return {
    id: `loan:${loan.id}`,
    source: 'loan',
    label: formatLoanObligationName(loan),
    subtitle: loanTypeBadgeLabel(loan.type ?? 'personal_loan'),
    balance,
    annualRatePercent: Number.isFinite(loan.interestRate) ? loan.interestRate : 0,
    minimumMonthly: loanPaymentToMonthly(loan.monthlyPayment, loan.paymentFrequency ?? 'monthly'),
    loanType: loan.type,
  };
}

export function candidateFromCreditAccount(account: SimulatedAccount): DebtPlanCandidate | null {
  if (account.kind !== 'credit') return null;
  const balance = creditUsedFromBalance(account.balance);
  if (balance <= 0) return null;
  const rate =
    typeof account.interestRate === 'number' && account.interestRate > 0
      ? account.interestRate
      : DEFAULT_CARD_APR;
  return {
    id: `credit:${account.id}`,
    source: 'credit_card',
    label: account.name.trim() || 'Carte de crédit',
    subtitle: account.institution?.trim() || 'Carte de crédit',
    balance,
    annualRatePercent: rate,
    minimumMonthly: estimateCreditCardMinimumMonthly(balance),
  };
}

export async function loadDebtPlanCandidates(): Promise<DebtPlanCandidate[]> {
  const [loans, accounts] = await Promise.all([getLoans(), getSimulatedAccounts()]);
  const fromLoans = loans.map(candidateFromLoan).filter((c): c is DebtPlanCandidate => c != null);
  const fromCards = accounts
    .map(candidateFromCreditAccount)
    .filter((c): c is DebtPlanCandidate => c != null);
  return filterEligibleDebtPlanCandidates([...fromLoans, ...fromCards]).sort(
    (a, b) => b.balance - a.balance,
  );
}

export function candidateToPayoffInput(candidate: DebtPlanCandidate): DebtPayoffInput | null {
  if (!isDebtPlanCandidateEligibleForAcceleratedPlan(candidate)) return null;
  return {
    id: candidate.id,
    balance: candidate.balance,
    annualRatePercent: candidate.annualRatePercent,
    minimumMonthly: Math.max(candidate.minimumMonthly, 0),
  };
}

export function toPlanDebtSelection(
  candidate: DebtPlanCandidate,
  ordre: number,
): PlanDebtSelection | null {
  if (!isDebtPlanCandidateEligibleForAcceleratedPlan(candidate)) return null;
  return {
    id: candidate.id,
    source: candidate.source,
    label: candidate.label,
    solde: candidate.balance,
    taux_interet: candidate.annualRatePercent,
    paiement_minimum: candidate.minimumMonthly,
    ordre,
  };
}

export function createManualDebtCandidate(input: {
  label: string;
  balance: number;
  annualRatePercent: number;
  minimumMonthly: number;
}): DebtPlanCandidate {
  return {
    id: 'manual:draft',
    source: 'manual',
    label: input.label.trim() || 'Dette manuelle',
    subtitle: 'Saisie manuelle',
    balance: Math.max(0, input.balance),
    annualRatePercent: Math.max(0, input.annualRatePercent),
    minimumMonthly: Math.max(0, input.minimumMonthly),
  };
}

import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import type { Loan, LoanDurationUnit, LoanPaymentFrequency, LoanType } from '@/types';

export const MORTGAGE_DEFAULT_REASON = 'Maison';
export const MORTGAGE_DEFAULT_NAME = 'Hypothèque Maison';

export function loanTypeLabel(type: LoanType) {
  if (type === 'friend_debt') return 'Dette à un particulier';
  if (type === 'line_of_credit') return 'Marge de crédit';
  if (type === 'mortgage') return 'Hypothèque';
  return 'Prêt personnel';
}

/** Compact type label shown in list rows alongside the formatted title. */
export function loanTypeBadgeLabel(type: LoanType) {
  if (type === 'friend_debt') return 'Dette particulier';
  if (type === 'line_of_credit') return 'Marge de crédit';
  if (type === 'mortgage') return 'Hypothèque';
  return 'Prêt personnel';
}

export function resolveLoanReason(loan: Pick<Loan, 'type' | 'reason' | 'name' | 'lender'>): string {
  const trimmedReason = loan.reason?.trim();
  if (trimmedReason) return trimmedReason;

  const type = loan.type ?? 'personal_loan';
  const name = loan.name?.trim() ?? '';
  const lender = loan.lender?.trim() ?? '';
  const typeLabel = loanTypeLabel(type);

  if (type === 'mortgage') {
    if (name === MORTGAGE_DEFAULT_NAME) return MORTGAGE_DEFAULT_REASON;
    if (name.startsWith(`${typeLabel} `)) {
      return name.slice(typeLabel.length + 1).trim() || MORTGAGE_DEFAULT_REASON;
    }
    return name || MORTGAGE_DEFAULT_REASON;
  }

  if (name.startsWith(`${typeLabel} `)) {
    let remainder = name.slice(typeLabel.length + 1).trim();
    if (lender && remainder.endsWith(` ${lender}`)) {
      remainder = remainder.slice(0, -(lender.length + 1)).trim();
    }
    if (remainder) return remainder;
  }

  if (type === 'personal_loan' && name.startsWith('Prêt ')) {
    let remainder = name.slice('Prêt '.length).trim();
    if (lender && remainder.endsWith(` ${lender}`)) {
      remainder = remainder.slice(0, -(lender.length + 1)).trim();
    }
    if (remainder) return remainder;
  }

  if (type === 'friend_debt') {
    if (name.startsWith('Dette – ')) return name.slice('Dette – '.length).trim();
    if (name.startsWith(`${typeLabel} `)) return name.slice(typeLabel.length + 1).trim();
  }

  if (type !== 'friend_debt' && name && name !== lender) return name;
  return '';
}

/** `{typeLabel} {reason} {lender?}` with compact personal-loan titles when a reason is set. */
export function formatLoanDisplayTitle(loan: Pick<Loan, 'type' | 'reason' | 'name' | 'lender'>): string {
  const type = loan.type ?? 'personal_loan';
  const reason = resolveLoanReason(loan);
  const lender = loan.lender?.trim() ?? '';
  const typeLabel = loanTypeLabel(type);

  if (type === 'mortgage') {
    return `${typeLabel} ${reason || MORTGAGE_DEFAULT_REASON}`.trim();
  }

  if (type === 'friend_debt') {
    const parts = [typeLabel];
    if (reason) parts.push(reason);
    return parts.join(' ');
  }

  let typePart = typeLabel;
  if (type === 'personal_loan' && reason) {
    typePart = 'Prêt';
  }

  const parts = [typePart];
  if (reason) parts.push(reason);
  if (lender) parts.push(lender);
  return parts.join(' ');
}

export function loanPaymentFrequencyLabel(frequency: LoanPaymentFrequency) {
  if (frequency === 'weekly') return 'Hebdomadaire';
  if (frequency === 'biweekly') return 'Aux 2 semaines';
  return 'Mensuel';
}

export function loanPaymentFrequencyShort(frequency: LoanPaymentFrequency) {
  if (frequency === 'weekly') return 'sem.';
  if (frequency === 'biweekly') return '2 sem.';
  return 'mois';
}

export function formatLoanDebtAmount(value: number) {
  const abs = Math.abs(value);
  if (abs === 0) return formatDisplayMoneyAbsolute(0);
  return `−${formatDisplayMoneyAbsolute(abs)}`;
}

export function formatLoanDate(dateKey: string) {
  const trimmed = dateKey?.trim();
  if (!trimmed) return '—';
  const date = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(date.getTime())) return trimmed;
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatLoanDuration(amount: number, unit: LoanDurationUnit, type: LoanType) {
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  if (type === 'mortgage' || unit === 'years') {
    return `${amount} ${amount > 1 ? 'ans' : 'an'}`;
  }
  return `${amount} mois`;
}

export function loanLenderLabel(type: LoanType) {
  if (type === 'friend_debt') return 'Créancier';
  if (type === 'line_of_credit') return 'Institution';
  if (type === 'mortgage') return 'Prêteur';
  return 'Prêteur';
}

export function loanPrincipalLabel(type: LoanType) {
  if (type === 'line_of_credit') return 'Limite';
  if (type === 'mortgage') return 'Montant de l’emprunt';
  return 'Montant emprunté';
}

export function loanBalanceLabel(type: LoanType) {
  if (type === 'line_of_credit') return 'Solde utilisé';
  return 'Solde restant';
}

export function computeLoanRepaymentProgress(loan: {
  principal: number;
  balanceRemaining: number;
}) {
  const paidAmount = Math.max(loan.principal - loan.balanceRemaining, 0);
  const progressPct =
    loan.principal > 0 ? Math.min((paidAmount / loan.principal) * 100, 100) : 0;
  return { paidAmount, progressPct };
}

export function loanProgressLabel(type: LoanType) {
  if (type === 'mortgage') return 'Équité';
  return 'Remboursé';
}

export function loanProgressHeaderLabel(isEquity: boolean) {
  return isEquity ? 'Équité' : 'Remboursé';
}

export function formatLoanPaymentObligation(
  monthlyPayment: number,
  frequency: LoanPaymentFrequency,
) {
  if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0) return null;
  return `${formatDisplayMoneyAbsolute(monthlyPayment)} / ${loanPaymentFrequencyShort(frequency)}`;
}

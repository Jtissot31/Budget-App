import { EMPTY_DETAIL_VALUE } from '@/lib/detailDisplay';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { getPaymentsPerYear } from '@/lib/mortgageAmortization';
import type { Loan, LoanDurationUnit, LoanPaymentFrequency, LoanType } from '@/types';

export const MORTGAGE_DEFAULT_REASON = 'Maison';
export const MORTGAGE_DEFAULT_NAME = 'Hypothèque Maison';

export const CHILD_SUPPORT_BENEFICIARY_LABEL = 'Nom du bénéficiaire';
export const CHILD_SUPPORT_BENEFICIARY_PLACEHOLDER = 'Nom du parent receveur';
export const CHILD_SUPPORT_BENEFICIARY_HINT =
  'Personne qui reçoit la pension (ex. mère ou père gardien).';

/** Title-case beneficiary names for card and detail display (handles legacy `à` prefix). */
export function formatChildSupportBeneficiaryDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const withoutDirectedPrefix = trimmed.replace(/^à\s+/i, '');

  return withoutDirectedPrefix
    .split(/\s+/)
    .map((word) =>
      word
        .split('-')
        .map((part) => part.charAt(0).toLocaleUpperCase('fr-FR') + part.slice(1).toLocaleLowerCase('fr-FR'))
        .join('-'),
    )
    .join(' ');
}

export function loanTypeLabel(type: LoanType) {
  if (type === 'friend_debt') return 'Dette à un particulier';
  if (type === 'line_of_credit') return 'Marge de crédit';
  if (type === 'mortgage') return 'Hypothèque';
  if (type === 'child_support') return 'Pension alimentaire';
  return 'Prêt personnel';
}

/** Compact type label shown in list rows alongside the formatted title. */
export function loanTypeBadgeLabel(type: LoanType) {
  if (type === 'friend_debt') return 'Dette particulier';
  if (type === 'line_of_credit') return 'Marge de crédit';
  if (type === 'mortgage') return 'Hypothèque';
  if (type === 'child_support') return 'Pension alimentaire';
  return 'Prêt personnel';
}

function stripTrailingLender(value: string, lender: string): string {
  const trimmed = value.trim();
  if (!lender) return trimmed;
  if (trimmed.localeCompare(lender, 'fr', { sensitivity: 'accent' }) === 0) return '';
  if (trimmed.toLocaleLowerCase('fr').endsWith(` ${lender.toLocaleLowerCase('fr')}`)) {
    return trimmed.slice(0, -(lender.length + 1)).trim();
  }
  return trimmed;
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
      return (
        stripTrailingLender(name.slice(typeLabel.length + 1), lender) || MORTGAGE_DEFAULT_REASON
      );
    }
    return stripTrailingLender(name, lender) || MORTGAGE_DEFAULT_REASON;
  }

  if (name.startsWith(`${typeLabel} `)) {
    const remainder = stripTrailingLender(name.slice(typeLabel.length + 1), lender);
    if (remainder) return remainder;
  }

  if (type === 'personal_loan' && name.startsWith('Prêt ')) {
    const remainder = stripTrailingLender(name.slice('Prêt '.length), lender);
    if (remainder) return remainder;
  }

  if (type === 'friend_debt') {
    if (name.startsWith('Dette – ')) return name.slice('Dette – '.length).trim();
    if (name.startsWith(`${typeLabel} `)) return name.slice(typeLabel.length + 1).trim();
  }

  if (type === 'child_support' && name.startsWith(`${typeLabel} `)) {
    return name.slice(typeLabel.length + 1).trim();
  }

  if (type !== 'friend_debt' && name && name !== lender) {
    const stripped = stripTrailingLender(
      name.startsWith(`${typeLabel} `) ? name.slice(typeLabel.length + 1) : name,
      lender,
    );
    if (stripped && stripped !== typeLabel) return stripped;
  }
  return '';
}

/**
 * List-row obligation name under a type badge — purpose only
 * (ex. Maison, Auto, Rénovations). Never repeats type or lender.
 */
export function formatLoanObligationName(
  loan: Pick<Loan, 'type' | 'reason' | 'name' | 'lender'>,
): string {
  const type = loan.type ?? 'personal_loan';
  const reason = resolveLoanReason(loan);
  if (reason) return reason;

  const lender = loan.lender?.trim() ?? '';
  if (lender) return lender;

  if (type === 'mortgage') return MORTGAGE_DEFAULT_REASON;
  return loanTypeLabel(type);
}

/** `{typeLabel} {reason} {lender?}` with compact personal-loan titles when a reason is set. */
/** Normalizes person-targeted payment labels for alerts and lists (legacy names included). */
export function formatPersonDirectedPaymentLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const childSupportPrefix = 'Pension alimentaire ';
  if (trimmed.startsWith(childSupportPrefix) && !trimmed.includes(' à ')) {
    const beneficiary = trimmed.slice(childSupportPrefix.length).trim();
    if (beneficiary) return `${childSupportPrefix}à ${beneficiary}`;
  }

  const friendDebtPrefix = 'Dette à un particulier ';
  if (trimmed.startsWith(friendDebtPrefix) && !trimmed.slice(friendDebtPrefix.length).startsWith('à ')) {
    const creditor = trimmed.slice(friendDebtPrefix.length).trim();
    if (creditor) return `${friendDebtPrefix}à ${creditor}`;
  }

  return trimmed;
}

export function formatLoanDisplayTitle(loan: Pick<Loan, 'type' | 'reason' | 'name' | 'lender'>): string {
  const type = loan.type ?? 'personal_loan';
  const reason = resolveLoanReason(loan);
  const lender = loan.lender?.trim() ?? '';
  const typeLabel = loanTypeLabel(type);

  if (type === 'mortgage') {
    return `${typeLabel} ${reason || MORTGAGE_DEFAULT_REASON}`.trim();
  }

  if (type === 'friend_debt' || type === 'child_support') {
    const parts = [typeLabel];
    if (reason) parts.push(`à ${reason}`);
    return parts.join(' ');
  }

  let typePart = typeLabel;
  if (type === 'personal_loan' && reason) {
    typePart = 'Prêt';
  }

  const parts = [typePart];
  if (reason) parts.push(reason);
  // Skip lender when it already is (or equals) the purpose — avoids "Desjardins Desjardins".
  if (lender && reason.localeCompare(lender, 'fr', { sensitivity: 'accent' }) !== 0) {
    parts.push(lender);
  }
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
  if (!trimmed) return EMPTY_DETAIL_VALUE;
  const date = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(date.getTime())) return trimmed;
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatLoanDuration(amount: number, unit: LoanDurationUnit, type: LoanType) {
  if (!Number.isFinite(amount) || amount <= 0) return EMPTY_DETAIL_VALUE;
  if (type === 'mortgage' || unit === 'years') {
    return `${amount} ${amount > 1 ? 'ans' : 'an'}`;
  }
  return `${amount} mois`;
}

export function loanLenderLabel(type: LoanType) {
  if (type === 'friend_debt') return 'Créancier';
  if (type === 'child_support') return CHILD_SUPPORT_BENEFICIARY_LABEL;
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
  if (type === 'child_support') return 'Total mensuel';
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

export function formatLoanInterestRateLabel(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return `${rate} %`;
}

function parseLoanDateKey(dateKey?: string | null) {
  const trimmed = dateKey?.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonthsClamped(date: Date, months: number) {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, daysInMonth));
  next.setHours(12, 0, 0, 0);
  return next;
}

function addPaymentPeriodsFromDate(start: Date, periods: number, frequency: LoanPaymentFrequency) {
  if (frequency === 'monthly') return addMonthsClamped(start, periods);
  const next = new Date(start);
  const daysPerPeriod = frequency === 'biweekly' ? 14 : 7;
  next.setDate(next.getDate() + periods * daysPerPeriod);
  next.setHours(12, 0, 0, 0);
  return next;
}

/** Remaining payment periods until balance reaches zero (from current balance). */
export function computeEstimatedLoanPayoffPeriods(
  loan: Pick<Loan, 'balanceRemaining' | 'monthlyPayment' | 'interestRate' | 'paymentFrequency'>,
) {
  const balance = Math.max(loan.balanceRemaining, 0);
  if (balance <= 0) return 0;

  const payment = loan.monthlyPayment;
  if (!Number.isFinite(payment) || payment <= 0) return null;

  const paymentsPerYear = getPaymentsPerYear(loan.paymentFrequency);
  const periodicRate =
    Number.isFinite(loan.interestRate) && loan.interestRate > 0
      ? loan.interestRate / 100 / paymentsPerYear
      : 0;

  if (periodicRate <= 0) return Math.ceil(balance / payment);

  let remaining = balance;
  let periods = 0;
  const maxPeriods = Math.ceil(100 * paymentsPerYear);

  while (remaining > 0.005 && periods < maxPeriods) {
    const interestPaid = remaining * periodicRate;
    if (payment <= interestPaid) return null;
    const principalPaid = Math.min(payment - interestPaid, remaining);
    remaining = Math.max(remaining - principalPaid, 0);
    periods += 1;
  }

  return periods >= maxPeriods ? null : periods;
}

export function computeEstimatedLoanEndDate(
  loan: Pick<
    Loan,
    | 'balanceRemaining'
    | 'monthlyPayment'
    | 'interestRate'
    | 'paymentFrequency'
    | 'nextPaymentDate'
    | 'startDate'
    | 'endDate'
  >,
) {
  const balance = Math.max(loan.balanceRemaining, 0);
  if (balance <= 0) return new Date();

  const periods = computeEstimatedLoanPayoffPeriods(loan);
  if (periods == null) return parseLoanDateKey(loan.endDate);
  if (periods === 0) return new Date();

  const anchor =
    parseLoanDateKey(loan.nextPaymentDate) ?? parseLoanDateKey(loan.startDate) ?? new Date();
  anchor.setHours(12, 0, 0, 0);
  return addPaymentPeriodsFromDate(anchor, periods, loan.paymentFrequency);
}

export function formatEstimatedLoanEndDate(date: Date | null | undefined) {
  if (!date || Number.isNaN(date.getTime())) return null;
  const formatted = date.toLocaleDateString('fr-FR', {
    month: 'short',
    year: 'numeric',
  });
  if (!formatted) return null;
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

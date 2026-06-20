import { nextCreditDueDate } from '@/lib/creditDueDate';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { getPaymentsPerYear } from '@/lib/mortgageAmortization';
import { normalizeSearch } from '@/lib/categoryInference';
import type {
  ChildSupportBeneficiaryRelation,
  Loan,
  LoanPaymentDebitType,
  LoanPaymentFrequency,
} from '@/types';

/** Destinataire officiel pour retenue à la source (ordre du tribunal). */
export const CHILD_SUPPORT_RECIPIENT_REVENU_QUEBEC = 'Revenu Québec';

export type ChildSupportPaymentMode = 'court_automatic' | 'private_manual';

export const CHILD_SUPPORT_PAYMENT_MODES: { id: LoanPaymentDebitType; label: string; description: string }[] = [
  {
    id: 'automatic',
    label: 'Revenu Québec (ordre du tribunal)',
    description: 'Retenue automatique sur ta paie par l’employeur.',
  },
  {
    id: 'manual',
    label: 'Accord privé',
    description: 'Tu effectues les paiements toi-même.',
  },
];

export const CHILD_SUPPORT_BENEFICIARY_RELATIONS: { id: ChildSupportBeneficiaryRelation; label: string }[] = [
  { id: 'mother', label: 'Mère' },
  { id: 'father', label: 'Père' },
];

export const CHILD_SUPPORT_PRIVATE_PROOF_REMINDER =
  'Garde des preuves de paiement (relevés, virements, reçus).';

export const CHILD_SUPPORT_QUICK_PAYMENT_DAYS = [1, 5, 10, 15, 20, 25, 28] as const;

export interface ChildSupportFields {
  baseMonthly: number;
  specialFeesMonthly: number;
  paymentDay: number;
  indexationDate: string | null;
  paymentMode: LoanPaymentDebitType;
  beneficiaryRelation: ChildSupportBeneficiaryRelation | null;
  totalMonthly: number;
}

export type ChildSupportSalaryNotice = {
  variant: 'info' | 'warning';
  title: string;
  message: string;
};

export function isChildSupportLoan(loan: Pick<Loan, 'type'>): boolean {
  return (loan.type ?? 'personal_loan') === 'child_support';
}

export function toChildSupportPaymentMode(debitType: LoanPaymentDebitType | null | undefined): ChildSupportPaymentMode {
  return debitType === 'manual' ? 'private_manual' : 'court_automatic';
}

export function fromChildSupportPaymentMode(mode: ChildSupportPaymentMode): LoanPaymentDebitType {
  return mode === 'private_manual' ? 'manual' : 'automatic';
}

export function isCourtAutomaticChildSupport(loan: Pick<Loan, 'type' | 'paymentDebitType'>): boolean {
  return isChildSupportLoan(loan) && (loan.paymentDebitType ?? 'automatic') === 'automatic';
}

export function isPrivateManualChildSupport(loan: Pick<Loan, 'type' | 'paymentDebitType'>): boolean {
  return isChildSupportLoan(loan) && loan.paymentDebitType === 'manual';
}

export function formatChildSupportBeneficiaryRelation(
  relation: ChildSupportBeneficiaryRelation | null | undefined,
): string | null {
  if (relation === 'mother') return 'Mère';
  if (relation === 'father') return 'Père';
  return null;
}

export function parseChildSupportBeneficiaryRelation(
  value?: string | null,
): ChildSupportBeneficiaryRelation | null {
  const normalized = normalizeSearch(value ?? '');
  if (normalized === 'mere' || normalized === 'mother') return 'mother';
  if (normalized === 'pere' || normalized === 'father') return 'father';
  return null;
}

export function resolveChildSupportBeneficiaryLabel(loan: Pick<Loan, 'type' | 'reason' | 'beneficiaryRelation'>): string {
  const relationLabel = formatChildSupportBeneficiaryRelation(loan.beneficiaryRelation);
  if (relationLabel) return relationLabel;
  return loan.reason?.trim() ?? '';
}

export function formatChildSupportRecipientLabel(loan: Pick<Loan, 'type' | 'paymentDebitType' | 'lender'>): string | null {
  if (!isChildSupportLoan(loan)) return null;
  if (isCourtAutomaticChildSupport(loan)) return CHILD_SUPPORT_RECIPIENT_REVENU_QUEBEC;
  const lender = loan.lender?.trim();
  return lender || 'Accord privé';
}

function dayFromDateKey(dateKey?: string | null): number | null {
  const trimmed = dateKey?.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDate();
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Maps stored loan columns back to pension alimentaire form fields. */
export function parseChildSupportFromLoan(loan: Loan): ChildSupportFields {
  const paymentMode = loan.paymentDebitType ?? 'automatic';
  const indexationDate = loan.renewalDate?.trim() || null;
  const hasStoredPaymentDay = loan.durationAmount >= 1 && loan.durationAmount <= 31;
  const hasStoredFees = loan.downPayment != null;
  const baseInPrincipal =
    loan.principal > 0 && loan.monthlyPayment > 0 && loan.principal <= loan.monthlyPayment;
  const beneficiaryRelation =
    loan.beneficiaryRelation ?? parseChildSupportBeneficiaryRelation(loan.reason);

  if (hasStoredPaymentDay || hasStoredFees || baseInPrincipal) {
    const baseMonthly = loan.principal > 0 ? loan.principal : loan.monthlyPayment;
    const specialFeesMonthly = Math.max(loan.downPayment ?? 0, 0);
    const paymentDay = hasStoredPaymentDay
      ? loan.durationAmount
      : (dayFromDateKey(loan.nextPaymentDate) ?? 1);

    return {
      baseMonthly,
      specialFeesMonthly,
      paymentDay,
      indexationDate,
      paymentMode,
      beneficiaryRelation,
      totalMonthly: baseMonthly + specialFeesMonthly,
    };
  }

  return {
    baseMonthly: loan.monthlyPayment,
    specialFeesMonthly: 0,
    paymentDay: dayFromDateKey(loan.nextPaymentDate) ?? 1,
    indexationDate,
    paymentMode,
    beneficiaryRelation,
    totalMonthly: loan.monthlyPayment,
  };
}

export function computeNextChildSupportPaymentDate(paymentDay: number, today = new Date()): string {
  const day = Math.min(Math.max(Math.trunc(paymentDay), 1), 31);
  return formatDateKey(nextCreditDueDate(day, today));
}

export function formatChildSupportPaymentDay(day: number): string {
  const normalized = Math.trunc(day);
  if (normalized === 1) return '1er';
  return String(normalized);
}

export function formatChildSupportPaymentDayLabel(day: number): string {
  return `Le ${formatChildSupportPaymentDay(day)} du mois`;
}

export function formatChildSupportPaymentMode(mode: LoanPaymentDebitType | null | undefined): string | null {
  if (mode === 'automatic') return 'Revenu Québec (ordre du tribunal)';
  if (mode === 'manual') return 'Accord privé';
  return null;
}

export function shouldSyncChildSupportRecurringPayment(loan: Pick<Loan, 'type' | 'paymentDebitType'>): boolean {
  if (!isChildSupportLoan(loan)) return true;
  return isPrivateManualChildSupport(loan);
}

export function getChildSupportLoansForSalaryAccount(loans: readonly Loan[], accountId?: string | null): Loan[] {
  const trimmed = accountId?.trim();
  if (!trimmed) return [];
  return loans.filter(
    (loan) => isChildSupportLoan(loan) && loan.paymentAccountId.trim() === trimmed,
  );
}

const SALARY_INCOME_KEYWORDS = [
  'salaire',
  'paie',
  'paye',
  'payroll',
  'employeur',
  'employe',
  'travail',
  'depot direct',
  'direct deposit',
  'depot salaire',
] as const;

export function isLikelySalaryIncomeText(...parts: Array<string | null | undefined>): boolean {
  const combined = normalizeSearch(parts.filter(Boolean).join(' '));
  if (!combined) return false;
  return SALARY_INCOME_KEYWORDS.some((term) => combined.includes(term));
}

export function getChildSupportSalaryNotices(
  loans: readonly Loan[],
  accountId: string | undefined,
  label: string,
  incomeReason?: string | null,
): ChildSupportSalaryNotice[] {
  if (!isLikelySalaryIncomeText(label, incomeReason)) return [];

  const linked = getChildSupportLoansForSalaryAccount(loans, accountId);
  if (linked.length === 0) return [];

  return linked.flatMap((loan) => {
    const beneficiary = resolveChildSupportBeneficiaryLabel(loan);
    const amount = formatChildSupportTotalMonthly(loan);
    if (!amount) return [];

    if (isCourtAutomaticChildSupport(loan)) {
      return [
        {
          variant: 'info' as const,
          title: 'Pension déjà retenue',
          message: `La pension alimentaire (${amount}) est retenue par Revenu Québec sur ta paie${beneficiary ? ` pour ${beneficiary}` : ''}. Entre le montant net déposé sur ton compte.`,
        },
      ];
    }

    if (isPrivateManualChildSupport(loan)) {
      return [
        {
          variant: 'warning' as const,
          title: 'Pension alimentaire',
          message: `N'oublie pas de payer la pension alimentaire${beneficiary ? ` à ${beneficiary}` : ''} (${amount}). ${CHILD_SUPPORT_PRIVATE_PROOF_REMINDER}`,
        },
      ];
    }

    return [];
  });
}

export function childSupportTotalMonthly(loan: Loan): number {
  if (!isChildSupportLoan(loan)) return loan.monthlyPayment;
  const fields = parseChildSupportFromLoan(loan);
  return fields.totalMonthly;
}

export function formatChildSupportTotalMonthly(loan: Loan): string | null {
  const total = childSupportTotalMonthly(loan);
  if (!Number.isFinite(total) || total <= 0) return null;
  return formatDisplayMoneyAbsolute(total);
}

/** Portfolio card: total mensuel uniquement, toujours avec le suffixe / mois. */
export function formatChildSupportMonthlyCardAmount(loan: Loan): string | null {
  const formatted = formatChildSupportTotalMonthly(loan);
  if (!formatted) return null;
  return `${formatted} / mois`;
}

function childSupportFrequencySuffix(frequency: LoanPaymentFrequency): string {
  return frequency === 'monthly' ? 'mois' : 'paie';
}

/** Montant dû par période (mensuel ou par paie selon la fréquence enregistrée). */
export function childSupportPaymentPeriodAmount(loan: Loan): number {
  const totalMonthly = childSupportTotalMonthly(loan);
  const frequency = loan.paymentFrequency ?? 'monthly';
  if (frequency === 'monthly') return totalMonthly;
  return (totalMonthly * 12) / getPaymentsPerYear(frequency);
}

export function formatChildSupportPaymentAmount(loan: Loan): string | null {
  const amount = childSupportPaymentPeriodAmount(loan);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const frequency = loan.paymentFrequency ?? 'monthly';
  return `${formatDisplayMoneyAbsolute(amount)} / ${childSupportFrequencySuffix(frequency)}`;
}

export function childSupportPaymentDay(loan: Loan): number | null {
  if (!isChildSupportLoan(loan)) return null;
  const day = parseChildSupportFromLoan(loan).paymentDay;
  return day >= 1 && day <= 31 ? day : null;
}

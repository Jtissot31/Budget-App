import type { DetailSection } from '@/components/DetailSectionRows';
import { EMPTY_DETAIL_VALUE } from '@/lib/detailDisplay';
import {
  formatChildSupportPaymentDayLabel,
  formatChildSupportPaymentMode,
  formatChildSupportRecipientLabel,
  formatChildSupportTotalMonthly,
  parseChildSupportFromLoan,
  resolveChildSupportBeneficiaryLabel,
} from '@/lib/childSupportLoan';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import {
  CHILD_SUPPORT_BENEFICIARY_LABEL,
  formatLoanDate,
  formatLoanDebtAmount,
  formatLoanDuration,
  loanLenderLabel,
  loanPaymentFrequencyLabel,
  resolveLoanReason,
} from '@/lib/loanPresentation';
import { frequencyLabel } from '@/lib/recurringPaymentsForm';
import type { Loan, RecurringPayment, SimulatedAccount } from '@/types';

function paymentAccountLabel(paymentAccount: SimulatedAccount | null): string {
  if (!paymentAccount) return EMPTY_DETAIL_VALUE;
  return paymentAccount.last4
    ? `${paymentAccount.name} · ${paymentAccount.last4}`
    : paymentAccount.name;
}

function rateTermLabel(loan: Loan): string {
  const rateTermYears = loan.rateTermYears;
  if (typeof rateTermYears === 'number' && rateTermYears > 0) {
    return `${rateTermYears} ${rateTermYears > 1 ? 'ans' : 'an'}`;
  }
  return EMPTY_DETAIL_VALUE;
}

function rateTypeLabel(loan: Loan): string {
  if (loan.rateType === 'fixed') return 'Fixe';
  if (loan.rateType === 'variable') return 'Variable';
  return EMPTY_DETAIL_VALUE;
}

function paymentDebitLabel(loan: Loan): string {
  if (loan.paymentDebitType === 'automatic') return 'Automatique';
  if (loan.paymentDebitType === 'manual') return 'Manuel';
  return EMPTY_DETAIL_VALUE;
}

function buildPaymentRows(
  loan: Loan,
  paymentAccount: SimulatedAccount | null,
  recurringPayment: RecurringPayment | null,
): DetailSection['rows'] {
  const rows: DetailSection['rows'] = [];

  if (loan.monthlyPayment > 0) {
    rows.push({
      label: 'Montant',
      value: formatDisplayMoneyAbsolute(loan.monthlyPayment),
      icon: 'cash-outline',
    });
  }

  if (loan.paymentFrequency) {
    rows.push({
      label: 'Fréquence',
      value: loanPaymentFrequencyLabel(loan.paymentFrequency),
      icon: 'calendar-outline',
    });
  }

  if (loan.nextPaymentDate.trim()) {
    rows.push({
      label: 'Prochaine date',
      value: formatLoanDate(loan.nextPaymentDate),
      icon: 'alarm-outline',
    });
  }

  if (loan.paymentDebitType) {
    rows.push({
      label: 'Prélèvement',
      value: paymentDebitLabel(loan),
      icon: 'repeat-outline',
    });
  }

  if (paymentAccount) {
    rows.push({
      label: 'Compte débité',
      value: paymentAccountLabel(paymentAccount),
      icon: 'card-outline',
    });
  }

  if (recurringPayment) {
    rows.push({
      label: 'Paiement récurrent',
      value: `${frequencyLabel(recurringPayment.frequency)}${recurringPayment.active ? '' : ' · inactif'}`,
      icon: 'sync-outline',
    });
  }

  return rows;
}

function buildMortgageSections(
  loan: Loan,
  paymentAccount: SimulatedAccount | null,
): DetailSection[] {
  return [
    {
      title: 'Prêt',
      rows: [
        {
          label: 'Montant emprunté',
          value: loan.principal > 0 ? formatDisplayMoneyAbsolute(loan.principal) : EMPTY_DETAIL_VALUE,
          icon: 'home-outline',
        },
        {
          label: 'Mise de fonds',
          value:
            typeof loan.downPayment === 'number'
              ? formatDisplayMoneyAbsolute(loan.downPayment)
              : EMPTY_DETAIL_VALUE,
          icon: 'cash-outline',
        },
        {
          label: 'Solde restant',
          value: formatLoanDebtAmount(loan.balanceRemaining),
          icon: 'wallet-outline',
        },
      ],
    },
    {
      title: 'Taux',
      rows: [
        {
          label: 'Taux d’intérêt',
          value: loan.interestRate > 0 ? `${loan.interestRate} %` : EMPTY_DETAIL_VALUE,
          icon: 'trending-up-outline',
        },
        {
          label: 'Type de taux',
          value: rateTypeLabel(loan),
          icon: 'swap-horizontal-outline',
        },
        {
          label: 'Période du taux',
          value: rateTermLabel(loan),
          icon: 'timer-outline',
        },
        {
          label: 'Renouvellement',
          value: loan.renewalDate?.trim() ? formatLoanDate(loan.renewalDate) : EMPTY_DETAIL_VALUE,
          icon: 'refresh-outline',
        },
      ],
    },
    {
      title: 'Paiements',
      rows: buildPaymentRows(loan, paymentAccount, null),
    },
  ];
}

function buildPersonalLoanSections(
  loan: Loan,
  paymentAccount: SimulatedAccount | null,
  recurringPayment: RecurringPayment | null,
): DetailSection[] {
  const reason = resolveLoanReason(loan);
  const pretRows: DetailSection['rows'] = [
    {
      label: 'Montant emprunté',
      value: loan.principal > 0 ? formatDisplayMoneyAbsolute(loan.principal) : EMPTY_DETAIL_VALUE,
      icon: 'cash-outline',
    },
    {
      label: 'Solde restant',
      value: formatLoanDebtAmount(loan.balanceRemaining),
      icon: 'wallet-outline',
    },
  ];

  if (loan.durationAmount > 0) {
    pretRows.push({
      label: 'Durée',
      value: formatLoanDuration(loan.durationAmount, loan.durationUnit, 'personal_loan'),
      icon: 'time-outline',
    });
  }

  if (loan.lender.trim()) {
    pretRows.push({
      label: loanLenderLabel('personal_loan'),
      value: loan.lender.trim(),
      icon: 'business-outline',
    });
  }

  if (reason) {
    pretRows.push({
      label: 'Raison',
      value: reason,
      icon: 'document-text-outline',
    });
  }

  const tauxRows: DetailSection['rows'] = [];
  if (loan.interestRate > 0) {
    tauxRows.push({
      label: 'Taux d’intérêt',
      value: `${loan.interestRate} %`,
      icon: 'trending-up-outline',
    });
  }
  if (loan.rateType) {
    tauxRows.push({
      label: 'Type de taux',
      value: rateTypeLabel(loan),
      icon: 'swap-horizontal-outline',
    });
  }

  return [
    { title: 'Prêt', rows: pretRows },
    { title: 'Taux', rows: tauxRows },
    { title: 'Paiements', rows: buildPaymentRows(loan, paymentAccount, recurringPayment) },
  ];
}

function buildLineOfCreditSections(
  loan: Loan,
  paymentAccount: SimulatedAccount | null,
  recurringPayment: RecurringPayment | null,
): DetailSection[] {
  const available = Math.max(loan.principal - loan.balanceRemaining, 0);
  const limiteRows: DetailSection['rows'] = [
    {
      label: 'Limite',
      value: loan.principal > 0 ? formatDisplayMoneyAbsolute(loan.principal) : EMPTY_DETAIL_VALUE,
      icon: 'card-outline',
    },
    {
      label: 'Solde utilisé',
      value: formatLoanDebtAmount(loan.balanceRemaining),
      icon: 'wallet-outline',
    },
  ];

  if (loan.principal > 0) {
    limiteRows.push({
      label: 'Disponible',
      value: formatDisplayMoneyAbsolute(available),
      icon: 'checkmark-circle-outline',
    });
  }

  if (loan.lender.trim()) {
    limiteRows.push({
      label: loanLenderLabel('line_of_credit'),
      value: loan.lender.trim(),
      icon: 'business-outline',
    });
  }

  const tauxRows: DetailSection['rows'] = [];
  if (loan.interestRate > 0) {
    tauxRows.push({
      label: 'Taux d’intérêt',
      value: `${loan.interestRate} %`,
      icon: 'trending-up-outline',
    });
  }

  return [
    { title: 'Limite', rows: limiteRows },
    { title: 'Taux', rows: tauxRows },
    { title: 'Paiements', rows: buildPaymentRows(loan, paymentAccount, recurringPayment) },
  ];
}

function buildFriendDebtSections(
  loan: Loan,
  paymentAccount: SimulatedAccount | null,
  recurringPayment: RecurringPayment | null,
): DetailSection[] {
  const reason = resolveLoanReason(loan);
  const detteRows: DetailSection['rows'] = [
    {
      label: 'Solde restant',
      value: formatLoanDebtAmount(loan.balanceRemaining),
      icon: 'wallet-outline',
    },
  ];

  if (loan.lender.trim()) {
    detteRows.push({
      label: loanLenderLabel('friend_debt'),
      value: loan.lender.trim(),
      icon: 'person-outline',
    });
  }

  if (reason) {
    detteRows.push({
      label: 'Raison',
      value: reason,
      icon: 'document-text-outline',
    });
  }

  if (loan.principal > 0) {
    detteRows.unshift({
      label: 'Montant initial',
      value: formatDisplayMoneyAbsolute(loan.principal),
      icon: 'cash-outline',
    });
  }

  if (loan.startDate.trim()) {
    detteRows.push({
      label: 'Date de début',
      value: formatLoanDate(loan.startDate),
      icon: 'play-outline',
    });
  }

  if (loan.endDate.trim()) {
    detteRows.push({
      label: 'Date de fin',
      value: formatLoanDate(loan.endDate),
      icon: 'flag-outline',
    });
  }

  const paiementRows: DetailSection['rows'] = [];
  if (loan.nextPaymentDate.trim()) {
    paiementRows.push({
      label: 'Prochaine date',
      value: formatLoanDate(loan.nextPaymentDate),
      icon: 'alarm-outline',
    });
  }

  if (paymentAccount) {
    paiementRows.push({
      label: 'Compte débité',
      value: paymentAccountLabel(paymentAccount),
      icon: 'card-outline',
    });
  }

  if (recurringPayment) {
    paiementRows.push({
      label: 'Paiement récurrent',
      value: `${frequencyLabel(recurringPayment.frequency)}${recurringPayment.active ? '' : ' · inactif'}`,
      icon: 'sync-outline',
    });
  }

  return [
    { title: 'Dette', rows: detteRows },
    { title: 'Paiements', rows: paiementRows },
  ];
}

function buildChildSupportSections(
  loan: Loan,
  paymentAccount: SimulatedAccount | null,
  recurringPayment: RecurringPayment | null,
): DetailSection[] {
  const fields = parseChildSupportFromLoan(loan);
  const beneficiary = resolveChildSupportBeneficiaryLabel(loan);
  const recipient = formatChildSupportRecipientLabel(loan);
  const obligationRows: DetailSection['rows'] = [];

  if (recipient) {
    obligationRows.push({
      label: 'Destinataire',
      value: recipient,
      icon: 'business-outline',
    });
  }

  if (beneficiary) {
    obligationRows.push({
      label: CHILD_SUPPORT_BENEFICIARY_LABEL,
      value: beneficiary,
      icon: 'person-outline',
    });
  }

  if (fields.baseMonthly > 0) {
    obligationRows.push({
      label: 'Montant de base (mensuel)',
      value: formatDisplayMoneyAbsolute(fields.baseMonthly),
      icon: 'cash-outline',
    });
  }

  if (fields.specialFeesMonthly > 0) {
    obligationRows.push({
      label: 'Frais particuliers (mensuel)',
      value: formatDisplayMoneyAbsolute(fields.specialFeesMonthly),
      icon: 'add-circle-outline',
    });
  }

  const totalMonthly = formatChildSupportTotalMonthly(loan);
  if (totalMonthly) {
    obligationRows.push({
      label: 'Total mensuel',
      value: totalMonthly,
      icon: 'calculator-outline',
    });
  }

  obligationRows.push({
    label: 'Jour du paiement',
    value: formatChildSupportPaymentDayLabel(fields.paymentDay),
    icon: 'calendar-outline',
  });

  if (fields.indexationDate) {
    obligationRows.push({
      label: 'Prochaine indexation',
      value: formatLoanDate(fields.indexationDate),
      icon: 'trending-up-outline',
    });
  }

  const paymentMode = formatChildSupportPaymentMode(fields.paymentMode);
  if (paymentMode) {
    obligationRows.push({
      label: 'Mode de paiement',
      value: paymentMode,
      icon: 'repeat-outline',
    });
  }

  const paiementRows: DetailSection['rows'] = [];

  if (loan.nextPaymentDate.trim()) {
    paiementRows.push({
      label: 'Prochain paiement',
      value: formatLoanDate(loan.nextPaymentDate),
      icon: 'alarm-outline',
    });
  }

  if (paymentAccount) {
    paiementRows.push({
      label: fields.paymentMode === 'automatic' ? 'Compte de paie' : 'Compte débité',
      value: paymentAccountLabel(paymentAccount),
      icon: 'card-outline',
    });
  }

  if (recurringPayment) {
    paiementRows.push({
      label: 'Paiement récurrent',
      value: `${frequencyLabel(recurringPayment.frequency)}${recurringPayment.active ? '' : ' · inactif'}`,
      icon: 'sync-outline',
    });
  }

  return [
    { title: 'Obligation', rows: obligationRows },
    { title: 'Paiements', rows: paiementRows },
  ];
}

export function buildLoanDetailSections(
  loan: Loan,
  paymentAccount: SimulatedAccount | null,
  recurringPayment: RecurringPayment | null = null,
): DetailSection[] {
  const type = loan.type ?? 'personal_loan';
  if (type === 'mortgage') return buildMortgageSections(loan, paymentAccount);
  if (type === 'personal_loan') return buildPersonalLoanSections(loan, paymentAccount, recurringPayment);
  if (type === 'line_of_credit') return buildLineOfCreditSections(loan, paymentAccount, recurringPayment);
  if (type === 'child_support') return buildChildSupportSections(loan, paymentAccount, recurringPayment);
  return buildFriendDebtSections(loan, paymentAccount, recurringPayment);
}

export function loanDetailFootnote(loan: Loan): string | null {
  if ((loan.type ?? 'personal_loan') === 'child_support') {
    const fields = parseChildSupportFromLoan(loan);
    return formatChildSupportPaymentDayLabel(fields.paymentDay);
  }
  const startDateLabel = loan.startDate.trim() ? formatLoanDate(loan.startDate) : null;
  return startDateLabel ? `Début · ${startDateLabel}` : null;
}

export function computeLineOfCreditUtilization(loan: Pick<Loan, 'principal' | 'balanceRemaining'>) {
  const usedAmount = Math.max(loan.balanceRemaining, 0);
  const utilPct =
    loan.principal > 0 ? Math.min((usedAmount / loan.principal) * 100, 100) : 0;
  return { usedAmount, utilPct };
}

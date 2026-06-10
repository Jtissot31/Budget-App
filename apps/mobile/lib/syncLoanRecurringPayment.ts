import type { Loan, RecurringPayment, SimulatedAccount } from '@/types';
import { deleteRecurringPayment, upsertRecurringPayment } from '@/lib/db';
import { formatLoanDisplayTitle } from '@/lib/loanPresentation';
import { resolveLoanIcon } from '@/lib/loanIcons';

const DEFAULT_RECURRING_ICON_COLOR = '#00A854';

export function shouldLoanSyncRecurringPayment(
  monthlyPayment: number,
  nextPaymentDate: string,
  paymentAccount: SimulatedAccount | null | undefined,
) {
  return monthlyPayment > 0 && nextPaymentDate.trim().length > 0 && Boolean(paymentAccount);
}

export function buildLoanRecurringPayment(
  loan: Loan,
  paymentAccount: SimulatedAccount,
  recurringPaymentId: string,
  createdAt: string,
): RecurringPayment {
  const loanName = formatLoanDisplayTitle(loan);
  return {
    id: recurringPaymentId,
    name: loanName,
    amount: loan.monthlyPayment,
    kind: 'payment',
    accountId: paymentAccount.id,
    accountLabel: paymentAccount.last4
      ? `${paymentAccount.name} • ${paymentAccount.last4}`
      : paymentAccount.name,
    categoryId: null,
    frequency: loan.paymentFrequency,
    dueDay: null,
    nextDate: loan.nextPaymentDate,
    endDate: loan.endDate || null,
    active: true,
    icon: resolveLoanIcon(loan),
    color: DEFAULT_RECURRING_ICON_COLOR,
    logoUrl: null,
    createdAt,
  };
}

export async function syncLoanRecurringPayment(
  loan: Loan,
  paymentAccount: SimulatedAccount | null | undefined,
  previousRecurringPaymentId?: string | null,
) {
  const shouldSync = shouldLoanSyncRecurringPayment(
    loan.monthlyPayment,
    loan.nextPaymentDate,
    paymentAccount,
  );

  if (shouldSync && paymentAccount && loan.recurringPaymentId) {
    await upsertRecurringPayment(
      buildLoanRecurringPayment(loan, paymentAccount, loan.recurringPaymentId, loan.createdAt),
    );
    return;
  }

  if (previousRecurringPaymentId) {
    await deleteRecurringPayment(previousRecurringPaymentId);
  }
}

import { EXPENSE_DEFAULT_ICON } from '@/lib/expenseIcon';
import { resolveLoanIcon } from '@/lib/loanIcons';
import { resolveStoredIconToMdi } from '@/lib/mdiIconCatalog';
import type { Loan, RecurringPayment, RecurringPaymentKind } from '@/types';

export const GENERIC_RECURRING_ICON = 'repeat-outline';

export function buildLoanByRecurringPaymentId(loans: readonly Loan[]): Map<string, Loan> {
  const map = new Map<string, Loan>();
  for (const loan of loans) {
    const recurringPaymentId = loan.recurringPaymentId?.trim();
    if (recurringPaymentId) {
      map.set(recurringPaymentId, loan);
    }
  }
  return map;
}

export function findLoanForRecurringPayment(
  paymentId: string | undefined | null,
  loanByRecurringPaymentId: Map<string, Loan>,
): Loan | null {
  const id = paymentId?.trim();
  if (!id) return null;
  return loanByRecurringPaymentId.get(id) ?? null;
}

function fallbackIconForKind(kind?: RecurringPaymentKind): string {
  return (kind ?? 'payment') === 'income' ? 'AttachMoney' : EXPENSE_DEFAULT_ICON;
}

/** Single source of truth for recurring payment / agenda / dashboard display icons. */
export function resolveRecurringPaymentDisplayIcon(
  payment: Pick<RecurringPayment, 'kind'> & { icon?: string | null },
  linkedLoan?: Loan | null,
): string {
  if (linkedLoan) {
    return resolveLoanIcon(linkedLoan);
  }

  const stored = payment.icon?.trim();
  if (stored && stored !== GENERIC_RECURRING_ICON) {
    return resolveStoredIconToMdi(stored) ?? stored;
  }

  return fallbackIconForKind(payment.kind);
}

export function resolveRecurringPaymentDisplayIconById(
  payment: Pick<RecurringPayment, 'id' | 'icon' | 'kind'>,
  loanByRecurringPaymentId: Map<string, Loan>,
): string {
  const linkedLoan = findLoanForRecurringPayment(payment.id, loanByRecurringPaymentId);
  return resolveRecurringPaymentDisplayIcon(payment, linkedLoan);
}

type AgendaBillIconInput = {
  icon?: string | null;
  kind?: 'payment' | 'income';
  recurring?: boolean;
  sourceId?: string | null;
  name?: string;
};

export function resolveAgendaBillDisplayIcon(
  bill: AgendaBillIconInput,
  loanByRecurringPaymentId: Map<string, Loan>,
  options?: { isPayBill?: (bill: AgendaBillIconInput) => boolean },
): string {
  if (bill.recurring && bill.sourceId) {
    const linkedLoan = findLoanForRecurringPayment(bill.sourceId, loanByRecurringPaymentId);
    if (linkedLoan) {
      return resolveLoanIcon(linkedLoan);
    }
  }

  const stored = bill.icon?.trim();
  if (stored && stored !== GENERIC_RECURRING_ICON) {
    return resolveStoredIconToMdi(stored) ?? stored;
  }

  if (bill.kind === 'income' || options?.isPayBill?.(bill)) {
    return 'cash-outline';
  }

  return EXPENSE_DEFAULT_ICON;
}

/** Repairs stored icons for recurring payments linked to loans (e.g. legacy heart-outline). */
export function normalizeRecurringPaymentIconsFromLoans(
  payments: RecurringPayment[],
  loans: readonly Loan[],
): { payments: RecurringPayment[]; repairs: RecurringPayment[] } {
  const loanByRecurringPaymentId = buildLoanByRecurringPaymentId(loans);
  const repairs: RecurringPayment[] = [];

  const normalized = payments.map((payment) => {
    const linkedLoan = findLoanForRecurringPayment(payment.id, loanByRecurringPaymentId);
    if (!linkedLoan) return payment;

    const expectedIcon = resolveLoanIcon(linkedLoan);
    if (payment.icon === expectedIcon) return payment;

    const repaired = { ...payment, icon: expectedIcon };
    repairs.push(repaired);
    return repaired;
  });

  return { payments: normalized, repairs };
}

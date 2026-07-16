import { DASHBOARD_ACCOUNTS } from '@/constants/dashboardMockAccounts';
import type { AlertCenterItem } from '@/lib/alerts';
import { creditUsedFromBalance } from '@/lib/creditLimitUtilization';
import { formatPersonDirectedPaymentLabel } from '@/lib/loanPresentation';
import type { RecurringPayment, SimulatedAccount } from '@/types';

/** Fixed demo numbers for `payment-mock-credit` (aligned with dashboard mock alert). */
export const CREDIT_LIMIT_MOCK_ALERT_NUMBERS = {
  creditLimit: 5000,
  balanceUsedBefore: 4350,
  paymentAmount: 450,
} as const;

export type CreditLimitTimelineData = {
  paymentLabel: string;
  accountLabel?: string;
  balanceUsedBefore: number;
  paymentAmount: number;
  balanceUsedAfter: number;
  creditLimit: number;
  availableBefore: number;
  availableAfter: number;
  isOverLimit: boolean;
  overLimitBy: number;
  utilizationBeforePct: number;
  utilizationAfterPct: number;
};

type TimelineSources = {
  simulatedAccounts: SimulatedAccount[];
  recurringPayments: RecurringPayment[];
};

function isMockCreditAlert(id: string): boolean {
  return id === 'payment-mock-credit' || id.endsWith('mock-credit');
}

function normalizeHint(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function resolvePaymentAmount(
  item: Pick<AlertCenterItem, 'montant' | 'paymentName' | 'id'>,
  recurringPayments: RecurringPayment[],
): number | null {
  if (typeof item.montant === 'number' && item.montant > 0) return item.montant;

  const paymentName = item.paymentName?.trim();
  if (paymentName) {
    const normalizedName = normalizeHint(paymentName);
    const exact = recurringPayments.find(
      (payment) => payment.active && normalizeHint(payment.name) === normalizedName,
    );
    if (exact && exact.amount > 0) return exact.amount;

    const partial = recurringPayments.find(
      (payment) =>
        payment.active &&
        (normalizedName.includes(normalizeHint(payment.name)) ||
          normalizeHint(payment.name).includes(normalizedName)),
    );
    if (partial && partial.amount > 0) return partial.amount;
  }

  if (isMockCreditAlert(item.id)) {
    return CREDIT_LIMIT_MOCK_ALERT_NUMBERS.paymentAmount;
  }

  return null;
}

function resolveCreditAccount(
  accountId: string | undefined,
  simulatedAccounts: SimulatedAccount[],
): { balance: number; creditLimit?: number; name: string } | null {
  if (accountId) {
    const fromDb = simulatedAccounts.find((account) => account.id === accountId);
    if (fromDb?.kind === 'credit') {
      return {
        balance: fromDb.balance,
        creditLimit: fromDb.creditLimit,
        name: fromDb.name,
      };
    }
  }

  const creditFromDb = simulatedAccounts.find((account) => account.kind === 'credit');
  if (creditFromDb) {
    return {
      balance: creditFromDb.balance,
      creditLimit: creditFromDb.creditLimit,
      name: creditFromDb.name,
    };
  }

  const dashboardCredit = DASHBOARD_ACCOUNTS.find((account) => account.kind === 'credit');
  if (!dashboardCredit) return null;

  return {
    balance: dashboardCredit.balance,
    creditLimit: dashboardCredit.creditLimit,
    name: dashboardCredit.name,
  };
}

function buildTimelineData(params: {
  paymentLabel: string;
  accountLabel?: string;
  balanceUsedBefore: number;
  paymentAmount: number;
  creditLimit: number;
}): CreditLimitTimelineData {
  const { paymentLabel, accountLabel, balanceUsedBefore, paymentAmount, creditLimit } = params;
  const balanceUsedAfter = balanceUsedBefore + paymentAmount;
  const availableBefore = creditLimit - balanceUsedBefore;
  const availableAfter = creditLimit - balanceUsedAfter;
  const isOverLimit = balanceUsedAfter > creditLimit;
  const overLimitBy = isOverLimit ? balanceUsedAfter - creditLimit : 0;

  return {
    paymentLabel,
    accountLabel,
    balanceUsedBefore,
    paymentAmount,
    balanceUsedAfter,
    creditLimit,
    availableBefore,
    availableAfter,
    isOverLimit,
    overLimitBy,
    utilizationBeforePct: Math.min((balanceUsedBefore / creditLimit) * 100, 100),
    utilizationAfterPct: Math.min((balanceUsedAfter / creditLimit) * 100, 100),
  };
}

/**
 * Derives credit-limit timeline numbers from alert metadata and account/payment sources.
 * Returns null when required fields cannot be resolved (non-credit alerts, missing limit, etc.).
 */
export function resolveCreditLimitTimelineData(
  item: Pick<AlertCenterItem, 'kind' | 'id' | 'montant' | 'paymentName' | 'accountId' | 'message'>,
  sources: TimelineSources,
): CreditLimitTimelineData | null {
  if (item.kind !== 'credit_limit') return null;

  const paymentLabel = item.paymentName?.trim()
    ? formatPersonDirectedPaymentLabel(item.paymentName)
    : 'Paiement';

  if (isMockCreditAlert(item.id)) {
    const { creditLimit, balanceUsedBefore, paymentAmount } = CREDIT_LIMIT_MOCK_ALERT_NUMBERS;
    return buildTimelineData({
      paymentLabel,
      balanceUsedBefore,
      paymentAmount,
      creditLimit,
    });
  }

  const paymentAmount = resolvePaymentAmount(item, sources.recurringPayments);
  const account = resolveCreditAccount(item.accountId, sources.simulatedAccounts);
  if (!paymentAmount || !account) return null;

  const creditLimit = account.creditLimit;
  if (!(typeof creditLimit === 'number' && creditLimit > 0)) return null;

  return buildTimelineData({
    paymentLabel,
    accountLabel: account.name,
    balanceUsedBefore: creditUsedFromBalance(account.balance),
    paymentAmount,
    creditLimit,
  });
}

import { DASHBOARD_ACCOUNTS } from '@/constants/dashboardMockAccounts';
import type { RecurringPayment, RecurringPaymentKind, SimulatedAccount } from '@/types';

export type PaymentResolutionAccount = {
  id: string;
  name: string;
  balance: number;
  kind: SimulatedAccount['kind'];
  creditLimit?: number;
};

export type UpcomingRecurringPaymentItem = {
  id: string;
  name: string;
  amount: number;
  account: string;
  date: string;
  recurring: boolean;
  kind?: RecurringPaymentKind;
  accountId?: string;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeAccountLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function primaryNormalizedAccountLabelKey(accountLabel: string) {
  const normalized = normalizeAccountLabel(accountLabel.trim());
  return normalized.split(/\s*•\s*/)[0]?.trim() ?? normalized;
}

const LEGACY_MANUAL_ACCOUNT_ID_TO_KIND: Record<string, PaymentResolutionAccount['kind']> = {
  checking: 'checking',
  credit: 'credit',
  savings: 'savings',
};

function kindRankForResolution(kind: PaymentResolutionAccount['kind']) {
  if (kind === 'checking') return 0;
  if (kind === 'cash') return 1;
  if (kind === 'savings') return 2;
  if (kind === 'credit') return 3;
  return 4;
}

function sortPaymentResolutionPool(pool: PaymentResolutionAccount[]): PaymentResolutionAccount[] {
  return [...pool].sort(
    (a, b) =>
      kindRankForResolution(a.kind) - kindRankForResolution(b.kind) ||
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
  );
}

export function toPaymentResolutionAccounts(accounts: SimulatedAccount[]): PaymentResolutionAccount[] {
  if (accounts.length > 0) {
    return accounts.map((account) => ({
      id: account.id,
      name: account.name,
      balance: account.balance,
      kind: account.kind,
      creditLimit: account.creditLimit,
    }));
  }
  return DASHBOARD_ACCOUNTS.map((account) => ({
    id: account.id,
    name: account.name,
    balance: account.balance,
    kind: account.kind,
    creditLimit: account.creditLimit,
  }));
}

export function resolvePaymentAccountForUpcoming(
  accountLabel: string,
  accountId: string | undefined,
  pool: PaymentResolutionAccount[],
): PaymentResolutionAccount | undefined {
  const ordered = sortPaymentResolutionPool(pool);
  const rawId = accountId?.trim();

  if (rawId) {
    const byId = ordered.find((a) => a.id === rawId);
    if (byId) return byId;

    const legacyKind = LEGACY_MANUAL_ACCOUNT_ID_TO_KIND[rawId];
    if (legacyKind) {
      const byKind = ordered.find((a) => a.kind === legacyKind);
      if (byKind) return byKind;
    }
  }

  const label = normalizeAccountLabel(accountLabel);
  const labelKey = primaryNormalizedAccountLabelKey(accountLabel);

  const exactName = ordered.find((a) => normalizeAccountLabel(a.name) === labelKey);
  if (exactName) return exactName;

  const exactFullLabel = ordered.find((a) => normalizeAccountLabel(a.name) === label);
  if (exactFullLabel) return exactFullLabel;

  if (labelKey.length >= 3) {
    const uniqueByNamePrefix = ordered.filter(
      (a) =>
        normalizeAccountLabel(a.name) === labelKey ||
        normalizeAccountLabel(a.name).startsWith(`${labelKey} `),
    );
    if (uniqueByNamePrefix.length === 1) return uniqueByNamePrefix[0];
  }

  if (label.includes('cheque') || label.includes('cheq') || label.includes('courant')) {
    return ordered.find((a) => a.kind === 'checking');
  }
  if (label.includes('carte') || label.includes('credit')) {
    return ordered.find((a) => a.kind === 'credit');
  }
  if (label.includes('epargne')) {
    return ordered.find((a) => a.kind === 'savings');
  }

  return ordered.find(
    (a) =>
      normalizeAccountLabel(a.name).includes(label) ||
      (labelKey.length >= 4 && label.includes(normalizeAccountLabel(a.name))),
  );
}

function nextMonthlyDate(dueDay?: number | null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = Math.min(Math.max(dueDay ?? today.getDate(), 1), 28);
  const next = new Date(today.getFullYear(), today.getMonth(), day);
  if (next < today) next.setMonth(next.getMonth() + 1);
  return isoDate(next);
}

/** Paiements récurrents actifs triés par date — sans fallback mock. */
export function listActiveUpcomingRecurringPayments(
  recurringPayments: RecurringPayment[],
  paymentResolutionPool: PaymentResolutionAccount[],
): UpcomingRecurringPaymentItem[] {
  return recurringPayments
    .filter((payment) => payment.active)
    .map((payment) => {
      const resolved = resolvePaymentAccountForUpcoming(
        payment.accountLabel,
        payment.accountId,
        paymentResolutionPool,
      );
      return {
        id: payment.id,
        name: payment.name,
        amount: payment.amount,
        account: resolved?.name?.trim() || payment.accountLabel,
        date: payment.nextDate ?? nextMonthlyDate(payment.dueDay),
        recurring: true,
        kind: payment.kind,
        accountId: payment.accountId,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

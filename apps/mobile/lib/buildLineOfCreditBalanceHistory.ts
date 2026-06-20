import type { Transaction } from '@/types';
import { parseAccountIdFromNote } from '@/lib/accountTransactionFlow';

const MONTH_LABELS_FR = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];

export type LineOfCreditBalancePoint = {
  label: string;
  value: number;
};

export type LineOfCreditBalanceHistoryResult = {
  points: LineOfCreditBalancePoint[];
  matchedTransactionCount: number;
  /** True when month-end balances are simulated for demo (no reliable transaction history). */
  isSimulated?: boolean;
};

/** True when month-end balances vary enough to show a meaningful trend chart. */
export function isLineOfCreditHistoryReliable(result: LineOfCreditBalanceHistoryResult): boolean {
  if (result.points.length < 2 || result.matchedTransactionCount === 0) return false;
  const values = result.points.map((point) => point.value);
  return new Set(values).size > 1;
}

function monthLabelFr(date: Date): string {
  return MONTH_LABELS_FR[date.getMonth()] ?? '???';
}

function parseTxTime(date: string): number {
  const parsed = new Date(date).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function endOfMonthMs(year: number, month: number): number {
  return new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
}

function hashStringToSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Deterministic mock month-end balances when transaction history is missing or flat.
 * Walks backward from current balance with seeded draws and payments, capped at the limit.
 */
function simulateLineOfCreditBalanceHistory(params: {
  currentBalance: number;
  creditLimit: number;
  loanId: string;
  monthCount: number;
  now: Date;
}): LineOfCreditBalancePoint[] {
  const { currentBalance, creditLimit, loanId, monthCount, now } = params;
  const rng = createSeededRandom(hashStringToSeed(loanId));
  const limit = Math.max(creditLimit, currentBalance, 1);
  const endBalance = roundMoney(Math.min(Math.max(currentBalance, 0), limit));
  const balances = Array.from({ length: monthCount }, () => endBalance);
  balances[monthCount - 1] = endBalance;

  const minStep = Math.max(limit * 0.05, 120);
  const maxStep = Math.max(limit * 0.16, minStep + 80);

  for (let index = monthCount - 2; index >= 0; index -= 1) {
    const nextBalance = balances[index + 1]!;
    const maxNetChange = nextBalance;
    const minNetChange = nextBalance - limit;

    const bias = index % 3 === 0 ? -1 : index % 3 === 1 ? 1 : rng() > 0.5 ? 1 : -1;
    let netChange = bias * (minStep + rng() * (maxStep - minStep));
    netChange = Math.max(minNetChange, Math.min(maxNetChange, netChange));

    if (Math.abs(netChange) < minStep * 0.3) {
      const draw = Math.min(maxNetChange, minStep + rng() * (maxStep - minStep));
      const payment = Math.max(minNetChange, -(minStep + rng() * (maxStep - minStep)));
      netChange = rng() > 0.45 ? draw : payment;
    }

    balances[index] = roundMoney(Math.max(0, Math.min(nextBalance - netChange, limit)));
  }

  balances[monthCount - 1] = endBalance;

  if (new Set(balances.map((value) => roundMoney(value))).size <= 1) {
    const bump = Math.min(maxStep, Math.max(minStep, endBalance > 0 ? endBalance * 0.2 : limit * 0.12));
    const pivot = Math.max(0, monthCount - 4);
    balances[pivot] = roundMoney(Math.max(0, Math.min(endBalance + bump, limit)));
  }

  const points: LineOfCreditBalancePoint[] = [];
  for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const pointIndex = monthCount - 1 - offset;
    points.push({
      label: monthLabelFr(monthDate),
      value: balances[pointIndex] ?? endBalance,
    });
  }

  return points;
}

function transactionOnPaymentAccount(
  tx: Pick<Transaction, 'type' | 'note'>,
  accountId: string,
  accountName: string,
): boolean {
  if (tx.type === 'transfer') return false;
  const linkedAccountId = parseAccountIdFromNote(tx.note);
  if (linkedAccountId === accountId) return true;
  const normalizedName = accountName.trim().toLowerCase();
  return Boolean(normalizedName && linkedAccountId?.trim().toLowerCase() === normalizedName);
}

function transactionMatchesLoan(
  tx: Pick<Transaction, 'label'>,
  loanTitle: string,
  recurringName?: string | null,
): boolean {
  const label = tx.label.trim().toLowerCase();
  const title = loanTitle.trim().toLowerCase();
  if (title.length >= 3 && label.includes(title)) return true;
  const recurring = recurringName?.trim().toLowerCase();
  if (recurring && recurring.length >= 3 && label.includes(recurring)) return true;
  return false;
}

/** Reverse delta when walking backward: payments reduce LOC balance, draws increase it. */
function locBalanceDeltaReverse(tx: Pick<Transaction, 'amount' | 'type'>): number {
  if (tx.type === 'expense') return Math.abs(tx.amount);
  if (tx.type === 'income') return -Math.abs(tx.amount);
  return 0;
}

/**
 * Month-end used balance for a line of credit, reconstructed from payment-account
 * transactions whose label matches the loan (payments reduce balance when reversed).
 */
export function buildLineOfCreditBalanceHistory(params: {
  currentBalance: number;
  creditLimit: number;
  loanId: string;
  transactions: readonly Transaction[];
  paymentAccountId: string;
  paymentAccountName: string;
  loanTitle: string;
  recurringPaymentName?: string | null;
  monthCount?: number;
  now?: Date;
}): LineOfCreditBalanceHistoryResult {
  const {
    currentBalance,
    creditLimit,
    loanId,
    transactions,
    paymentAccountId,
    paymentAccountName,
    loanTitle,
    recurringPaymentName,
    monthCount = 12,
    now = new Date(),
  } = params;

  const relevantTransactions = transactions.filter(
    (tx) =>
      transactionOnPaymentAccount(tx, paymentAccountId, paymentAccountName) &&
      transactionMatchesLoan(tx, loanTitle, recurringPaymentName),
  );

  const points: LineOfCreditBalancePoint[] = [];

  for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const cutoffMs = endOfMonthMs(monthDate.getFullYear(), monthDate.getMonth());

    let balance = Math.max(currentBalance, 0);
    const sorted = [...relevantTransactions].sort((a, b) => parseTxTime(b.date) - parseTxTime(a.date));

    for (const tx of sorted) {
      if (parseTxTime(tx.date) <= cutoffMs) continue;
      balance += locBalanceDeltaReverse(tx);
    }

    points.push({
      label: monthLabelFr(monthDate),
      value: Math.max(balance, 0),
    });
  }

  const result: LineOfCreditBalanceHistoryResult = {
    points,
    matchedTransactionCount: relevantTransactions.length,
    isSimulated: false,
  };

  if (isLineOfCreditHistoryReliable(result)) {
    return result;
  }

  if (creditLimit <= 0 || !loanId.trim()) {
    return result;
  }

  return {
    points: simulateLineOfCreditBalanceHistory({
      currentBalance,
      creditLimit,
      loanId,
      monthCount,
      now,
    }),
    matchedTransactionCount: result.matchedTransactionCount,
    isSimulated: true,
  };
}

import { parseAccountIdFromNote } from '@/lib/accountTransactionFlow';
import {
  buildDemoGoalContributionRamp,
  type GoalContributionChartPeriod,
  type GoalContributionSparkline,
} from '@/lib/buildSavingsGoalsTrendSeries';
import { computeLoanRepaymentProgress } from '@/lib/loanPresentation';
import type { Loan, SimulatedAccount, Transaction } from '@/types';

export type LoanRepaymentChartPeriod = GoalContributionChartPeriod;

type LoanPaymentEvent = {
  ts: number;
  amount: number;
};

const DEMO_PAYMENT_COUNT: Record<LoanRepaymentChartPeriod, number> = {
  '1M': 4,
  '3M': 8,
  '6M': 12,
  '1A': 18,
  '5A': 30,
};

function periodWindowStartMs(period: LoanRepaymentChartPeriod, now: Date): number {
  const start = new Date(now);
  if (period === '1M') start.setDate(start.getDate() - 30);
  else if (period === '3M') start.setMonth(start.getMonth() - 3);
  else if (period === '6M') start.setMonth(start.getMonth() - 6);
  else if (period === '1A') start.setFullYear(start.getFullYear() - 1);
  else start.setFullYear(start.getFullYear() - 5);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

function parseTxTime(date: string): number {
  const parsed = new Date(date).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
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

function isEffectivelyFlatSeries(values: readonly number[]): boolean {
  if (values.length < 2) return true;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max < 0.01) return true;
  return max - min < Math.max(1, max * 0.02);
}

/**
 * Expense payments on the loan payment account whose label matches the loan /
 * recurring payment — each event is principal progress toward repayment.
 */
export function buildLoanRepaymentPaymentEvents(params: {
  loan: Pick<Loan, 'id' | 'principal' | 'balanceRemaining'>;
  transactions: readonly Transaction[];
  paymentAccount: Pick<SimulatedAccount, 'id' | 'name'> | null;
  loanTitle: string;
  recurringPaymentName?: string | null;
  nowMs?: number;
}): LoanPaymentEvent[] {
  const {
    transactions,
    paymentAccount,
    loanTitle,
    recurringPaymentName,
    nowMs = Date.now(),
  } = params;
  if (!paymentAccount) return [];

  return transactions
    .filter(
      (tx) =>
        tx.type === 'expense' &&
        Math.abs(tx.amount) > 0 &&
        parseTxTime(tx.date) <= nowMs &&
        transactionOnPaymentAccount(tx, paymentAccount.id, paymentAccount.name) &&
        transactionMatchesLoan(tx, loanTitle, recurringPaymentName),
    )
    .map((tx) => ({
      ts: parseTxTime(tx.date),
      amount: Math.abs(tx.amount),
    }))
    .sort((a, b) => a.ts - b.ts || a.amount - b.amount);
}

function buildPaymentEventSeries(
  events: readonly LoanPaymentEvent[],
  period: LoanRepaymentChartPeriod,
  now: Date,
): GoalContributionSparkline | null {
  const windowStart = periodWindowStartMs(period, now);
  const before = events.filter((event) => event.ts < windowStart);
  const inWindow = events.filter((event) => event.ts >= windowStart);

  if (inWindow.length < 1) return null;

  let running = before.reduce((sum, event) => sum + event.amount, 0);
  const values: number[] = [Math.max(0, running)];
  const versementIndices: number[] = [];
  for (const event of inWindow) {
    running += event.amount;
    versementIndices.push(values.length);
    values.push(Math.max(0, running));
  }

  return values.length >= 2 ? { values, versementIndices } : null;
}

/**
 * Cumulative repaid sparkline for a loan — same Accueil / goal-detail language
 * (one point per payment, demo ramp when history is empty or flat).
 */
export function buildLoanRepaymentSparkline(params: {
  loan: Pick<Loan, 'id' | 'principal' | 'balanceRemaining'>;
  transactions?: readonly Transaction[];
  paymentAccount?: Pick<SimulatedAccount, 'id' | 'name'> | null;
  loanTitle: string;
  recurringPaymentName?: string | null;
  period?: LoanRepaymentChartPeriod;
  now?: Date;
}): GoalContributionSparkline {
  const {
    loan,
    transactions = [],
    paymentAccount = null,
    loanTitle,
    recurringPaymentName = null,
    period = '6M',
    now = new Date(),
  } = params;

  const { paidAmount } = computeLoanRepaymentProgress(loan);
  const events = buildLoanRepaymentPaymentEvents({
    loan,
    transactions,
    paymentAccount,
    loanTitle,
    recurringPaymentName,
    nowMs: now.getTime(),
  });
  const fromEvents = buildPaymentEventSeries(events, period, now);

  if (fromEvents && !isEffectivelyFlatSeries(fromEvents.values)) {
    return fromEvents;
  }

  const endAmount = Math.max(paidAmount, 0);
  if (endAmount < 0.01) {
    return { values: [0, 0], versementIndices: [1] };
  }

  const values = buildDemoGoalContributionRamp(DEMO_PAYMENT_COUNT[period], endAmount, period);
  return {
    values,
    versementIndices: values.map((_, index) => index),
  };
}

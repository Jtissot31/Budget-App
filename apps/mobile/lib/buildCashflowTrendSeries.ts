import type { NetWorthTrendPoint } from '@/components/PortfolioChartCard';
import { getTransactionAccountDeltas } from '@/lib/accountTransactionFlow';
import {
  NET_WORTH_FUTURE_MONTH_COUNT,
  NET_WORTH_TREND_HISTORICAL_MONTH_COUNT,
} from '@/lib/buildNetWorthTrendSeries';
import type { SimulatedAccount, Transaction } from '@/types';

const MONTH_LABELS_FR = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];

/**
 * Deterministic demo cumulative cashflow (income − expenses) when the user has no accounts yet.
 * Values rise and fall to showcase green/red segments on the chart.
 */
const DEMO_CASHFLOW_MONTHLY_VALUES = [
  -820,
  -1_180,
  -940,
  -510,
  120,
  80,
  540,
  980,
  760,
  1_220,
  1_640,
  2_380,
  0,
] as const;

type AccountScope = {
  ids: Set<string>;
  namesLower: Set<string>;
};

function monthLabelFr(date: Date): string {
  return MONTH_LABELS_FR[date.getMonth()] ?? '???';
}

function buildAccountScopeLookup(accounts: SimulatedAccount[]): AccountScope {
  const ids = new Set<string>();
  const namesLower = new Set<string>();
  for (const account of accounts) {
    ids.add(account.id);
    namesLower.add(account.name.trim().toLowerCase());
  }
  return { ids, namesLower };
}

function isInAccountScope(id: string, scope: AccountScope): boolean {
  return scope.ids.has(id) || scope.namesLower.has(id.trim().toLowerCase());
}

function parseTxTime(date: string): number {
  const parsed = new Date(date).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthAnchorDates(historicalMonthCount: number, futureMonthCount: number, now: Date): Date[] {
  const historical = Array.from({ length: historicalMonthCount }, (_, index) => {
    return new Date(now.getFullYear(), now.getMonth() - (historicalMonthCount - 1 - index), 1);
  });
  const future = Array.from({ length: futureMonthCount }, (_, index) => {
    return new Date(now.getFullYear(), now.getMonth() + index + 1, 1);
  });
  return [...historical, ...future];
}

/** Income and expense only; transfers are excluded from cashflow. */
function getTransactionCashflowDelta(
  tx: Pick<Transaction, 'amount' | 'type' | 'note'>,
  accountScope: AccountScope,
): number {
  if (tx.type === 'transfer') return 0;

  let net = 0;
  for (const { id, delta } of getTransactionAccountDeltas(tx)) {
    if (isInAccountScope(id, accountScope)) {
      net += delta;
    }
  }
  return net;
}

function cumulativeCashflowBetween(
  transactions: readonly Transaction[],
  startMs: number,
  endMs: number,
  accountScope: AccountScope,
): number {
  let total = 0;
  for (const tx of transactions) {
    const txMs = parseTxTime(tx.date);
    if (txMs < startMs || txMs > endMs) continue;
    total += getTransactionCashflowDelta(tx, accountScope);
  }
  return total;
}

/**
 * Builds monthly cumulative cashflow points (income − expenses on in-scope accounts).
 * Each point is the running net cashflow from the first historical month through that anchor.
 */
export function buildCashflowTrendFromTransactions(
  accounts: SimulatedAccount[],
  transactions: readonly Transaction[],
  now: Date = new Date(),
  historicalMonthCount: number = NET_WORTH_TREND_HISTORICAL_MONTH_COUNT,
  futureMonthCount: number = NET_WORTH_FUTURE_MONTH_COUNT,
): NetWorthTrendPoint[] {
  const anchors = monthAnchorDates(historicalMonthCount, futureMonthCount, now);
  const currentMonthIndex = historicalMonthCount - 1;

  if (accounts.length === 0) {
    return anchors.map((anchor, index) => ({
      label: monthLabelFr(anchor),
      value: DEMO_CASHFLOW_MONTHLY_VALUES[index] ?? 0,
    }));
  }

  const accountScope = buildAccountScopeLookup(accounts);
  const seriesStartMs = anchors[0]?.getTime() ?? now.getTime();
  const nowMs = now.getTime();

  return anchors.map((anchor, index) => {
    const isFutureMonth = index > currentMonthIndex;
    const isCurrentMonth = index === currentMonthIndex;
    if (isFutureMonth) {
      return {
        label: monthLabelFr(anchor),
        value: 0,
      };
    }

    const cutoffMs = isCurrentMonth
      ? nowMs
      : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    return {
      label: monthLabelFr(anchor),
      value: cumulativeCashflowBetween(transactions, seriesStartMs, cutoffMs, accountScope),
    };
  });
}

/** Latest cumulative cashflow total (current month point). */
export function getCurrentCashflowTotal(
  accounts: SimulatedAccount[],
  transactions: readonly Transaction[],
  now: Date = new Date(),
): number {
  const series = buildCashflowTrendFromTransactions(accounts, transactions, now);
  const currentMonthIndex = NET_WORTH_TREND_HISTORICAL_MONTH_COUNT - 1;
  return series[currentMonthIndex]?.value ?? 0;
}

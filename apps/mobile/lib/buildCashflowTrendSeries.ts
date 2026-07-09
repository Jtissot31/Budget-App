import type { NetWorthChartPeriod, NetWorthTrendPoint } from '@/components/PortfolioChartCard';
import { getTransactionAccountDeltas } from '@/lib/accountTransactionFlow';
import {
  NET_WORTH_FUTURE_MONTH_COUNT,
  NET_WORTH_TREND_HISTORICAL_MONTH_COUNT,
} from '@/lib/buildNetWorthTrendSeries';
import type { SimulatedAccount, Transaction } from '@/types';

const MONTH_LABELS_FR = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];

/**
 * Deterministic demo cumulative cashflow (income − expenses) when accounts are empty or
 * Historique has no in-scope income/expense rows yet (demo accounts seeded without txs).
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

function buildDemoCashflowSeries(anchors: Date[]): NetWorthTrendPoint[] {
  return anchors.map((anchor, index) => ({
    label: monthLabelFr(anchor),
    value: DEMO_CASHFLOW_MONTHLY_VALUES[index] ?? 0,
  }));
}

/** True when at least one in-scope income/expense tx contributes within the series window. */
function hasScopedCashflowTransactions(
  transactions: readonly Transaction[],
  accountScope: AccountScope,
  seriesStartMs: number,
  endMs: number,
): boolean {
  for (const tx of transactions) {
    if (tx.type === 'transfer') continue;
    const txMs = parseTxTime(tx.date);
    if (txMs < seriesStartMs || txMs > endMs) continue;
    if (getTransactionCashflowDelta(tx, accountScope) !== 0) return true;
  }
  return false;
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
  /** Chart data is historical-only — a trailing future month (value 0) breaks period tail slices. */
  const historicalAnchors = anchors.slice(0, currentMonthIndex + 1);
  const seriesStartMs = historicalAnchors[0]?.getTime() ?? now.getTime();
  const nowMs = now.getTime();

  if (accounts.length === 0) {
    return buildDemoCashflowSeries(historicalAnchors);
  }

  const accountScope = buildAccountScopeLookup(accounts);
  if (!hasScopedCashflowTransactions(transactions, accountScope, seriesStartMs, nowMs)) {
    return buildDemoCashflowSeries(historicalAnchors);
  }

  return historicalAnchors.map((anchor, index) => {
    const isCurrentMonth = index === currentMonthIndex;
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

const DAY_LABELS_FR = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function dayLabelFr(date: Date, isToday: boolean): string {
  if (isToday) return 'AUJ';
  return DAY_LABELS_FR[date.getDay()] ?? '???';
}

function buildDailyAnchors(dayCount: number, now: Date): Date[] {
  return Array.from({ length: dayCount }, (_, index) => {
    const anchor = new Date(now);
    anchor.setDate(anchor.getDate() - (dayCount - 1 - index));
    return endOfDay(anchor);
  });
}

function buildWeeklyAnchors(weekCount: number, now: Date): Date[] {
  return Array.from({ length: weekCount }, (_, index) => {
    const anchor = new Date(now);
    anchor.setDate(anchor.getDate() - (weekCount - 1 - index) * 7);
    return endOfDay(anchor);
  });
}

function buildMonthlyAnchors(monthCount: number, now: Date): Date[] {
  return Array.from({ length: monthCount }, (_, index) => {
    return new Date(now.getFullYear(), now.getMonth() - (monthCount - 1 - index) + 1, 0, 23, 59, 59, 999);
  });
}

function buildPeriodAnchors(
  period: NetWorthChartPeriod,
  now: Date,
): { anchors: Date[]; labels: string[] } {
  const todayEnd = endOfDay(now);

  switch (period) {
    case '1J': {
      const anchors = [endOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000)), todayEnd];
      return { anchors, labels: ['HIER', 'AUJ'] };
    }
    case '1S': {
      const anchors = buildDailyAnchors(7, now);
      return {
        anchors,
        labels: anchors.map((anchor, index) => dayLabelFr(anchor, index === anchors.length - 1)),
      };
    }
    case '1M': {
      const anchors = buildDailyAnchors(30, now);
      return {
        anchors,
        labels: anchors.map((anchor, index) =>
          index % 5 === 0 || index === anchors.length - 1 ? String(anchor.getDate()) : '',
        ),
      };
    }
    case '3M': {
      const anchors = buildWeeklyAnchors(13, now);
      return {
        anchors,
        labels: anchors.map((anchor) => monthLabelFr(anchor)),
      };
    }
    case '6M': {
      const anchors = buildWeeklyAnchors(26, now);
      return {
        anchors,
        labels: anchors.map((anchor, index) => (index % 4 === 0 ? monthLabelFr(anchor) : '')),
      };
    }
    case 'CA':
    case 'YTD': {
      const monthIndex = now.getMonth();
      const anchors = Array.from({ length: monthIndex + 1 }, (_, index) =>
        endOfDay(new Date(now.getFullYear(), index + 1, 0)),
      );
      return {
        anchors,
        labels: anchors.map((anchor) => monthLabelFr(anchor)),
      };
    }
    case '1A': {
      const anchors = buildMonthlyAnchors(12, now);
      return { anchors, labels: anchors.map((anchor) => monthLabelFr(anchor)) };
    }
    case '5A': {
      const anchors = buildMonthlyAnchors(60, now);
      return {
        anchors,
        labels: anchors.map((anchor, index) => (index % 6 === 0 ? monthLabelFr(anchor) : '')),
      };
    }
    case '10A':
    case 'TOUT': {
      const anchors = buildMonthlyAnchors(24, now);
      return {
        anchors,
        labels: anchors.map((anchor, index) => (index % 3 === 0 ? monthLabelFr(anchor) : '')),
      };
    }
    default: {
      const anchors = buildMonthlyAnchors(12, now);
      return { anchors, labels: anchors.map((anchor) => monthLabelFr(anchor)) };
    }
  }
}

/**
 * Period-scoped cumulative cashflow from transaction data — daily/weekly/monthly anchors
 * matching the selected chart tab (1S = last 7 days, etc.).
 */
export function buildCashflowTrendForChartPeriod(
  accounts: SimulatedAccount[],
  transactions: readonly Transaction[],
  period: NetWorthChartPeriod,
  now: Date = new Date(),
): NetWorthTrendPoint[] {
  const { anchors, labels } = buildPeriodAnchors(period, now);
  if (anchors.length === 0) return [];

  if (accounts.length === 0) {
    const demo = buildDemoCashflowSeries(
      anchors.map((anchor) => new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
    );
    return demo.slice(-anchors.length).map((point, index) => ({
      label: labels[index] ?? point.label,
      value: point.value,
    }));
  }

  const accountScope = buildAccountScopeLookup(accounts);
  const periodStartMs = startOfDay(anchors[0]).getTime();
  const nowMs = now.getTime();

  if (!hasScopedCashflowTransactions(transactions, accountScope, periodStartMs, nowMs)) {
    const demo = buildDemoCashflowSeries(
      anchors.map((anchor) => new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
    );
    return demo.slice(-anchors.length).map((point, index) => ({
      label: labels[index] ?? point.label,
      value: point.value,
    }));
  }

  return anchors.map((anchor, index) => {
    const cutoffMs = Math.min(anchor.getTime(), nowMs);
    return {
      label: labels[index] ?? monthLabelFr(anchor),
      value: cumulativeCashflowBetween(transactions, periodStartMs, cutoffMs, accountScope),
    };
  });
}

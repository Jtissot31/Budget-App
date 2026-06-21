import type { NetWorthTrendPoint } from '@/components/PortfolioChartCard';
import { getTransactionAccountDeltas } from '@/lib/accountTransactionFlow';
import type { NetWorthChartScope } from '@/lib/settings';
import type { SimulatedAccount, Transaction } from '@/types';

/** Historical months ending at the current month, plus future slots on the chart X axis. */
export const NET_WORTH_TREND_HISTORICAL_MONTH_COUNT = 12;
export const NET_WORTH_FUTURE_MONTH_COUNT = 1;
/** @deprecated Use NET_WORTH_TREND_HISTORICAL_MONTH_COUNT + NET_WORTH_FUTURE_MONTH_COUNT */
export const NET_WORTH_TREND_MONTH_COUNT =
  NET_WORTH_TREND_HISTORICAL_MONTH_COUNT + NET_WORTH_FUTURE_MONTH_COUNT;

export const NET_WORTH_DAILY_POINT_COUNT = 7;
/** ~13 weeks covering the last 3 months. */
export const NET_WORTH_WEEKLY_3M_COUNT = 13;
/** ~26 weeks covering the last 6 months. */
export const NET_WORTH_WEEKLY_6M_COUNT = 26;

const MONTH_LABELS_FR = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
const DAY_LABELS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/**
 * Deterministic demo net-worth values shown when the user has no accounts yet.
 * One entry per month anchor (oldest → current month → future month).
 * Designed so every period slice contains at least one descending segment (red)
 * and one ascending segment (green) to showcase the per-segment colouring.
 *
 * Slice mapping (NET_WORTH_TREND_HISTORICAL_MONTH_COUNT = 12, FUTURE = 1 → 13 points total):
 *   1S  → last 3 → [23 500, 24 800, 24 200]   — up then slight dip (red)
 *   1M  → last 4 → [22 100, 23 500, 24 800, 24 200] — two ups then dip
 *   6M  → last 6 → [21 300, 22 800, 22 100, 23 500, 24 800, 24 200] — mixed
 */
const DEMO_NET_WORTH_MONTHLY_VALUES = [
  16_200, // month −11
  17_800, // month −10 ↑
  16_900, // month −9  ↓ dip
  18_600, // month −8  ↑ spike
  17_400, // month −7  ↓
  20_100, // month −6  ↑ spike
  19_300, // month −5  ↓ dip
  21_800, // month −4  ↑
  20_700, // month −3  ↓
  22_400, // month −2  ↑
  21_600, // month −1  ↓ dip
  23_200, // current month ↑
  21_470, // future month — dip
] as const;
/** Treat near-zero balances as empty history when detecting a first net-worth entry. */
const NET_WORTH_VALUE_EPSILON = 0.01;

function isEffectivelyZero(value: number): boolean {
  return Math.abs(value) < NET_WORTH_VALUE_EPSILON;
}

/** Past months below this fraction of current net worth are treated as pre-entry noise. */
const NEW_ENTRY_PAST_VALUE_RATIO = 0.1;

/**
 * True when the user has a current net worth but no meaningful prior months.
 * Covers manual balance entry, new accounts, and replay noise (small non-zero past values).
 */
export function isNewNetWorthEntry(historicalValues: readonly number[]): boolean {
  if (historicalValues.length < 2) return false;

  const currentValue = historicalValues[historicalValues.length - 1];
  if (isEffectivelyZero(currentValue)) return false;

  const pastValues = historicalValues.slice(0, -1);
  if (pastValues.every(isEffectivelyZero)) return true;

  if (currentValue > 0) {
    const maxPast = Math.max(...pastValues);
    if (maxPast < currentValue * NEW_ENTRY_PAST_VALUE_RATIO) return true;
  }

  return false;
}

function flattenHistoricalNetWorthForNewEntry(
  points: NetWorthTrendPoint[],
  currentMonthIndex: number,
): NetWorthTrendPoint[] {
  const currentValue = points[currentMonthIndex]?.value ?? 0;
  return points.map((point, index) => {
    if (index > currentMonthIndex) return point;
    return { ...point, value: currentValue };
  });
}

/** Flattens prior points to the current value for first-time net-worth entries. */
function flattenSeriesForNewEntry(points: NetWorthTrendPoint[]): NetWorthTrendPoint[] {
  if (points.length < 2) return points;
  const currentValue = points[points.length - 1]?.value ?? 0;
  return points.map((point, index) => {
    if (index === points.length - 1) return point;
    return {
      ...point,
      value: currentValue,
      high: point.high != null ? currentValue : undefined,
      low: point.low != null ? currentValue : undefined,
    };
  });
}

function applyNewEntryFlatBackfill(points: NetWorthTrendPoint[]): NetWorthTrendPoint[] {
  const values = points.map((point) => point.value);
  if (!isNewNetWorthEntry(values)) return points;
  return flattenSeriesForNewEntry(points);
}

type AccountScope = {
  ids: Set<string>;
  namesLower: Set<string>;
};

function monthLabelFr(date: Date): string {
  return MONTH_LABELS_FR[date.getMonth()] ?? '???';
}

function dayLabelFr(date: Date, isToday: boolean): string {
  if (isToday) {
    return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }).replace('.', '');
  }
  return DAY_LABELS_FR[date.getDay()] ?? '???';
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
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

function getTransactionNetWorthDelta(
  tx: Pick<Transaction, 'amount' | 'type' | 'note'>,
  accountScope: AccountScope,
): number {
  let net = 0;
  for (const { id, delta } of getTransactionAccountDeltas(tx)) {
    if (isInAccountScope(id, accountScope)) {
      net += delta;
    }
  }
  return net;
}

function parseTxTime(date: string): number {
  const parsed = new Date(date).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortTransactionsNewestFirst(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    const byDate = parseTxTime(b.date) - parseTxTime(a.date);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });
}

function netWorthAtCutoff(
  currentAccountsNetWorth: number,
  sortedTransactionsNewestFirst: readonly Transaction[],
  cutoffMs: number,
  accountScope: AccountScope,
): number {
  let value = currentAccountsNetWorth;

  for (const tx of sortedTransactionsNewestFirst) {
    if (parseTxTime(tx.date) > cutoffMs) {
      value -= getTransactionNetWorthDelta(tx, accountScope);
    }
  }

  return value;
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

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeekMonday(date: Date): Date {
  const day = startOfDay(date);
  const weekday = day.getDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  day.setDate(day.getDate() - daysFromMonday);
  return day;
}

function endOfWeekSunday(weekStartMonday: Date): Date {
  const end = new Date(weekStartMonday);
  end.setDate(weekStartMonday.getDate() + 6);
  return endOfDay(end);
}

function weekLabelFr(weekStart: Date): string {
  return weekStart.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }).replace('.', '');
}

function weekCountForMonthsBack(monthsBack: 3 | 6): number {
  return monthsBack === 3 ? NET_WORTH_WEEKLY_3M_COUNT : NET_WORTH_WEEKLY_6M_COUNT;
}

/**
 * Builds 7 daily net-worth points (last 7 days including today).
 * Each point includes intraday high/low from replaying that day's in-scope transactions.
 */
export function buildNetWorthDailySeries(
  scope: NetWorthChartScope,
  currentNetWorth: number,
  accounts: SimulatedAccount[],
  offAccountAssetsBalance: number,
  transactions: readonly Transaction[],
  now: Date = new Date(),
  dayCount: number = NET_WORTH_DAILY_POINT_COUNT,
): NetWorthTrendPoint[] {
  const today = startOfDay(now);
  const dayAnchors = Array.from({ length: dayCount }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (dayCount - 1 - index));
    return startOfDay(day);
  });

  if (scope === 'accounts_only' && accounts.length === 0) {
    return dayAnchors.map((day) => ({
      label: dayLabelFr(day, isSameCalendarDay(day, today)),
      value: 0,
      high: 0,
      low: 0,
    }));
  }
  if (accounts.length === 0 && offAccountAssetsBalance === 0) {
    return dayAnchors.map((day) => ({
      label: dayLabelFr(day, isSameCalendarDay(day, today)),
      value: 0,
      high: 0,
      low: 0,
    }));
  }

  const accountScope = buildAccountScopeLookup(accounts);
  const wealthOffset = scope === 'inclusive' ? offAccountAssetsBalance : 0;
  const currentAccountsNetWorth = currentNetWorth - wealthOffset;
  const nowMs = now.getTime();

  const scopedTransactions = transactions.filter((tx) => getTransactionNetWorthDelta(tx, accountScope) !== 0);
  const sortedTransactions = sortTransactionsNewestFirst(transactions);

  const points = dayAnchors.map((day) => {
    const isToday = isSameCalendarDay(day, today);
    const dayStartMs = day.getTime();
    const dayEndMs = isToday ? nowMs : endOfDay(day).getTime();
    const startBalance = netWorthAtCutoff(
      currentAccountsNetWorth,
      sortedTransactions,
      dayStartMs - 1,
      accountScope,
    );

    const dayTransactions = scopedTransactions
      .filter((tx) => {
        const txMs = parseTxTime(tx.date);
        return txMs >= dayStartMs && txMs <= dayEndMs;
      })
      .sort((a, b) => {
        const byDate = parseTxTime(a.date) - parseTxTime(b.date);
        return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
      });

    let running = startBalance;
    let low = running;
    let high = running;

    for (const tx of dayTransactions) {
      running += getTransactionNetWorthDelta(tx, accountScope);
      low = Math.min(low, running);
      high = Math.max(high, running);
    }

    const endBalance = isToday
      ? currentAccountsNetWorth
      : netWorthAtCutoff(currentAccountsNetWorth, sortedTransactions, dayEndMs, accountScope);

    low = Math.min(low, endBalance);
    high = Math.max(high, endBalance);

    return {
      label: dayLabelFr(day, isToday),
      value: endBalance + wealthOffset,
      high: high + wealthOffset,
      low: low + wealthOffset,
    };
  });

  return applyNewEntryFlatBackfill(points);
}

/**
 * Builds weekly net-worth points for the last ~3 or ~6 months.
 * Each point includes intraweek high/low from replaying daily income/expense within Mon–Sun buckets.
 */
export function buildNetWorthWeeklySeriesForPeriod(
  scope: NetWorthChartScope,
  currentNetWorth: number,
  accounts: SimulatedAccount[],
  offAccountAssetsBalance: number,
  transactions: readonly Transaction[],
  monthsBack: 3 | 6,
  now: Date = new Date(),
): NetWorthTrendPoint[] {
  const weekCount = weekCountForMonthsBack(monthsBack);
  const today = startOfDay(now);
  const currentWeekStart = startOfWeekMonday(today);
  const weekAnchors = Array.from({ length: weekCount }, (_, index) => {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() - (weekCount - 1 - index) * 7);
    return startOfDay(weekStart);
  });

  if (scope === 'accounts_only' && accounts.length === 0) {
    return weekAnchors.map((weekStart) => ({
      label: weekLabelFr(weekStart),
      value: 0,
      high: 0,
      low: 0,
    }));
  }
  if (accounts.length === 0 && offAccountAssetsBalance === 0) {
    return weekAnchors.map((weekStart) => ({
      label: weekLabelFr(weekStart),
      value: 0,
      high: 0,
      low: 0,
    }));
  }

  const accountScope = buildAccountScopeLookup(accounts);
  const wealthOffset = scope === 'inclusive' ? offAccountAssetsBalance : 0;
  const currentAccountsNetWorth = currentNetWorth - wealthOffset;
  const nowMs = now.getTime();
  const scopedTransactions = transactions.filter((tx) => getTransactionNetWorthDelta(tx, accountScope) !== 0);
  const sortedTransactions = sortTransactionsNewestFirst(transactions);

  const points = weekAnchors.map((weekStart) => {
    const weekEnd = endOfWeekSunday(weekStart);
    const isCurrentWeek = today.getTime() >= weekStart.getTime() && today.getTime() <= weekEnd.getTime();
    const weekEndMs = isCurrentWeek ? nowMs : weekEnd.getTime();
    const startBalance = netWorthAtCutoff(
      currentAccountsNetWorth,
      sortedTransactions,
      weekStart.getTime() - 1,
      accountScope,
    );

    let running = startBalance;
    let low = running;
    let high = running;

    const dayCursor = new Date(weekStart);
    while (dayCursor.getTime() <= weekEndMs && dayCursor.getTime() <= endOfDay(today).getTime()) {
      const isToday = isSameCalendarDay(dayCursor, today);
      const dayStartMs = dayCursor.getTime();
      const dayEndMs = isToday ? nowMs : endOfDay(dayCursor).getTime();

      const dayTransactions = scopedTransactions
        .filter((tx) => {
          const txMs = parseTxTime(tx.date);
          return txMs >= dayStartMs && txMs <= dayEndMs;
        })
        .sort((a, b) => {
          const byDate = parseTxTime(a.date) - parseTxTime(b.date);
          return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
        });

      for (const tx of dayTransactions) {
        running += getTransactionNetWorthDelta(tx, accountScope);
        low = Math.min(low, running);
        high = Math.max(high, running);
      }

      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    const endBalance = isCurrentWeek
      ? currentAccountsNetWorth
      : netWorthAtCutoff(currentAccountsNetWorth, sortedTransactions, weekEndMs, accountScope);

    low = Math.min(low, endBalance);
    high = Math.max(high, endBalance);

    return {
      label: weekLabelFr(weekStart),
      value: endBalance + wealthOffset,
      high: high + wealthOffset,
      low: low + wealthOffset,
    };
  });

  return applyNewEntryFlatBackfill(points);
}

/**
 * Replays account-linked transactions backward from current balances to build monthly net-worth points.
 * Transfers between in-scope accounts net to zero; income/expense move the line.
 */
export function buildNetWorthTrendFromTransactions(
  scope: NetWorthChartScope,
  currentNetWorth: number,
  accounts: SimulatedAccount[],
  offAccountAssetsBalance: number,
  transactions: readonly Transaction[],
  now: Date = new Date(),
  historicalMonthCount: number = NET_WORTH_TREND_HISTORICAL_MONTH_COUNT,
  futureMonthCount: number = NET_WORTH_FUTURE_MONTH_COUNT,
): NetWorthTrendPoint[] {
  const anchors = monthAnchorDates(historicalMonthCount, futureMonthCount, now);
  const currentMonthIndex = historicalMonthCount - 1;

  if (scope === 'accounts_only' && accounts.length === 0) {
    return anchors.map((anchor, index) => ({
      label: monthLabelFr(anchor),
      value: DEMO_NET_WORTH_MONTHLY_VALUES[index] ?? 0,
    }));
  }
  if (accounts.length === 0 && offAccountAssetsBalance === 0) {
    return anchors.map((anchor, index) => ({
      label: monthLabelFr(anchor),
      value: DEMO_NET_WORTH_MONTHLY_VALUES[index] ?? 0,
    }));
  }

  const accountScope = buildAccountScopeLookup(accounts);
  const wealthOffset = scope === 'inclusive' ? offAccountAssetsBalance : 0;
  const currentAccountsNetWorth = currentNetWorth - wealthOffset;
  const nowMs = now.getTime();
  const sortedTransactions = sortTransactionsNewestFirst(transactions);

  const trendPoints = anchors.map((anchor, index) => {
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

    const accountsValue = isCurrentMonth
      ? currentAccountsNetWorth
      : netWorthAtCutoff(currentAccountsNetWorth, sortedTransactions, cutoffMs, accountScope);

    return {
      label: monthLabelFr(anchor),
      value: accountsValue + wealthOffset,
    };
  });

  const historicalValues = trendPoints.slice(0, currentMonthIndex + 1).map((point) => point.value);
  if (isNewNetWorthEntry(historicalValues)) {
    return flattenHistoricalNetWorthForNewEntry(trendPoints, currentMonthIndex);
  }

  return trendPoints;
}

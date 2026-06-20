import { getTransactionAccountDeltas } from '@/lib/accountTransactionFlow';
import type { NetWorthChartScope } from '@/lib/settings';
import type { SimulatedAccount, Transaction } from '@/types';

/** Up to 6 months of past history on the chart X axis (ends at today). */
export const NET_WORTH_PROJECTION_PAST_DAYS = 180;
/** @deprecated Chart no longer renders future projection; kept for API compatibility. */
export const NET_WORTH_PROJECTION_FUTURE_DAYS = 0;

export type NetWorthChartPeriod = '1W' | '1M' | '3M' | '6M';

export type NetWorthProjectionPoint = {
  dateKey: string;
  date: Date;
  label: string;
  value: number;
  isProjection: boolean;
};

const PERIOD_PAST_EMPHASIS_DAYS: Record<NetWorthChartPeriod, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
};

const DAY_LABELS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const NET_WORTH_VALUE_EPSILON = 0.01;
const NEW_ENTRY_PAST_VALUE_RATIO = 0.1;

type AccountScope = {
  ids: Set<string>;
  namesLower: Set<string>;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function dateKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabelFr(date: Date, isToday: boolean): string {
  const day = date.getDate();
  const monthShort = date.toLocaleDateString('fr-CA', { month: 'short' }).replace('.', '');
  if (isToday) {
    return `${day} ${monthShort.slice(0, 3)}`;
  }
  return DAY_LABELS_FR[date.getDay()] ?? '???';
}

function isEffectivelyZero(value: number): boolean {
  return Math.abs(value) < NET_WORTH_VALUE_EPSILON;
}

function isNewNetWorthEntry(historicalValues: readonly number[]): boolean {
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

function flattenSeriesForNewEntry(points: NetWorthProjectionPoint[]): NetWorthProjectionPoint[] {
  if (points.length < 2) return points;
  const currentValue = points.find((point) => !point.isProjection)?.value ?? points[points.length - 1]?.value ?? 0;
  return points.map((point) => {
    if (point.isProjection) return point;
    return { ...point, value: currentValue };
  });
}

function applyNewEntryFlatBackfill(points: NetWorthProjectionPoint[]): NetWorthProjectionPoint[] {
  const historicalValues = points.filter((point) => !point.isProjection).map((point) => point.value);
  if (!isNewNetWorthEntry(historicalValues)) return points;
  return flattenSeriesForNewEntry(points);
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

function netWorthAtCutoff(
  currentAccountsNetWorth: number,
  transactions: readonly Transaction[],
  cutoffMs: number,
  accountScope: AccountScope,
): number {
  let value = currentAccountsNetWorth;
  const sorted = [...transactions].sort((a, b) => {
    const byDate = parseTxTime(b.date) - parseTxTime(a.date);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });

  for (const tx of sorted) {
    if (parseTxTime(tx.date) > cutoffMs) {
      value -= getTransactionNetWorthDelta(tx, accountScope);
    }
  }

  return value;
}

function buildHistoricalDailyPoints(
  scope: NetWorthChartScope,
  currentNetWorth: number,
  accounts: SimulatedAccount[],
  offAccountAssetsBalance: number,
  transactions: readonly Transaction[],
  dayAnchors: Date[],
  today: Date,
  now: Date,
): NetWorthProjectionPoint[] {
  if (scope === 'accounts_only' && accounts.length === 0) {
    return dayAnchors.map((day) => ({
      dateKey: dateKeyFromDate(day),
      date: day,
      label: dayLabelFr(day, isSameCalendarDay(day, today)),
      value: 0,
      isProjection: false,
    }));
  }
  if (accounts.length === 0 && offAccountAssetsBalance === 0) {
    return dayAnchors.map((day) => ({
      dateKey: dateKeyFromDate(day),
      date: day,
      label: dayLabelFr(day, isSameCalendarDay(day, today)),
      value: 0,
      isProjection: false,
    }));
  }

  const accountScope = buildAccountScopeLookup(accounts);
  const wealthOffset = scope === 'inclusive' ? offAccountAssetsBalance : 0;
  const currentAccountsNetWorth = currentNetWorth - wealthOffset;
  const nowMs = now.getTime();

  return dayAnchors.map((day) => {
    const isToday = isSameCalendarDay(day, today);
    const dayEndMs = isToday ? nowMs : endOfDay(day).getTime();
    const accountsValue = isToday
      ? currentAccountsNetWorth
      : netWorthAtCutoff(currentAccountsNetWorth, transactions, dayEndMs, accountScope);

    return {
      dateKey: dateKeyFromDate(day),
      date: day,
      label: dayLabelFr(day, isToday),
      value: accountsValue + wealthOffset,
      isProjection: false,
    };
  });
}

/**
 * Daily net-worth series from past through today.
 * Past values replay transactions; no future projection is included.
 */
export function buildNetWorthProjectionSeries(
  scope: NetWorthChartScope,
  currentNetWorth: number,
  accounts: SimulatedAccount[],
  offAccountAssetsBalance: number,
  transactions: readonly Transaction[],
  _recurringPayments: readonly unknown[] = [],
  now: Date = new Date(),
  pastDays: number = NET_WORTH_PROJECTION_PAST_DAYS,
  _futureDays: number = NET_WORTH_PROJECTION_FUTURE_DAYS,
): NetWorthProjectionPoint[] {
  const today = startOfDay(now);
  const pastAnchors = Array.from({ length: pastDays + 1 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (pastDays - index));
    return startOfDay(day);
  });

  const historicalPoints = buildHistoricalDailyPoints(
    scope,
    currentNetWorth,
    accounts,
    offAccountAssetsBalance,
    transactions,
    pastAnchors,
    today,
    now,
  );

  return applyNewEntryFlatBackfill(historicalPoints);
}

export function findTodayIndexInProjectionSeries(points: readonly NetWorthProjectionPoint[]): number {
  return Math.max(points.length - 1, 0);
}

/** Zooms the visible window to a past-only span ending at today. */
export function sliceProjectionSeriesForPeriod(
  points: readonly NetWorthProjectionPoint[],
  period: NetWorthChartPeriod,
): NetWorthProjectionPoint[] {
  if (points.length === 0) return [];

  const todayIndex = findTodayIndexInProjectionSeries(points);
  const pastEmphasisDays = PERIOD_PAST_EMPHASIS_DAYS[period];
  const startIndex = Math.max(0, todayIndex - pastEmphasisDays);
  return points.slice(startIndex);
}

export function periodDeltaLabel(period: NetWorthChartPeriod): string {
  if (period === '1W') return 'sem.';
  if (period === '1M') return 'mois';
  if (period === '3M') return '3 mo.';
  return '6 mo.';
}

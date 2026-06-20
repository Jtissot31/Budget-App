import type { NetWorthTrendPoint } from '@/components/PortfolioChartCard';
import {
  NET_WORTH_FUTURE_MONTH_COUNT,
  NET_WORTH_TREND_HISTORICAL_MONTH_COUNT,
} from '@/lib/buildNetWorthTrendSeries';
import {
  buildSavingsGoalDepositEvents,
  cumulativeSavingsDepositsAt,
} from '@/lib/savingsGoalDeposits';
import type { SavingsGoal, SimulatedAccount, Transaction } from '@/types';

const MONTH_LABELS_FR = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];

/**
 * Deterministic demo cumulative savings when there are no goals yet.
 * Ascending curve to showcase the green savings trend line.
 */
const DEMO_SAVINGS_MONTHLY_VALUES = [
  620,
  840,
  980,
  1_120,
  1_350,
  1_480,
  1_720,
  1_890,
  2_050,
  2_240,
  2_410,
  2_680,
  0,
] as const;

function monthLabelFr(date: Date): string {
  return MONTH_LABELS_FR[date.getMonth()] ?? '???';
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

/**
 * Builds monthly cumulative savings points from actual deposits to goals
 * (transfers, linked-account movements, initial saved baseline).
 * Compatible with PortfolioChartCard period slicing and scrub interaction.
 */
export function buildSavingsGoalsTrendSeries(
  goals: readonly SavingsGoal[],
  transactions: readonly Transaction[] = [],
  accounts: readonly SimulatedAccount[] = [],
  now: Date = new Date(),
  historicalMonthCount: number = NET_WORTH_TREND_HISTORICAL_MONTH_COUNT,
  futureMonthCount: number = NET_WORTH_FUTURE_MONTH_COUNT,
): NetWorthTrendPoint[] {
  const anchors = monthAnchorDates(historicalMonthCount, futureMonthCount, now);
  const currentMonthIndex = historicalMonthCount - 1;
  const nowMs = now.getTime();

  if (goals.length === 0) {
    return anchors.map((anchor, index) => ({
      label: monthLabelFr(anchor),
      value: DEMO_SAVINGS_MONTHLY_VALUES[index] ?? 0,
    }));
  }

  const depositEvents = buildSavingsGoalDepositEvents(goals, transactions, accounts, nowMs);

  return anchors.map((anchor, index) => {
    const isFutureMonth = index > currentMonthIndex;
    if (isFutureMonth) {
      return { label: monthLabelFr(anchor), value: 0 };
    }

    const isCurrentMonth = index === currentMonthIndex;
    const cutoffMs = isCurrentMonth
      ? nowMs
      : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    const total = cumulativeSavingsDepositsAt(depositEvents, cutoffMs);
    return { label: monthLabelFr(anchor), value: total };
  });
}

/** Latest cumulative savings total (current month point). */
export function getCurrentSavingsGoalsTotal(
  goals: readonly SavingsGoal[],
  transactions: readonly Transaction[] = [],
  accounts: readonly SimulatedAccount[] = [],
  now: Date = new Date(),
): number {
  const series = buildSavingsGoalsTrendSeries(goals, transactions, accounts, now);
  const currentMonthIndex = NET_WORTH_TREND_HISTORICAL_MONTH_COUNT - 1;
  return series[currentMonthIndex]?.value ?? 0;
}

/**
 * Monthly progression series for a single savings goal.
 * Reuses the same deposit-based logic as the aggregate goals chart.
 */
export function buildSingleGoalTrendSeries(
  goal: SavingsGoal,
  transactions: readonly Transaction[] = [],
  accounts: readonly SimulatedAccount[] = [],
  now: Date = new Date(),
  historicalMonthCount: number = NET_WORTH_TREND_HISTORICAL_MONTH_COUNT,
  futureMonthCount: number = NET_WORTH_FUTURE_MONTH_COUNT,
): NetWorthTrendPoint[] {
  return buildSavingsGoalsTrendSeries(
    [goal],
    transactions,
    accounts,
    now,
    historicalMonthCount,
    futureMonthCount,
  );
}

/** Latest deposit-based balance for one goal (current month point). */
export function getCurrentSingleGoalAmount(
  goal: SavingsGoal,
  transactions: readonly Transaction[] = [],
  accounts: readonly SimulatedAccount[] = [],
  now: Date = new Date(),
): number {
  return getCurrentSavingsGoalsTotal([goal], transactions, accounts, now);
}

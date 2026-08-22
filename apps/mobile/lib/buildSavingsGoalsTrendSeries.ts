import type { NetWorthTrendPoint } from '@/components/PortfolioChartCard';
import {
  NET_WORTH_FUTURE_MONTH_COUNT,
  NET_WORTH_TREND_HISTORICAL_MONTH_COUNT,
} from '@/lib/buildNetWorthTrendSeries';
import {
  buildSavingsGoalDepositEvents,
  cumulativeSavingsDepositsAt,
  type SavingsGoalDepositEvent,
} from '@/lib/savingsGoalDeposits';
import type { SavingsGoal, SimulatedAccount, Transaction } from '@/types';

/** Accueil-aligned period chips for goal contribution sparklines. */
export type GoalContributionChartPeriod = '1M' | '3M' | '6M' | '1A' | '5A';

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

/** True when the series has no visible climb (empty, zeros, or flat). */
function isEffectivelyFlatSeries(values: readonly number[]): boolean {
  if (values.length < 2) return true;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max < 0.01) return true;
  return max - min < Math.max(1, max * 0.02);
}

/** Period start as a fraction of the ending balance — longer windows climb more. */
const DEMO_START_FRACTION: Record<GoalContributionChartPeriod, number> = {
  '1M': 0.82,
  '3M': 0.42,
  '6M': 0.14,
  '1A': 0.05,
  '5A': 0.02,
};

/** Fallback when currentAmount is unset — Fonds d’urgence–scale demo (~6,2 k$). */
const DEMO_FALLBACK_END_AMOUNT = 6_200;

/**
 * Smooth upward cumulative versements for mockup when deposit history is empty/flat.
 * One point per simulated versement — ends exactly at `endAmount`.
 */
export function buildDemoGoalContributionRamp(
  pointCount: number,
  endAmount: number,
  period: GoalContributionChartPeriod,
): number[] {
  const count = Math.max(2, pointCount);
  const end = Math.max(0, endAmount);
  const start = Math.max(0, end * DEMO_START_FRACTION[period]);
  const span = end - start;

  return Array.from({ length: count }, (_, index) => {
    if (index === count - 1) return end;
    const t = index / (count - 1);
    // Smoothstep — steady climb with a soft finish (not a flat line).
    const eased = t * t * (3 - 2 * t);
    // Tiny undulation so the sparkline reads as organic deposits, not a ruler.
    const wobble = Math.sin(t * Math.PI * 2.5) * span * 0.012;
    return Math.max(0, start + span * eased + wobble);
  });
}

/** How many simulated versements to plot per period (one dot each). */
const DEMO_VERSEMENT_COUNT: Record<GoalContributionChartPeriod, number> = {
  '1M': 4,
  '3M': 8,
  '6M': 12,
  '1A': 18,
  '5A': 30,
};

function periodWindowStartMs(period: GoalContributionChartPeriod, now: Date): number {
  const start = new Date(now);
  if (period === '1M') start.setDate(start.getDate() - 30);
  else if (period === '3M') start.setMonth(start.getMonth() - 3);
  else if (period === '6M') start.setMonth(start.getMonth() - 6);
  else if (period === '1A') start.setFullYear(start.getFullYear() - 1);
  else start.setFullYear(start.getFullYear() - 5);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

export type GoalContributionSparkline = {
  values: number[];
  /** Indices that represent actual versements (chart dots). */
  versementIndices: number[];
};

/**
 * Cumulative series with one point per real versement in the selected window.
 * Index 0 is the period-open balance (no versement dot); later indices are deposits.
 */
function buildContributionEventSeries(
  goal: SavingsGoal,
  events: readonly SavingsGoalDepositEvent[],
  period: GoalContributionChartPeriod,
  now: Date,
): GoalContributionSparkline | null {
  const windowStart = periodWindowStartMs(period, now);
  const nowMs = now.getTime();
  const goalEvents = events
    .filter((event) => event.goalId === goal.id && event.amount > 0 && event.ts <= nowMs)
    .sort((a, b) => a.ts - b.ts || a.amount - b.amount);

  const before = goalEvents.filter((event) => event.ts < windowStart);
  const inWindow = goalEvents.filter((event) => event.ts >= windowStart);

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

function resolveSparklineEndAmount(goal: SavingsGoal, depositSeries: readonly number[]): number {
  const fromGoal = Math.max(0, goal.currentAmount);
  const fromDeposits = depositSeries.length > 0 ? Math.max(...depositSeries) : 0;
  const resolved = Math.max(fromGoal, fromDeposits);
  return resolved > 0 ? resolved : DEMO_FALLBACK_END_AMOUNT;
}

/**
 * Contribution sparkline for one goal: one point (and later one dot) per versement.
 * Uses real deposits when available; otherwise a smooth upward demo ramp.
 */
export function buildSingleGoalContributionSparkline(
  goal: SavingsGoal,
  transactions: readonly Transaction[] = [],
  accounts: readonly SimulatedAccount[] = [],
  period: GoalContributionChartPeriod = '6M',
  now: Date = new Date(),
): GoalContributionSparkline {
  const nowMs = now.getTime();
  const events = buildSavingsGoalDepositEvents([goal], transactions, accounts, nowMs);
  const fromEvents = buildContributionEventSeries(goal, events, period, now);

  if (fromEvents && !isEffectivelyFlatSeries(fromEvents.values)) {
    return fromEvents;
  }

  const endAmount = resolveSparklineEndAmount(goal, fromEvents?.values ?? []);
  const values = buildDemoGoalContributionRamp(DEMO_VERSEMENT_COUNT[period], endAmount, period);
  return {
    values,
    versementIndices: values.map((_, index) => index),
  };
}

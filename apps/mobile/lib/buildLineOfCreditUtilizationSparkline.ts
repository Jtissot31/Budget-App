import type { LineOfCreditBalanceHistoryResult } from '@/lib/buildLineOfCreditBalanceHistory';
import {
  buildDemoGoalContributionRamp,
  type GoalContributionChartPeriod,
  type GoalContributionSparkline,
} from '@/lib/buildSavingsGoalsTrendSeries';

export type LocUtilizationChartPeriod = GoalContributionChartPeriod;

/** How many month-end anchors to keep for each period chip. */
const PERIOD_MONTH_COUNT: Record<LocUtilizationChartPeriod, number> = {
  '1M': 2,
  '3M': 3,
  '6M': 6,
  '1A': 12,
  '5A': 24,
};

const DEMO_POINT_COUNT: Record<LocUtilizationChartPeriod, number> = {
  '1M': 4,
  '3M': 8,
  '6M': 12,
  '1A': 18,
  '5A': 30,
};

function isEffectivelyFlatSeries(values: readonly number[]): boolean {
  if (values.length < 2) return true;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max < 0.01) return true;
  return max - min < Math.max(1, max * 0.02);
}

/**
 * Used-balance sparkline for a line of credit — same Accueil / goal-detail language
 * as loan repayment (month anchors from history, demo ramp when flat/missing).
 */
export function buildLineOfCreditUtilizationSparkline(params: {
  balanceHistory?: LineOfCreditBalanceHistoryResult | null;
  currentUsed: number;
  period?: LocUtilizationChartPeriod;
}): GoalContributionSparkline {
  const {
    balanceHistory = null,
    currentUsed,
    period = '6M',
  } = params;

  const endUsed = Math.max(currentUsed, 0);
  const monthCount = PERIOD_MONTH_COUNT[period];
  const historyPoints = balanceHistory?.points ?? [];

  if (historyPoints.length >= 2) {
    const sliced = historyPoints.slice(-Math.min(monthCount, historyPoints.length));
    const values = sliced.map((point) => Math.max(point.value, 0));
    if (values.length >= 2) {
      values[values.length - 1] = endUsed;
      if (!isEffectivelyFlatSeries(values)) {
        return {
          values,
          versementIndices: values.map((_, index) => index),
        };
      }
    }
  }

  if (endUsed < 0.01) {
    return { values: [0, 0], versementIndices: [1] };
  }

  const values = buildDemoGoalContributionRamp(DEMO_POINT_COUNT[period], endUsed, period);
  return {
    values,
    versementIndices: values.map((_, index) => index),
  };
}

import { useMemo, useState } from 'react';
import { DetailPeriodSparkChart } from '@/components/DetailPeriodSparkChart';
import {
  buildSingleGoalContributionSparkline,
  type GoalContributionChartPeriod,
} from '@/lib/buildSavingsGoalsTrendSeries';
import type { SavingsGoal, SimulatedAccount, Transaction } from '@/types';

type Props = {
  goal: SavingsGoal;
  transactions?: readonly Transaction[];
  accounts?: readonly SimulatedAccount[];
  /**
   * @deprecated Accueil-style chart no longer shows a total amount hero.
   * Kept for call-site compatibility; ignored.
   */
  showAmountHero?: boolean;
};

/**
 * Goal contribution chart — Accueil valeur-nette language via shared
 * DetailPeriodSparkChart (delta pill, sparkline, period chips).
 */
export function GoalProgressChart({
  goal,
  transactions = [],
  accounts = [],
}: Props) {
  const [chartPeriod, setChartPeriod] = useState<GoalContributionChartPeriod>('6M');

  const sparkline = useMemo(
    () =>
      buildSingleGoalContributionSparkline(goal, transactions, accounts, chartPeriod),
    [accounts, chartPeriod, goal, transactions],
  );

  return (
    <DetailPeriodSparkChart
      sparkline={sparkline}
      period={chartPeriod}
      onPeriodChange={setChartPeriod}
      risingIsPositive
    />
  );
}

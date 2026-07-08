import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { HeroChartDelta } from '@/components/HeroChartDelta';
import { NetWorthAmountRow } from '@/components/NetWorthAmountRow';
import {
  PortfolioChartCard,
  type NetWorthChartPeriod,
  type PortfolioChartCardHandle,
  type PortfolioChartCardPeriodData,
} from '@/components/PortfolioChartCard';
import { spacing } from '@/constants/theme';
import {
  buildSingleGoalTrendSeries,
  getCurrentSingleGoalAmount,
} from '@/lib/buildSavingsGoalsTrendSeries';
import type { SavingsGoal, SimulatedAccount, Transaction } from '@/types';

const GOAL_CHART_LINE = '#4ADE80';
const GOAL_CHART_PERIODS: NetWorthChartPeriod[] = ['1M', '3M', '6M', 'CA', '1A'];

export type GoalProgressChartHandle = PortfolioChartCardHandle;

export const GoalProgressChart = forwardRef<
  GoalProgressChartHandle,
  {
    goal: SavingsGoal;
    transactions?: readonly Transaction[];
    accounts?: readonly SimulatedAccount[];
  }
>(function GoalProgressChart({ goal, transactions = [], accounts = [] }, ref) {
  const chartRef = useRef<PortfolioChartCardHandle>(null);
  const [periodData, setPeriodData] = useState<PortfolioChartCardPeriodData | null>(null);
  const points = useMemo(
    () => buildSingleGoalTrendSeries(goal, transactions, accounts),
    [accounts, goal, transactions],
  );
  const fallbackTotal = useMemo(
    () => getCurrentSingleGoalAmount(goal, transactions, accounts),
    [accounts, goal, transactions],
  );

  const handlePeriodData = useCallback((data: PortfolioChartCardPeriodData) => {
    setPeriodData((prev) => {
      if (
        prev &&
        prev.period === data.period &&
        prev.currentValue === data.currentValue &&
        prev.delta === data.delta &&
        prev.deltaPercent === data.deltaPercent &&
        prev.selectedIndex === data.selectedIndex &&
        prev.selectedLabel === data.selectedLabel
      ) {
        return prev;
      }
      return data;
    });
  }, []);

  const clearSelection = useCallback(() => {
    chartRef.current?.clearSelection();
  }, []);

  useImperativeHandle(ref, () => ({ clearSelection }), [clearSelection]);

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={clearSelection}
        style={styles.heroBlock}
        accessibilityRole="none"
        accessibilityLabel="Effacer la sélection du graphique"
      >
        <DashboardSectionLabel style={styles.heroEyebrow}>PROGRESSION</DashboardSectionLabel>
        <NetWorthAmountRow totalBalance={periodData?.currentValue ?? fallbackTotal} />
        <HeroChartDelta periodData={periodData} />
      </Pressable>
      <Pressable
        onPress={clearSelection}
        accessibilityRole="none"
        accessibilityLabel="Effacer la sélection du graphique"
      >
        <PortfolioChartCard
          ref={chartRef}
          points={points}
          onPeriodData={handlePeriodData}
          lineColor={GOAL_CHART_LINE}
          allowedPeriods={GOAL_CHART_PERIODS}
        />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
    width: '100%',
    gap: 0,
  },
  heroBlock: {
    alignItems: 'flex-start',
    gap: 0,
    marginBottom: spacing.sm,
  },
  heroEyebrow: {
    marginBottom: 6,
  },
});

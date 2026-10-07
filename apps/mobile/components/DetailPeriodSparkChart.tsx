import { useCallback, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { SparklineChart } from '@/components/SparklineChart';
import { typographyKit } from '@/constants/theme';
import type {
  GoalContributionChartPeriod,
  GoalContributionSparkline,
} from '@/lib/buildSavingsGoalsTrendSeries';
import {
  COMPACT_DELTA_K_THRESHOLD,
  formatSignedDisplayMoney,
} from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const PERIOD_TABS: { id: GoalContributionChartPeriod; label: string }[] = [
  { id: '1M', label: '1M' },
  { id: '3M', label: '3M' },
  { id: '6M', label: '6M' },
  { id: '1A', label: '1A' },
  { id: '5A', label: '5A' },
];

const SPARKLINE_HEIGHT = 96;

export type DetailPeriodSparkChartProps = {
  sparkline: GoalContributionSparkline;
  period: GoalContributionChartPeriod;
  onPeriodChange: (period: GoalContributionChartPeriod) => void;
  /**
   * When true (default), a rising series paints green (savings / repaid).
   * When false, a rising series paints red (credit utilization).
   */
  risingIsPositive?: boolean;
};

/**
 * Shared Accueil / goal-detail spark language: delta pill, sparkline, period chips.
 * Used by goal contribution, loan repayment, and line-of-credit utilization charts.
 */
export function DetailPeriodSparkChart({
  sparkline,
  period,
  onPeriodChange,
  risingIsPositive = true,
}: DetailPeriodSparkChartProps) {
  const { colors } = useAppTheme();
  const [chartWidth, setChartWidth] = useState(0);
  const sparklineValues = sparkline.values;

  const first = sparklineValues[0] ?? 0;
  const last = sparklineValues[sparklineValues.length - 1] ?? 0;
  const amount = sparklineValues.length < 2 ? 0 : last - first;
  const pct =
    sparklineValues.length < 2
      ? 0
      : Math.abs(first) >= 0.01
        ? (amount / Math.abs(first)) * 100
        : last !== 0
          ? 100
          : 0;

  const seriesRising = amount >= 0;
  const heroPositive = risingIsPositive ? seriesRising : !seriesRising;

  const onChartLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setChartWidth((prev) => (prev === next ? prev : next));
  }, []);

  return (
    <View style={styles.heroBlock}>
      <View style={styles.deltaWrap}>
        <View style={[styles.deltaPill, { backgroundColor: colors.surfaceElevated }]}>
          <AppIcon
            family="ionicons"
            name={seriesRising ? 'arrow-up-outline' : 'arrow-down-outline'}
            size={11}
            color={heroPositive ? colors.accentGreen : colors.danger}
          />
          <Text
            style={[
              styles.deltaText,
              { color: heroPositive ? colors.accentGreen : colors.danger },
            ]}
          >
            {formatSignedDisplayMoney(amount, {
              leadingPlusWhenPositive: true,
              compactKThreshold: COMPACT_DELTA_K_THRESHOLD,
            })}{' '}
            · {seriesRising ? '+' : '−'}
            {Math.abs(pct).toFixed(1)}%
          </Text>
        </View>
      </View>

      <View style={styles.chartWrap} onLayout={onChartLayout}>
        {chartWidth > 0 && sparklineValues.length >= 2 ? (
          <SparklineChart
            data={sparklineValues}
            width={chartWidth}
            height={SPARKLINE_HEIGHT}
            positive={heroPositive}
            showFill
            showPointDots
            pointDotIndices={sparkline.versementIndices}
            strokeWidth={2}
          />
        ) : (
          <View style={{ height: SPARKLINE_HEIGHT }} />
        )}
      </View>

      <View style={styles.periodRow}>
        <SegmentedTabs
          tabs={PERIOD_TABS}
          active={period}
          onChange={(id) => {
            tapHaptic();
            onPeriodChange(id);
          }}
          size="section"
          variant="bare"
          showDivider={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroBlock: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  deltaWrap: { marginTop: 2, maxWidth: '100%' },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    maxWidth: '100%',
  },
  deltaText: {
    ...typographyKit.metaSemibold,
    fontSize: 10,
    flexShrink: 1,
  },
  chartWrap: {
    width: '100%',
    minHeight: SPARKLINE_HEIGHT,
    marginTop: 4,
  },
  periodRow: {
    width: '100%',
    marginTop: 14,
  },
});

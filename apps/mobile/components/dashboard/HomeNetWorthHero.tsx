import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { HeroChartDelta } from '@/components/HeroChartDelta';
import { NetWorthAmountRow } from '@/components/NetWorthAmountRow';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { SparklineChart } from '@/components/chat/SparklineChart';
import type { PortfolioChartCardPeriodData } from '@/components/PortfolioChartCard';
import { radius, spacing } from '@/constants/theme';

type Props = {
  totalNetWorth: number;
  sparklineValues: number[];
  periodData: PortfolioChartCardPeriodData | null;
};

export function HomeNetWorthHero({ totalNetWorth, sparklineValues, periodData }: Props) {
  const [chartWidth, setChartWidth] = useState(0);

  const handleChartLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== chartWidth) {
      setChartWidth(nextWidth);
    }
  };

  return (
    <View style={styles.block}>
      <DashboardSectionLabel style={styles.eyebrow}>VALEUR NETTE</DashboardSectionLabel>

      <NetWorthAmountRow totalBalance={periodData?.currentValue ?? totalNetWorth} />

      <HeroChartDelta periodData={periodData} />

      {sparklineValues.length >= 2 ? (
        <View style={styles.sparklineWrap} onLayout={handleChartLayout}>
          {chartWidth > 0 ? (
            <SparklineChart data={sparklineValues} width={chartWidth} height={56} positive />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.sm,
  },
  eyebrow: {
    marginBottom: spacing.xs,
  },
  sparklineWrap: {
    width: '100%',
    minHeight: 56,
    marginTop: spacing.xs,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
});

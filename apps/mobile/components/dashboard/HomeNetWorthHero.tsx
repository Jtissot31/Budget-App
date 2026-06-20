import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HeroChartDelta } from '@/components/HeroChartDelta';
import { NetWorthAmountRow } from '@/components/NetWorthAmountRow';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { SparklineChart } from '@/components/chat/SparklineChart';
import type { PortfolioChartCardPeriodData } from '@/components/PortfolioChartCard';
import {
  interBoldText,
  interSemiboldText,
  radius,
  spacing,
} from '@/constants/theme';
import { netWorthHeroAmount } from '@/lib/textLayout';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  totalNetWorth: number;
  sparklineValues: number[];
  periodData: PortfolioChartCardPeriodData | null;
};

export function HomeNetWorthHero({ totalNetWorth, sparklineValues, periodData }: Props) {
  const { colors } = useAppTheme();
  const [balancesHidden, setBalancesHidden] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);

  const handleChartLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== chartWidth) {
      setChartWidth(nextWidth);
    }
  };

  const maskedLabel = useMemo(() => '••••••', []);

  return (
    <View style={styles.block}>
      <DashboardSectionLabel style={styles.eyebrow}>VALEUR NETTE</DashboardSectionLabel>

      <View style={styles.amountRow}>
        {balancesHidden ? (
          <Text style={[styles.maskedAmount, { color: colors.text }, interBoldText]}>{maskedLabel}</Text>
        ) : (
          <NetWorthAmountRow totalBalance={periodData?.currentValue ?? totalNetWorth} />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={balancesHidden ? 'Afficher les montants' : 'Masquer les montants'}
          hitSlop={10}
          onPress={() => {
            tapHaptic();
            setBalancesHidden((current) => !current);
          }}
          style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons
            name={balancesHidden ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>

      {!balancesHidden ? <HeroChartDelta periodData={periodData} /> : null}

      {!balancesHidden && sparklineValues.length >= 2 ? (
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
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  eyeButton: {
    padding: spacing.xs,
  },
  maskedAmount: {
    ...netWorthHeroAmount,
    letterSpacing: 2,
  },
  sparklineWrap: {
    width: '100%',
    minHeight: 56,
    marginTop: spacing.xs,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.78,
  },
});

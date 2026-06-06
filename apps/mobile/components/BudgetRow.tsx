import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CategoryBudget } from '@/types';
import { GlassContainer } from '@/components/GlassContainer';
import { ProgressBar } from './ProgressBar';
import { radius, spacing, typography } from '@/constants/theme';
import { categoryBudgetBarColor, getCategoryBudgetUsage } from '@/lib/categoryBudgetUsage';
import { rowLabel, rowTitleTextProps, rowValue, rowValueContainer, singleLineAmountProps } from '@/lib/textLayout';
import { UNIFORM_ROW_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import { useAppTheme } from '@/lib/themeContext';

type Props = { budget: CategoryBudget };

export function BudgetRow({ budget }: Props) {
  const { colors, ghostCardShadow, isLight } = useAppTheme();
  const usage = useMemo(
    () => getCategoryBudgetUsage(budget.limitAmount, budget.spent),
    [budget.limitAmount, budget.spent],
  );
  const barColor = categoryBudgetBarColor(
    usage.usagePercent,
    usage.isZeroLimitOverspend,
    isLight,
    budget.categoryColor,
    colors,
  );
  const remaining = usage.isZeroLimitOverspend ? 0 : Math.max(0, usage.limit - usage.spent);

  return (
    <GlassContainer style={ghostCardShadow} borderRadius={radius.xxl} padding={spacing.lg} innerStyle={styles.rowInner}>
      <View style={styles.top}>
        <Text style={styles.icon}>{budget.categoryIcon}</Text>
        <Text style={[styles.name, { color: colors.text }]} {...rowTitleTextProps}>
          {budget.categoryName}
        </Text>
        <Text style={[styles.remaining, { color: colors.textMuted }]} {...singleLineAmountProps}>
          {remaining.toFixed(0)} $
        </Text>
      </View>
      <ProgressBar progress={usage.progress} color={barColor} />
      <View style={styles.footer}>
        {usage.statusLabel ? (
          <Text style={[styles.meta, { color: barColor, fontWeight: '700' }]}>{usage.statusLabel}</Text>
        ) : null}
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {usage.isZeroLimitOverspend
            ? `${budget.spent.toFixed(0)} $ dépensé · 0 $ alloué`
            : `${budget.spent.toFixed(0)} / ${budget.limitAmount.toFixed(0)} $`}
        </Text>
        {budget.weeklyLimitAmount != null ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {budget.weeklyLimitAmount.toFixed(0)} $ / semaine
          </Text>
        ) : null}
      </View>
    </GlassContainer>
  );
}

const styles = StyleSheet.create({
  rowInner: {
    gap: spacing.sm,
    minHeight: UNIFORM_ROW_MIN_HEIGHT,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { fontSize: 18 },
  name: { ...rowLabel, fontWeight: '800' },
  remaining: { ...rowValue, ...rowValueContainer, textAlign: 'right' },
  footer: { gap: 2 },
  meta: { fontSize: typography.micro },
});

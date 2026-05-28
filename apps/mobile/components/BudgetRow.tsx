import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CategoryBudget } from '@/types';
import { ProgressBar } from './ProgressBar';
import { radius, spacing, typography } from '@/constants/theme';
import { categoryBudgetBarColor, getCategoryBudgetUsage } from '@/lib/categoryBudgetUsage';
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
    <View style={[styles.row, ghostCardShadow, { backgroundColor: colors.surfaceSolid }]}>
      <View style={styles.top}>
        <Text style={styles.icon}>{budget.categoryIcon}</Text>
        <Text style={[styles.name, { color: colors.text }]}>
          {budget.categoryName}
        </Text>
        <Text style={[styles.remaining, { color: colors.textMuted }]}>{remaining.toFixed(0)} $</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { fontSize: 18 },
  name: { flex: 1, minWidth: 0, fontWeight: '800', fontSize: typography.body, lineHeight: typography.body + 4 },
  remaining: { fontSize: typography.caption, fontWeight: '700', flexShrink: 0 },
  footer: { gap: 2 },
  meta: { fontSize: typography.micro },
});

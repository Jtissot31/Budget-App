import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '@/components/ProgressBar';
import { spacing, typography } from '@/constants/theme';
import { categoryBudgetBarColor, getCategoryBudgetUsage } from '@/lib/categoryBudgetUsage';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { portfolioNumericText } from '@/lib/textLayout';
import type { CategoryBudget } from '@/types';

type Props = {
  budget: Pick<CategoryBudget, 'limitAmount' | 'spent' | 'categoryColor' | 'categoryName'>;
  /** Liste agenda : barre seulement si dépassement à limite 0 $. */
  compactOverspendOnly?: boolean;
};

function formatMoney(value: number) {
  return formatDisplayMoneyAbsolute(value);
}

export function CategoryBudgetProgress({ budget, compactOverspendOnly = false }: Props) {
  const { colors, isLight } = useAppTheme();
  const usage = useMemo(
    () => getCategoryBudgetUsage(budget.limitAmount, budget.spent),
    [budget.limitAmount, budget.spent],
  );

  if (compactOverspendOnly && !usage.isZeroLimitOverspend) {
    return null;
  }

  const barColor = categoryBudgetBarColor(
    usage.usagePercent,
    usage.isZeroLimitOverspend,
    isLight,
    budget.categoryColor,
    colors,
  );
  const labelColor = usage.isOverBudget ? barColor : colors.textMuted;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textSecondary }]} numberOfLines={1}>
          {budget.categoryName}
        </Text>
        {usage.statusLabel ? (
          <Text style={[styles.status, { color: labelColor }]} numberOfLines={1}>
            {usage.statusLabel}
          </Text>
        ) : usage.limit > 0 ? (
          <Text style={[styles.status, { color: labelColor }]}>{`${usage.usagePercent} %`}</Text>
        ) : null}
      </View>
      <ProgressBar progress={usage.progress} color={barColor} />
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        {usage.isZeroLimitOverspend
          ? `${formatMoney(usage.spent)} dépensé · 0$ alloué`
          : `${formatMoney(usage.spent)} / ${formatMoney(usage.limit)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    alignSelf: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.meta,
    fontWeight: '700',
  },
  status: {
    flexShrink: 0,
    fontSize: typography.meta,
    fontWeight: '800',
  },
  meta: {
    ...portfolioNumericText,
    fontSize: typography.micro,
    lineHeight: typography.micro + 3,
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { ProgressBar } from '@/components/ProgressBar';
import {
  PLAN_FINANCE_CONTAINER,
  planFinanceContainerPressedStyle,
} from '@/constants/planFinanceKit';
import {
  jakartaSemiboldText,
  moneyAmountTypography,
  spacing,
  typographyKit,
} from '@/constants/theme';
import {
  BUDGET_GREEN_MAX_PERCENT,
  categoryBudgetBarColor,
  categoryBudgetBarOpacity,
  categoryBudgetBarTrackColor,
} from '@/lib/categoryBudgetUsage';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import type { BudgetCategoryUiModel } from '@/lib/budgetCategoryModel';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  category: BudgetCategoryUiModel;
  selected?: boolean;
  onPress: (id: string) => void;
};

export function BudgetCategoryRow({
  category,
  selected = false,
  onPress,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const barColor = categoryBudgetBarColor(
    category.spent,
    category.limit,
    isLight,
    category.color,
    colors,
  );
  const barOpacity = categoryBudgetBarOpacity(category.usage);
  const barTrackColor = categoryBudgetBarTrackColor(category.spent, category.limit);
  const showUsagePercent =
    category.limit > 0 && category.usage.usagePercent >= BUDGET_GREEN_MAX_PERCENT;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${category.name}, ${formatDisplayMoneyAbsolute(category.spent)} sur ${formatDisplayMoneyAbsolute(category.limit)}`}
      onPress={() => {
        tapHaptic();
        onPress(category.id);
      }}
      style={({ pressed }) => [pressed && planFinanceContainerPressedStyle()]}
    >
      <PlanFinanceContainer
        style={[
          styles.card,
          selected && { borderColor: colors.success, backgroundColor: colors.successMuted },
        ]}
      >
        <View style={styles.mainRow}>
          <BudgetCategoryIcon icon={category.icon} name={category.name} id={category.id} />

          <View style={styles.content}>
            <View style={styles.titleRow}>
              <View style={styles.nameCol}>
                <Text
                  style={[styles.name, jakartaSemiboldText, { color: colors.text }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {category.name}
                </Text>
              </View>
              <View style={styles.amountsCol}>
                <Text
                  style={[moneyAmountTypography({ tier: 'row' }), styles.spentAmount, { color: colors.text }]}
                >
                  {formatDisplayMoneyAbsolute(category.spent)}
                </Text>
                <Text style={[styles.limitText, typographyKit.caption, { color: colors.textMuted }]}>
                  {' / '}
                  {formatDisplayMoneyAbsolute(category.limit)}
                </Text>
              </View>
            </View>

            <View style={styles.barRow}>
              <View style={styles.barTrack}>
                <ProgressBar
                  progress={category.usage.progress}
                  color={barColor}
                  height={3}
                  fillOpacity={barOpacity}
                  trackColor={barTrackColor}
                />
              </View>
              {showUsagePercent ? (
                <Text
                  style={[styles.barPercent, typographyKit.microMedium, { color: barColor }]}
                >
                  {category.usage.usagePercent} %
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </PlanFinanceContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    padding: PLAN_FINANCE_CONTAINER.padding.row,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
  },
  amountsCol: {
    flexDirection: 'row',
    flexShrink: 0,
    flexWrap: 'nowrap',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
  },
  spentAmount: {
    flexShrink: 0,
  },
  limitText: {
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 16,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barTrack: {
    flex: 1,
    minWidth: 0,
  },
  barPercent: {
    flexShrink: 0,
    fontSize: 11,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
});

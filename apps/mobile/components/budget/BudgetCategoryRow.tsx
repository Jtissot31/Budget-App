import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { ProgressBar } from '@/components/ProgressBar';
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
  embedded?: boolean;
  isLast?: boolean;
};

export function BudgetCategoryRow({
  category,
  selected = false,
  onPress,
  embedded = false,
  isLast = false,
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
      onPress={() => {
        tapHaptic();
        onPress(category.id);
      }}
      style={({ pressed }) => [
        styles.row,
        embedded && styles.rowEmbedded,
        selected && {
          backgroundColor: colors.successMuted,
        },
        pressed && styles.pressed,
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

      {embedded && !isLast ? (
        <View style={styles.divider} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowEmbedded: {
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.88,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
});

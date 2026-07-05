import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from '@/components/ProgressBar';
import { getCategoryIconName } from '@/constants/categoryOptions';
import {
  jakartaSemiboldText,
  moneyAmountTypography,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import {
  BUDGET_GREEN_MAX_PERCENT,
  categoryBudgetBarColor,
  categoryBudgetBarOpacity,
  categoryStatusTagLabel,
  shouldShowCategoryStatusTag,
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

function CategoryStatusIndicator({
  statusText,
  barColor,
  usagePercent,
}: {
  statusText: string;
  barColor: string;
  usagePercent: number;
}) {
  const isAtLimit = usagePercent === BUDGET_GREEN_MAX_PERCENT;

  return (
    <View style={styles.statusInline} accessibilityLabel={statusText}>
      {isAtLimit ? (
        <Ionicons name="checkmark-circle" size={14} color={barColor} />
      ) : (
        <View style={[styles.statusDot, { backgroundColor: barColor }]} />
      )}
      <Text style={[styles.statusCaption, { color: barColor }]}>{statusText}</Text>
    </View>
  );
}

export function BudgetCategoryRow({
  category,
  selected = false,
  onPress,
  embedded = false,
  isLast = false,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const iconWellBg = isLight ? colors.surfaceElevated : colors.input;
  const barColor = categoryBudgetBarColor(
    category.spent,
    category.limit,
    isLight,
    category.color,
    colors,
  );
  const barOpacity = categoryBudgetBarOpacity(category.usage);
  const showStatusTag = shouldShowCategoryStatusTag(category.usage);
  const statusText = categoryStatusTagLabel(category.usage);
  const iconName = getCategoryIconName({
    icon: category.icon,
    name: category.name,
  });

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
        <View
          style={[
            styles.iconWell,
            {
              backgroundColor: iconWellBg,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name={iconName} size={18} color={colors.textSecondary} />
        </View>

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
              {showStatusTag ? (
                <CategoryStatusIndicator
                  statusText={statusText}
                  barColor={barColor}
                  usagePercent={category.usage.usagePercent}
                />
              ) : null}
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

          <View>
            <ProgressBar
              progress={category.usage.progress}
              color={barColor}
              height={3}
              fillOpacity={barOpacity}
            />
          </View>
        </View>
      </View>

      {embedded && !isLast ? (
        <View style={[styles.divider, { backgroundColor: colors.containerBorder }]} />
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
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
    gap: 2,
  },
  name: {
    fontSize: 14,
    lineHeight: 18,
  },
  statusInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    flexShrink: 0,
  },
  statusCaption: {
    ...typographyKit.metaMedium,
    flexShrink: 0,
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
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: spacing.xs,
  },
});

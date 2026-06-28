import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '@/components/ProgressBar';
import {
  ICON_WELL_SIZE,
  PAGE_PADDING_HORIZONTAL,
  containerSurfaceStyle,
  jakartaSemiboldText,
  moneyAmountTypography,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { categoryBudgetBarColor } from '@/lib/categoryBudgetUsage';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import type { BudgetCategoryUiModel } from '@/lib/budgetCategoryModel';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  category: BudgetCategoryUiModel;
  selected?: boolean;
  onPress: (id: string) => void;
};

export function BudgetCategoryRow({ category, selected = false, onPress }: Props) {
  const { colors, isLight } = useAppTheme();
  const surface = containerSurfaceStyle(isLight);
  const iconWellBg = isLight ? colors.surfaceElevated : colors.input;
  const barColor = categoryBudgetBarColor(
    category.usage.usagePercent,
    category.usage.isZeroLimitOverspend,
    isLight,
    category.color,
    colors,
  );

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
        surface,
        selected && {
          borderColor: colors.accentGreen,
          backgroundColor: colors.successMuted,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.leading}>
          <View
            style={[
              styles.swatchWell,
              {
                backgroundColor: iconWellBg,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: category.color }]} />
          </View>
          <View style={styles.titleBlock}>
            <Text
              style={[styles.name, jakartaSemiboldText, { color: colors.text }]}
              numberOfLines={1}
            >
              {category.name}
            </Text>
            {category.usage.statusLabel ? (
              <Text style={[styles.status, typographyKit.caption, { color: barColor }]} numberOfLines={1}>
                {category.usage.statusLabel}
              </Text>
            ) : (
              <Text style={[styles.usageHint, typographyKit.caption, { color: colors.textMuted }]}>
                {category.usage.usagePercent} % utilisé
              </Text>
            )}
          </View>
        </View>
        <View style={styles.trailing}>
          <Text
            style={[styles.amounts, moneyAmountTypography({ tier: 'row' }), { color: colors.text }]}
            numberOfLines={1}
          >
            {formatDisplayMoneyAbsolute(category.spent)}
          </Text>
          <Text style={[styles.limit, typographyKit.caption, { color: colors.textMuted }]}>
            sur {formatDisplayMoneyAbsolute(category.limit)}
          </Text>
        </View>
      </View>
      <ProgressBar progress={category.usage.progress} color={barColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: radius.card,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  pressed: {
    opacity: 0.88,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  leading: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  swatchWell: {
    width: ICON_WELL_SIZE,
    height: ICON_WELL_SIZE,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    fontSize: 14,
    lineHeight: 18,
  },
  status: {
    fontSize: 11,
    lineHeight: 14,
  },
  usageHint: {
    fontSize: 11,
    lineHeight: 14,
  },
  trailing: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
    paddingTop: 1,
  },
  amounts: {},
  limit: {
    fontSize: 11,
    lineHeight: 14,
  },
});

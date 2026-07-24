import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { ProgressBar } from '@/components/ProgressBar';
import {
  jakartaSemiboldText,
  moneyAmountTypography,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import {
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

const ICON_WELL = 32;
const ICON_GLYPH = 16;

/** Compact 2-column category card — Budget page mockup layout. */
export function BudgetCategoryRow({ category, selected = false, onPress }: Props) {
  const { colors, isLight } = useAppTheme();
  const barColor = categoryBudgetBarColor(
    category.spent,
    category.limit,
    isLight,
    category.color,
    colors,
  );
  const barOpacity = categoryBudgetBarOpacity(category.usage);
  const barTrackColor =
    categoryBudgetBarTrackColor(category.spent, category.limit) ?? colors.border;
  const borderColor = selected ? colors.textSecondary : colors.containerBorder;
  const backgroundColor = selected ? colors.surfaceElevated : colors.containerBackground;
  const iconWellBg = isLight ? colors.surfaceElevated : colors.input;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${category.name}, ${formatDisplayMoneyAbsolute(category.spent)} sur ${formatDisplayMoneyAbsolute(category.limit)}, ${category.usage.usagePercent} %`}
      onPress={() => {
        tapHaptic();
        onPress(category.id);
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor,
          borderColor,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconWell, { backgroundColor: iconWellBg }]}>
          <BudgetCategoryIcon
            icon={category.icon}
            name={category.name}
            id={category.id}
            wellSize={ICON_WELL}
            glyphSize={ICON_GLYPH}
          />
        </View>
        <Text
          style={[styles.name, jakartaSemiboldText, { color: colors.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {category.name}
        </Text>
      </View>

      <View style={styles.metrics}>
        <View style={styles.amountRow}>
          <Text
            style={[
              moneyAmountTypography({
                tier: 'card',
                fontSize: 16,
                lineHeight: 20,
                letterSpacing: -0.3,
              }),
              { color: colors.text },
            ]}
            numberOfLines={1}
          >
            {formatDisplayMoneyAbsolute(category.spent)}
          </Text>
          <Text
            style={[styles.limit, typographyKit.microMedium, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {formatDisplayMoneyAbsolute(category.limit)}
          </Text>
        </View>

        <View style={styles.barTrack}>
          <ProgressBar
            progress={category.usage.progress}
            color={barColor}
            height={3}
            fillOpacity={barOpacity}
            trackColor={barTrackColor}
          />
        </View>

        <Text style={[styles.pct, typographyKit.microMedium, { color: barColor }]}>
          {`${category.usage.usagePercent}%`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  pressed: {
    opacity: 0.82,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  iconWell: {
    width: ICON_WELL,
    height: ICON_WELL,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: 13.5,
    lineHeight: 17,
    letterSpacing: -0.1,
    includeFontPadding: false,
  },
  metrics: {
    gap: spacing.sm,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  limit: {
    flexShrink: 0,
    fontSize: 11,
    lineHeight: 14,
  },
  barTrack: {
    alignSelf: 'stretch',
  },
  pct: {
    alignSelf: 'flex-end',
    fontSize: 10,
    lineHeight: 13,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
});

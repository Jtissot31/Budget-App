/**
 * Budget Proto category row — full-width list style (Figma).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { ProgressBar } from '@/components/ProgressBar';
import {
  jakartaSemiboldText,
  moneyAmountTypography,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import type { BudgetCategoryUiModel } from '@/lib/budgetCategoryModel';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  category: BudgetCategoryUiModel;
  selected?: boolean;
  onPress: (id: string) => void;
  /** When true, omit bottom divider (last row in a stacked card). */
  isLast?: boolean;
};

const ICON_WELL = 36;
const ICON_GLYPH = 16;

export function BudgetCategoryRow({ category, selected = false, onPress, isLast = true }: Props) {
  const { colors } = useAppTheme();
  const over = category.limit > 0 && category.spent > category.limit;
  const remaining = category.limit - category.spent;
  const pct = category.limit > 0 ? category.spent / category.limit : 0;
  const barColor = over ? colors.danger : 'rgba(255,255,255,0.25)';
  const spentColor = over ? colors.danger : colors.text;
  const statusColor = over ? colors.danger : colors.textMuted;
  const statusLabel =
    category.spent === 0
      ? 'Aucune dépense'
      : over
        ? `−${formatDisplayMoneyAbsolute(Math.abs(remaining))} dépassé`
        : `${formatDisplayMoneyAbsolute(remaining)} restant`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${category.name}, ${formatDisplayMoneyAbsolute(category.spent)} sur ${formatDisplayMoneyAbsolute(category.limit)}`}
      onPress={() => {
        tapHaptic();
        onPress(category.id);
      }}
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.top}>
        <View
          style={[
            styles.iconWell,
            { backgroundColor: over ? 'rgba(248,113,113,0.12)' : colors.surfaceElevated },
          ]}
        >
          <BudgetCategoryIcon
            icon={category.icon}
            name={category.name}
            id={category.id}
            wellSize={ICON_WELL}
            glyphSize={ICON_GLYPH}
          />
        </View>
        <Text style={[styles.name, jakartaSemiboldText, { color: colors.text }]}>
          {category.name}
        </Text>
        <View style={styles.amounts}>
          <Text
            style={[
              moneyAmountTypography({
                tier: 'card',
                fontSize: 14,
                lineHeight: 18,
              }),
              { color: spentColor, letterSpacing: -0.3 },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {formatDisplayMoneyAbsolute(category.spent)}
          </Text>
          <Text
            style={[styles.limit, { color: colors.textMuted }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            / {formatDisplayMoneyAbsolute(category.limit)}
          </Text>
        </View>
      </View>

      <View style={styles.barWrap}>
        <ProgressBar
          progress={Math.min(1, Math.max(0, pct))}
          color={barColor}
          trackColor={colors.borderSubtle}
          height={4}
        />
      </View>
      <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  pressed: { opacity: 0.85 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconWell: {
    width: ICON_WELL,
    height: ICON_WELL,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 18,
  },
  amounts: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    flexShrink: 0,
    maxWidth: '46%',
  },
  limit: {
    ...typographyKit.metaMedium,
    fontSize: 11,
  },
  barWrap: {
    marginBottom: 0,
  },
  status: {
    ...typographyKit.micro,
    fontSize: 10,
    marginTop: 6,
  },
});

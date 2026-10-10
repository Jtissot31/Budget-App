/**
 * Budget tab category tile — 2-column grid card: animated ring around the
 * category icon, name, what's left (or how much over), and spent / limit.
 * Neutral by default; muted amber from 90 % of the limit, red when over budget.
 */
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { AppIcon } from '@/components/icons/AppIcon';
import { FitText, PressScale, RingGauge } from '@/components/kit';
import { jakartaMediumText, jakartaSemiboldText, moneyAmountTypography } from '@/constants/theme';
import type { BudgetCategoryUiModel } from '@/lib/budgetCategoryModel';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  category: BudgetCategoryUiModel;
  selecting?: boolean;
  selected?: boolean;
  /** Soft identity colour for the ring + icon well (never good/bad meaning). */
  accent?: string;
  onPress: (id: string) => void;
};

/** Muted amber that sits well on the dark theme. */
const WARNING_SOFT = '#E0B354';

export const BudgetCategoryTile = memo(function BudgetCategoryTile({
  category,
  selecting = false,
  selected = false,
  accent,
  onPress,
}: Props) {
  const { colors } = useAppTheme();
  const over = category.usage.isOverBudget;
  const left = category.limit - category.spent;
  const ratio = category.limit > 0 ? category.spent / category.limit : over ? 1 : 0;
  // Colour carries meaning only: neutral when healthy, amber near the limit, red when over.
  const nearLimit = !over && ratio >= 0.9;
  const ringColor = over ? colors.danger : nearLimit ? WARNING_SOFT : colors.text;
  void accent;
  const pct = Math.round(ratio * 100);

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${category.name}, ${formatDisplayMoneyAbsolute(category.spent)} sur ${formatDisplayMoneyAbsolute(category.limit)}`}
      scaleTo={0.96}
      onPress={() => {
        tapHaptic();
        onPress(category.id);
      }}
      style={[
        styles.tile,
        {
          backgroundColor: colors.containerBackground,
          borderColor: selected ? colors.text : over ? `${colors.danger}55` : colors.containerBorder,
        },
      ]}
    >
      <View style={styles.top}>
        <RingGauge progress={ratio} color={ringColor} size={54} stroke={5}>
          <View
            style={[
              styles.iconWell,
              { backgroundColor: colors.surfaceElevated },
            ]}
          >
            <BudgetCategoryIcon
              icon={category.icon}
              name={category.name}
              id={category.id}
              wellSize={34}
              glyphSize={17}
              tint={over ? colors.danger : accent}
            />
          </View>
        </RingGauge>
        {selecting ? (
          <AppIcon
            family="ionicons"
            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={selected ? colors.text : colors.textMuted}
          />
        ) : (
          <Text style={[styles.pct, jakartaSemiboldText, { color: over ? colors.danger : colors.textMuted }]}>
            {pct} %
          </Text>
        )}
      </View>

      <FitText
        style={[styles.name, jakartaSemiboldText, { color: colors.text }]}
        fontSize={14}
        lineHeight={18}
        minScale={0.75}
      >
        {category.name}
      </FitText>

      <FitText
        style={[moneyAmountTypography({ tier: 'stat', fontSize: 22 }), { color: over ? colors.danger : colors.text }]}
        fontSize={22}
        lineHeight={27}
        minScale={0.6}
      >
        {over ? `−${formatDisplayMoneyAbsolute(Math.abs(left))}` : formatDisplayMoneyAbsolute(Math.max(0, left))}
      </FitText>
      <Text style={[styles.caption, jakartaMediumText, { color: over ? colors.danger : colors.textMuted }]} numberOfLines={1}>
        {over ? 'au-dessus du budget' : left <= 0.005 ? 'budget atteint' : 'restants'}
      </Text>
      <Text style={[styles.meta, jakartaMediumText, { color: colors.textMuted }]} numberOfLines={1}>
        {formatDisplayMoneyAbsolute(category.spent)} / {formatDisplayMoneyAbsolute(category.limit)}
      </Text>
    </PressScale>
  );
});

const styles = StyleSheet.create({
  tile: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 2,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pct: { fontSize: 12 },
  iconWell: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  name: { letterSpacing: -0.2 },
  caption: { fontSize: 11.5, marginTop: -2 },
  meta: { fontSize: 11.5, marginTop: 6 },
});

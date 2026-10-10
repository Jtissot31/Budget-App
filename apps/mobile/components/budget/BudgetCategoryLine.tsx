/**
 * Budget tab category row — category-tinted icon, « dépensé / prévu » on one line,
 * a bar in the category colour (red only when over), and a quiet status line.
 */
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { AnimatedBar, FitText, IconWell, PressScale } from '@/components/kit';
import {
  jakartaMediumText,
  jakartaSemiboldText,
  transactionRowAmountTypography,
} from '@/constants/theme';
import type { BudgetCategoryUiModel } from '@/lib/budgetCategoryModel';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  category: BudgetCategoryUiModel;
  isLast: boolean;
  selecting?: boolean;
  selected?: boolean;
  /** Stagger for the bar fill animation. */
  index?: number;
  /** Display colour (vivid palette slot) — overrides the stored category colour. */
  color?: string;
  onPress: (id: string) => void;
};

function statusFor(category: BudgetCategoryUiModel): { text: string; tone: 'danger' | 'muted' | 'good' } {
  const left = category.limit - category.spent;
  if (category.usage.isOverBudget) {
    return { text: `Dépassé de ${formatDisplayMoneyAbsolute(Math.abs(left))}`, tone: 'danger' };
  }
  if (category.limit > 0 && left <= 0.005) return { text: 'Budget atteint', tone: 'muted' };
  if (category.spent <= 0.005) return { text: 'Rien dépensé', tone: 'good' };
  return { text: `${formatDisplayMoneyAbsolute(left)} restants`, tone: 'muted' };
}

export const BudgetCategoryLine = memo(function BudgetCategoryLine({
  category,
  isLast,
  selecting = false,
  selected = false,
  index = 0,
  color,
  onPress,
}: Props) {
  const { colors } = useAppTheme();
  const over = category.usage.isOverBudget;
  const status = statusFor(category);
  const barColor = over ? colors.danger : (color ?? colors.text);
  const statusColor =
    status.tone === 'danger' ? colors.danger : status.tone === 'good' ? colors.accentGreen : colors.textMuted;

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${category.name}, ${formatDisplayMoneyAbsolute(category.spent)} sur ${formatDisplayMoneyAbsolute(category.limit)}. ${status.text}`}
      scaleTo={0.98}
      onPress={() => {
        tapHaptic();
        onPress(category.id);
      }}
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.containerBorder },
      ]}
    >
      {selecting ? (
        <IconWell
          icon={selected ? 'checkmark-circle' : 'ellipse-outline'}
          color={selected ? colors.text : colors.textMuted}
        />
      ) : (
        <IconWell>
          <BudgetCategoryIcon icon={category.icon} name={category.name} id={category.id} wellSize={40} glyphSize={18} />
        </IconWell>
      )}
      <View style={styles.body}>
        <View style={styles.topLine}>
          <FitText
            style={[styles.name, jakartaSemiboldText, { color: colors.text }]}
            fontSize={15}
            lineHeight={20}
            minScale={0.8}
            containerStyle={styles.nameBox}
          >
            {category.name}
          </FitText>
          <Text style={styles.amounts} numberOfLines={1}>
            <Text
              style={[
                transactionRowAmountTypography({ fontSize: 15, lineHeight: 20 }),
                { color: over ? colors.danger : colors.text },
              ]}
            >
              {formatDisplayMoneyAbsolute(category.spent)}
            </Text>
            <Text style={[styles.limit, jakartaMediumText, { color: colors.textMuted }]}>
              {' '}/ {formatDisplayMoneyAbsolute(category.limit)}
            </Text>
          </Text>
        </View>
        <AnimatedBar
          progress={category.usage.progress}
          color={barColor}
          trackColor={colors.borderSubtle}
          height={6}
          delay={index * 40}
        />
        <Text style={[styles.status, jakartaMediumText, { color: statusColor }]} numberOfLines={1}>
          {status.text}
        </Text>
      </View>
    </PressScale>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  body: { flex: 1, minWidth: 0, gap: 7 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameBox: { flex: 1 },
  name: { letterSpacing: -0.2 },
  amounts: { flexShrink: 0 },
  limit: { fontSize: 12.5 },
  status: { fontSize: 12, lineHeight: 15 },
});

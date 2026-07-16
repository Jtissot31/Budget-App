import { AppIcon } from '@/components/icons/AppIcon';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import {
  planFinanceContainerPressedStyle,
  planFinanceContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import { moneyAmountTypography, typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type SavingsGoalHubRowProps = {
  icon: string;
  /** Primary line — goal name. Must stay first and bold. */
  title: string;
  /** Secondary line — progress % or status. Muted; never swap with `title`. */
  meta: string;
  amount: string;
  onPress: () => void;
  accessibilityLabel: string;
};

export function SavingsGoalHubRow({
  icon,
  title,
  meta,
  amount,
  onPress,
  accessibilityLabel,
}: SavingsGoalHubRowProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [pressed && planFinanceContainerPressedStyle()]}
    >
      <PlanFinanceContainer style={styles.row}>
        <UserPickedIconWell icon={icon} size={44} wellGlyphWhite noBackground />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <Text style={[styles.amount, moneyAmountTypography({ tier: 'row' }), { color: colors.text }]}>
          {amount}
        </Text>
        <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
      </PlanFinanceContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: planFinanceContainerRowLayoutStyle(),
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    ...typographyKit.bodyBold,
    letterSpacing: -0.2,
  },
  meta: {
    ...typographyKit.metaMedium,
    letterSpacing: 0.2,
  },
  amount: {
    flexShrink: 0,
  },
});

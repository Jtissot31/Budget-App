import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { OnyxContainer } from '@/components/OnyxContainer';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import {
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import { transactionRowAmountTypography, typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

const ICON_WELL_SIZE = 40;

export type SavingsGoalHubRowProps = {
  icon: string;
  /** Primary line — goal name. Must stay first and bold. */
  title: string;
  /** Secondary line — progress % or status. Muted; never swap with `title`. */
  meta: string;
  amount: string;
  onPress: () => void;
  accessibilityLabel: string;
  /** @deprecated Rows are standalone Onyx tiles — kept for call-site compat. */
  isLast?: boolean;
};

/** Standalone Onyx row — matches hub loans / plan finance list tiles. */
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
      style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
    >
      <OnyxContainer style={styles.row}>
        <UserPickedIconWell icon={icon} size={ICON_WELL_SIZE} wellGlyphWhite noBackground />
        <View style={styles.copy}>
          <Text
            style={[typographyKit.rowTitle, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          <Text
            style={[typographyKit.metaMedium, { color: colors.textMuted }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {meta}
          </Text>
        </View>
        <Text style={[styles.amount, transactionRowAmountTypography(), { color: colors.text }]}>
          {amount}
        </Text>
        <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
      </OnyxContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: onyxContainerRowLayoutStyle(),
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  amount: {
    flexShrink: 0,
  },
});

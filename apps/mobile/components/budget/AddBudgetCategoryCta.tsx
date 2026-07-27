import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { OnyxContainer } from '@/components/OnyxContainer';
import {
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import { typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  onPress: () => void;
  /** Default: « Ajouter une catégorie » */
  label?: string;
};

/** Full-width Onyx add row — same pattern as hub savings / loans CTAs. */
export function AddBudgetCategoryCta({
  onPress,
  label = 'Ajouter une catégorie',
}: Props) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
    >
      <OnyxContainer style={styles.addCta}>
        <View style={[styles.addIconWell, { backgroundColor: colors.input }]}>
          <AppIcon
            family="ionicons"
            name="add"
            size={18}
            color={colors.accentGreen || colors.primary}
          />
        </View>
        <Text style={[styles.addLabel, typographyKit.rowTitle, { color: colors.text }]}>
          {label}
        </Text>
        <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
      </OnyxContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addCta: {
    ...onyxContainerRowLayoutStyle(),
    minHeight: 56,
  },
  addIconWell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addLabel: {
    flex: 1,
    minWidth: 0,
  },
});

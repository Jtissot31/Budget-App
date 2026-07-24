import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { OnyxContainer } from '@/components/OnyxContainer';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import { spacing, typographyKit } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  onPress: () => void;
  /** Kept for call-site compat — empty state uses the same premium row. */
  prominent?: boolean;
};

const LABEL = 'Explorer plus de plans';

/** Onyx row CTA — soft accent glyph only (well stays neutral). */
export function ExploreMorePlansRow({ onPress, prominent: _prominent = false }: Props) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Explorer plus de plans financiers"
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
    >
      <OnyxContainer style={styles.row}>
        <View style={[styles.iconWell, { backgroundColor: colors.input }]}>
          <AppIcon
            family="material-community"
            name="compass-outline"
            size={18}
            color={colors.accentGreen || colors.primary}
          />
        </View>
        <Text
          style={[styles.label, typographyKit.rowTitle, { color: colors.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {LABEL}
        </Text>
        <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
      </OnyxContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    ...onyxContainerRowLayoutStyle(),
    minHeight: 56,
    paddingVertical: spacing.md,
    paddingHorizontal: ONYX_CONTAINER.padding.row,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  planFinanceContainerPressedStyle,
  planFinanceKit,
} from '@/constants/planFinanceKit';
import { interSemiboldText, spacing } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';

type Props = {
  onPress: () => void;
  prominent?: boolean;
};

const LABEL = 'Explorer plus de plans';

/** Accent outline — stronger than ghost hairline, aligned with plan detail accent borders. */
const EXPLORE_ACCENT_BORDER = 'rgba(74, 222, 128, 0.36)';
/** Subtle green tint — empty-state prominence without a full primary fill. */
const EXPLORE_ACCENT_MUTED = 'rgba(74, 222, 128, 0.12)';
const EXPLORE_CHEVRON_WELL = 'rgba(74, 222, 128, 0.18)';
const EXPLORE_CHEVRON_WELL_PROMINENT = 'rgba(74, 222, 128, 0.24)';

export function ExploreMorePlansRow({ onPress, prominent = false }: Props) {
  const { colors: pf } = planFinanceKit;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Explorer plus de plans financiers"
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.pressable,
        prominent && styles.pressableProminent,
        pressed && planFinanceContainerPressedStyle(),
      ]}
    >
      <View
        style={[
          styles.button,
          prominent ? styles.buttonProminent : styles.buttonDefault,
          {
            backgroundColor: prominent ? EXPLORE_ACCENT_MUTED : pf.surface,
            borderColor: EXPLORE_ACCENT_BORDER,
          },
        ]}
      >
        <Text
          style={[styles.label, interSemiboldText, { color: pf.text }]}
          numberOfLines={1}
        >
          {LABEL}
        </Text>
        <View
          style={[
            styles.chevronWell,
            { backgroundColor: prominent ? EXPLORE_CHEVRON_WELL_PROMINENT : EXPLORE_CHEVRON_WELL },
          ]}
        >
          <AppIcon family="ionicons" name="chevron-forward" size={14} color={pf.accent} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'stretch',
  },
  pressableProminent: {
    marginTop: spacing.xs,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: planFinanceKit.radius.button,
    borderWidth: 1,
  },
  buttonDefault: {
    paddingVertical: 11,
    minHeight: 46,
  },
  buttonProminent: {
    paddingVertical: 12,
    minHeight: 48,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  chevronWell: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

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
};

const LABEL = 'Galerie widgets';

const SHORTCUT_BORDER = 'rgba(255, 255, 255, 0.14)';
const ICON_WELL = 'rgba(255, 255, 255, 0.08)';

export function WidgetGalleryShortcutRow({ onPress }: Props) {
  const { colors: pf } = planFinanceKit;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ouvrir la galerie widgets Fyn"
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.pressable, pressed && planFinanceContainerPressedStyle()]}
    >
      <View
        style={[
          styles.button,
          {
            backgroundColor: pf.surface,
            borderColor: SHORTCUT_BORDER,
          },
        ]}
      >
        <View style={[styles.iconWell, { backgroundColor: ICON_WELL }]}>
          <AppIcon family="material-community" name="view-grid-outline" size={16} color={pf.textMuted} />
        </View>
        <Text style={[styles.label, interSemiboldText, { color: pf.textMuted }]} numberOfLines={1}>
          {LABEL}
        </Text>
        <View style={[styles.chevronWell, { backgroundColor: ICON_WELL }]}>
          <AppIcon family="ionicons" name="chevron-forward" size={14} color={pf.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'stretch',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    minHeight: 46,
    borderRadius: planFinanceKit.radius.button,
    borderWidth: 1,
  },
  iconWell: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
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

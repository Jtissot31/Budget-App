/**
 * PillButton — small filled pill for section actions (Ajouter, Modifier, Détails…).
 * Replaces thin-outline / bare-text actions. Layout lives on an inner View because
 * Android Pressable style functions are not reliably applied.
 */
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon } from '@/components/icons/AppIcon';
import { typographyKit } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { usePressScale } from './motion';

type Props = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** `primary` = filled white (main action), `neutral` = soft grey. */
  tone?: 'neutral' | 'primary';
  accessibilityLabel?: string;
};

/** Sensible default icon from the label so call sites stay short. */
function iconFor(label: string): keyof typeof Ionicons.glyphMap | undefined {
  const l = label.toLowerCase();
  if (l.startsWith('ajouter') || l.startsWith('nouveau') || l.startsWith('créer')) return 'add';
  if (l.startsWith('modifier')) return 'create-outline';
  if (l.startsWith('terminé')) return 'checkmark';
  return undefined;
}

export function PillButton({ label, onPress, icon, tone = 'neutral', accessibilityLabel }: Props) {
  const { colors } = useAppTheme();
  const glyph = icon ?? iconFor(label);
  const primary = tone === 'primary';
  const press = usePressScale(0.92);
  const fg = primary ? colors.background : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={6}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View style={[styles.pill, press.animatedStyle, { backgroundColor: primary ? colors.text : colors.surfaceElevated }]}>
        {glyph ? <AppIcon family="ionicons" name={glyph} size={14} color={fg} /> : null}
        <Text style={[styles.label, { color: fg }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 14,
  },
  label: { ...typographyKit.metaSemibold, fontSize: 12 },
});

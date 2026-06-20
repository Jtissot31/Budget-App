import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

export const MODIFIER_ICON_NAME = 'create-outline' as const;
export const MODIFIER_ICON_SIZE = 18;

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  loading?: boolean;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
};

/** Edit control — `create-outline` + « Modifier », matching loan/mortgage detail header. */
export function ModifierButton({
  onPress,
  accessibilityLabel,
  disabled,
  loading,
  hitSlop = 12,
  style,
}: Props) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <>
          <Ionicons name={MODIFIER_ICON_NAME} size={MODIFIER_ICON_SIZE} color={colors.text} />
          <Text style={[styles.label, { color: colors.text }]}>Modifier</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 78,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
  },
  label: {
    fontSize: typography.meta,
    fontWeight: '800',
  },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.45 },
});

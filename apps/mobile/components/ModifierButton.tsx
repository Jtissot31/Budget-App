import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

export const MODIFIER_ICON_NAME = 'create-outline' as const;
export const MODIFIER_ICON_SIZE = 14;

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  loading?: boolean;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Edit control — same filled pill as `PillButton` (« Modifier »).
 * Fill lives on an inner View: Android ignores Pressable style-function fills.
 */
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
      style={({ pressed }) => [pressed && styles.pressed, (disabled || loading) && styles.disabled, style]}
    >
      <View style={[styles.pill, { backgroundColor: colors.surfaceElevated }]}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.text} />
        ) : (
          <>
            <AppIcon family="ionicons" name={MODIFIER_ICON_NAME} size={MODIFIER_ICON_SIZE} color={colors.text} />
            <Text style={[styles.label, { color: colors.text }]}>Modifier</Text>
          </>
        )}
      </View>
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
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
});

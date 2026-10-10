import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { jakartaExtraBoldText, radius, typography } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Primary « Enregistrer » CTA — matches budget category add flow. */
export function PrimarySaveButton({ label, onPress, disabled, loading, style }: Props) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [pressed && styles.pressed, style]}
    >
      {/* Fill + layout on a plain View: Android Pressable style functions are not reliably applied. */}
      <View
        style={[
          styles.btn,
          { backgroundColor: colors.primary },
          (disabled || loading) && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={[styles.text, { color: colors.background }]}>{label}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    borderRadius: radius.sm,
    paddingVertical: 16,
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
  text: {
    ...jakartaExtraBoldText,
    fontSize: typography.body,
  },
});

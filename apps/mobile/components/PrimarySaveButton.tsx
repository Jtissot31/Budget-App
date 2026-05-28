import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { ghost } from '@/constants/ghostUi';
import { radius, typography } from '@/constants/theme';
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
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: colors.primary },
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={ghost.void} />
      ) : (
        <Text style={[styles.text, { color: ghost.void }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    borderRadius: radius.lg,
    paddingVertical: 16,
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
  text: {
    fontSize: typography.body,
    fontWeight: '800',
  },
});

import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale } from '@/components/kit/motion';
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
  const press = usePressScale(0.97);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={style}
    >
      {/* Fill + layout on a plain View: Android Pressable style functions are not reliably applied. */}
      <Animated.View
        style={[
          styles.btn,
          press.animatedStyle,
          { backgroundColor: colors.primary },
          (disabled || loading) && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={[styles.text, { color: colors.background }]}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    borderRadius: radius.sm,
    paddingVertical: 16,
  },
  disabled: { opacity: 0.45 },
  text: {
    ...jakartaExtraBoldText,
    fontSize: typography.body,
  },
});

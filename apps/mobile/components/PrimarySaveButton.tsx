import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale } from '@/components/kit/motion';
import { jakartaSemiboldText } from '@/constants/theme';
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
          { backgroundColor: disabled && !loading ? colors.surfaceElevated : colors.text },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={[styles.text, { color: disabled ? colors.textMuted : colors.background }]} numberOfLines={1}>
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Minimal pill: neutral fill (theme text colour), no brand green, medium weight.
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 24,
  },
  text: {
    ...jakartaSemiboldText,
    fontSize: 15,
    letterSpacing: -0.1,
  },
});

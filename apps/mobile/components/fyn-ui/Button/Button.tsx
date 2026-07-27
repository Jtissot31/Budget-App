import { Pressable, StyleSheet, Text } from 'react-native';
import {
  BORDER,
  COLORS,
  COMPONENTS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/design-tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  variant?: ButtonVariant;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: ButtonSize;
};

/**
 * Button — reusable CTA with primary / secondary / ghost variants and sm / md / lg sizes.
 * Primary uses accent green with dark label for contrast; ghost label uses green.
 */
export function Button({
  variant = 'primary',
  label,
  onPress,
  disabled = false,
  size = 'md',
}: ButtonProps) {
  const labelColor =
    variant === 'ghost'
      ? COLORS.green
      : variant === 'primary'
        ? COLORS.textOnGreen
        : COLORS.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[size],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          TYPOGRAPHY.body,
          styles.label,
          { color: labelColor },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  sm: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  md: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  lg: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  primary: {
    backgroundColor: COLORS.green,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: BORDER.width,
    borderColor: COLORS.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: COMPONENTS.button.disabledOpacity,
  },
  pressed: {
    opacity: COMPONENTS.button.pressedOpacity,
  },
  label: {
    fontFamily: TYPOGRAPHY.families.uiSemibold,
  },
});

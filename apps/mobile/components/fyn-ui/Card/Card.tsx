import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  BORDER,
  COLORS,
  COMPONENTS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/design-tokens';

export type CardProps = {
  children: ReactNode;
  title?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Card — flexible surface container with optional title and press handling.
 * Uses dark surface / border tokens (Onyx-adjacent fill; radius follows RADIUS.lg).
 */
export function Card({ children, title, onPress, style }: CardProps) {
  const content = (
    <>
      {title ? <Text style={[TYPOGRAPHY.h2, styles.title]}>{title}</Text> : null}
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          style,
          pressed && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.card, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER.width,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginVertical: SPACING.md,
  },
  title: {
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  pressed: {
    opacity: COMPONENTS.button.pressedOpacity,
  },
});

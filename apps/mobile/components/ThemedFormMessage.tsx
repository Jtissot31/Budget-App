import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { jakartaBoldText, jakartaMediumText, radius, spacing, typography } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import type { FormFeedbackVariant } from '@/lib/formFeedback';

type Props = {
  variant: FormFeedbackVariant;
  title: string;
  message: string;
  style?: StyleProp<ViewStyle>;
};

const VARIANT_ICONS: Record<FormFeedbackVariant, keyof typeof Ionicons.glyphMap> = {
  error: 'alert-circle-outline',
  success: 'checkmark-circle-outline',
  warning: 'warning-outline',
};

/** Compact inline banner for form validation and confirmations. */
export function ThemedFormMessage({ variant, title, message, style }: Props) {
  const { colors } = useAppTheme();

  const backgroundColor =
    variant === 'error' ? colors.dangerMuted : variant === 'warning' ? colors.warningMuted : colors.successMuted;
  const accentColor =
    variant === 'error' ? colors.danger : variant === 'warning' ? colors.warning : colors.success;

  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor, borderColor: accentColor }, style]}
    >
      <Ionicons name={VARIANT_ICONS[variant]} size={18} color={accentColor} style={styles.icon} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: accentColor }]}>{title}</Text>
        <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  icon: {
    marginTop: 1,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...jakartaBoldText,
    fontSize: typography.caption,
  },
  message: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    lineHeight: typography.meta + 5,
  },
});

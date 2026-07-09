import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { Ionicons } from '@expo/vector-icons';
import { jakartaBoldText, jakartaMediumText, radius, spacing, typography, type AppColors } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

export type ThemedConfirmVariant = 'success' | 'error' | 'warning' | 'info';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: ThemedConfirmVariant;
  onConfirm: () => void;
  onCancel?: () => void;
};

type ConfirmButtonStyle = {
  backgroundColor: string;
  borderColor?: string;
  borderWidth?: number;
  textColor: string;
};

const NEUTRAL_DISMISS_BUTTON = (colors: AppColors): ConfirmButtonStyle => ({
  backgroundColor: colors.input,
  borderColor: colors.containerBorder,
  borderWidth: StyleSheet.hairlineWidth,
  textColor: colors.text,
});

const CONFIRM_BUTTON_BY_VARIANT: Record<
  ThemedConfirmVariant,
  (colors: AppColors, isLight: boolean) => ConfirmButtonStyle
> = {
  success: (colors, isLight) => ({
    backgroundColor: colors.primary,
    textColor: isLight ? '#FFFFFF' : '#0a0a0a',
  }),
  error: (colors) => NEUTRAL_DISMISS_BUTTON(colors),
  warning: (colors) => NEUTRAL_DISMISS_BUTTON(colors),
  info: (colors) => NEUTRAL_DISMISS_BUTTON(colors),
};

const VARIANT_DEFAULTS: Record<
  ThemedConfirmVariant,
  { icon: keyof typeof Ionicons.glyphMap; iconBg: (colors: AppColors) => string; iconColor: (colors: AppColors) => string }
> = {
  success: {
    icon: 'checkmark-circle-outline',
    iconBg: (c) => c.successMuted,
    iconColor: (c) => c.primary,
  },
  error: {
    icon: 'alert-circle-outline',
    iconBg: (c) => c.dangerMuted,
    iconColor: (c) => c.danger,
  },
  warning: {
    icon: 'warning-outline',
    iconBg: (c) => c.warningMuted,
    iconColor: (c) => c.warning,
  },
  info: {
    icon: 'information-circle-outline',
    iconBg: (c) => c.cyanMuted,
    iconColor: (c) => c.textSecondary,
  },
};

/** Confirmation dialog — dark card, primary CTA (replaces system Alert). */
export function ThemedConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel,
  icon,
  variant = 'success',
  onConfirm,
  onCancel,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const variantDefaults = VARIANT_DEFAULTS[variant];
  const confirmButton = CONFIRM_BUTTON_BY_VARIANT[variant](colors, isLight);
  const resolvedIcon = icon ?? variantDefaults.icon;

  const handleClose = () => {
    onCancel?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.containerBackground,
              borderColor: colors.containerBorder,
            },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: variantDefaults.iconBg(colors) }]}>
            <AppIcon family="ionicons" name={resolvedIcon} size={22} color={variantDefaults.iconColor(colors)} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.confirmBtn,
              {
                backgroundColor: confirmButton.backgroundColor,
                borderColor: confirmButton.borderColor,
                borderWidth: confirmButton.borderWidth ?? 0,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.confirmText, { color: confirmButton.textColor }]}>
              {confirmLabel}
            </Text>
          </Pressable>
          {cancelLabel && onCancel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>{cancelLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.card + 4,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...jakartaBoldText,
    fontSize: typography.body,
    textAlign: 'center',
  },
  message: {
    ...jakartaMediumText,
    fontSize: typography.caption,
    lineHeight: typography.caption + 6,
    textAlign: 'center',
  },
  confirmBtn: {
    alignSelf: 'stretch',
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  confirmText: {
    ...jakartaBoldText,
    fontSize: typography.caption,
  },
  cancelBtn: {
    alignSelf: 'stretch',
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelText: {
    ...jakartaMediumText,
    fontSize: typography.caption,
  },
  pressed: {
    opacity: 0.82,
  },
});

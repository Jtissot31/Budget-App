import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { interBoldText, interMediumText, radius, spacing, typography, type AppColors } from '@/constants/theme';
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
            <Ionicons name={resolvedIcon} size={22} color={variantDefaults.iconColor(colors)} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.confirmBtn,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.confirmText, { color: isLight ? '#FFFFFF' : '#0a0a0a' }]}>
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
    ...interBoldText,
    fontSize: typography.body,
    textAlign: 'center',
  },
  message: {
    ...interMediumText,
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
    ...interBoldText,
    fontSize: typography.caption,
  },
  cancelBtn: {
    alignSelf: 'stretch',
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelText: {
    ...interMediumText,
    fontSize: typography.caption,
  },
  pressed: {
    opacity: 0.82,
  },
});

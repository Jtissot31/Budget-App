import { useMemo, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SurfaceCard } from '@/components/SurfaceCard';
import {
  interBoldText,
  interMediumText,
  interSemiboldText,
  radius,
  spacing,
  typography,
  type AppColors,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export type AIChatSettingDetailVariant = 'info' | 'success' | 'warning';

type DetailAction = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
};

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: AIChatSettingDetailVariant;
  value?: string;
  /** Optional extra content below the message (e.g. quota stats). */
  children?: ReactNode;
  primaryAction?: DetailAction;
  secondaryAction?: DetailAction;
  /** Render as overlay inside another `Modal` instead of a nested `Modal`. */
  embedded?: boolean;
  onClose: () => void;
};

const VARIANT_DEFAULTS: Record<
  AIChatSettingDetailVariant,
  { icon: keyof typeof Ionicons.glyphMap; iconBg: (colors: AppColors) => string; iconColor: (colors: AppColors) => string }
> = {
  info: {
    icon: 'information-circle-outline',
    iconBg: (c) => c.cyanMuted,
    iconColor: (c) => c.textSecondary,
  },
  success: {
    icon: 'checkmark-circle-outline',
    iconBg: (c) => c.successMuted,
    iconColor: (c) => c.primary,
  },
  warning: {
    icon: 'warning-outline',
    iconBg: (c) => c.warningMuted,
    iconColor: (c) => c.warning,
  },
};

function DetailSheetBody({
  title,
  subtitle,
  message,
  icon,
  variant = 'info',
  value,
  children,
  primaryAction,
  secondaryAction,
  onClose,
}: Omit<Props, 'visible' | 'embedded'>) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const variantDefaults = VARIANT_DEFAULTS[variant];
  const resolvedIcon = icon ?? variantDefaults.icon;

  const backdropColor = useMemo(
    () => (isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)'),
    [isLight],
  );

  const handleClose = () => {
    tapHaptic();
    onClose();
  };

  const handleAction = (action: DetailAction) => {
    tapHaptic();
    action.onPress();
  };

  return (
    <View style={[styles.backdrop, { backgroundColor: backdropColor }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityLabel="Fermer" />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.containerBackground,
            borderColor: colors.containerBorder,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />

        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            onPress={handleClose}
            hitSlop={12}
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <SurfaceCard padding={spacing.lg} innerStyle={styles.cardInner}>
            <View style={[styles.iconWrap, { backgroundColor: variantDefaults.iconBg(colors) }]}>
              <Ionicons name={resolvedIcon} size={22} color={variantDefaults.iconColor(colors)} />
            </View>

            {value ? (
              <View style={[styles.valueBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Text style={[styles.valueBadgeText, { color: colors.text }]}>{value}</Text>
              </View>
            ) : null}

            <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
            {children}
          </SurfaceCard>

          {primaryAction ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={primaryAction.label}
              onPress={() => handleAction(primaryAction)}
              style={({ pressed }) => [
                styles.primaryAction,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
              ]}
            >
              {primaryAction.icon ? (
                <Ionicons
                  name={primaryAction.icon}
                  size={18}
                  color={isLight ? '#FFFFFF' : '#0a0a0a'}
                />
              ) : null}
              <Text style={[styles.primaryActionText, { color: isLight ? '#FFFFFF' : '#0a0a0a' }]}>
                {primaryAction.label}
              </Text>
            </Pressable>
          ) : null}

          {secondaryAction ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={secondaryAction.label}
              onPress={() => handleAction(secondaryAction)}
              style={({ pressed }) => [
                styles.secondaryAction,
                { backgroundColor: colors.input, borderColor: colors.containerBorder },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.secondaryActionText, { color: colors.textSecondary }]}>
                {secondaryAction.label}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const embeddedHostStyle = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
  },
});

export function AIChatSettingDetailSheet({ visible, embedded = false, ...bodyProps }: Props) {
  if (!visible) return null;

  if (embedded) {
    return (
      <View style={embeddedHostStyle.host}>
        <DetailSheetBody {...bodyProps} />
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={bodyProps.onClose}>
      <DetailSheetBody {...bodyProps} />
    </Modal>
  );
}

function createStyles(_colors: AppColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      borderTopLeftRadius: radius.card + 4,
      borderTopRightRadius: radius.card + 4,
      borderWidth: StyleSheet.hairlineWidth,
      maxHeight: Platform.OS === 'web' ? '85%' : '72%',
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: radius.pill,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      gap: spacing.md,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    title: {
      ...interBoldText,
      fontSize: typography.body,
    },
    subtitle: {
      ...interMediumText,
      fontSize: typography.micro,
      lineHeight: typography.micro + 4,
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      flexGrow: 0,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      gap: spacing.md,
    },
    cardInner: {
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
    valueBadge: {
      alignSelf: 'stretch',
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    valueBadgeText: {
      ...interSemiboldText,
      fontSize: typography.caption,
      textAlign: 'center',
    },
    message: {
      ...interMediumText,
      fontSize: typography.caption,
      lineHeight: typography.caption + 6,
      textAlign: 'center',
    },
    primaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 48,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
    },
    primaryActionText: {
      ...interBoldText,
      fontSize: typography.caption,
    },
    secondaryAction: {
      minHeight: 44,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    secondaryActionText: {
      ...interMediumText,
      fontSize: typography.caption,
    },
    pressed: {
      opacity: 0.82,
    },
  });
}

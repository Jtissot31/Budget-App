import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { planFinanceContainerPressedStyle } from '@/constants/planFinanceKit';
import {
  jakartaSemiboldText,
  radius,
  spacing,
  typography,
  typographyKit,
  type AppColors,
} from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

export type DashboardAlertSeverity = 'danger' | 'warning' | 'success';

const ACCENT_BAR_WIDTH = 5;

export function resolveDashboardAlertAccent(
  severity: DashboardAlertSeverity,
  colors: AppColors,
): string {
  switch (severity) {
    case 'danger':
      return colors.danger;
    case 'warning':
      return colors.warning;
    case 'success':
      return colors.accentGreen;
    default:
      return colors.warning;
  }
}

type Props = {
  title: string;
  subtitle: string;
  badgeAmount: string;
  severity: DashboardAlertSeverity;
  onPress: () => void;
  showBell?: boolean;
  reminderEnabled?: boolean;
  onToggleReminder?: () => void;
  accessibilityLabel?: string;
};

export function MinimizedAlertCard({
  title,
  subtitle,
  badgeAmount,
  severity,
  onPress,
  showBell = false,
  reminderEnabled = false,
  onToggleReminder,
  accessibilityLabel,
}: Props) {
  const { colors } = useAppTheme();
  const accent = resolveDashboardAlertAccent(severity, colors);

  return (
    <PlanFinanceContainer style={styles.shell} halo={false}>
      <View style={styles.row}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />

        <Pressable
          style={({ pressed }) => [styles.mainPress, pressed && planFinanceContainerPressedStyle()]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? `Ouvrir l'alerte ${title}`}
        >
          <View style={styles.copyBlock}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
              {title.toUpperCase()}
            </Text>
            <Text
              style={[styles.subtitle, { color: colors.textMuted }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          </View>

          {badgeAmount ? (
            <View style={[styles.badge, { borderColor: accent }]}>
              <Text style={[styles.badgeText, { color: accent }]} numberOfLines={1}>
                {badgeAmount}
              </Text>
            </View>
          ) : null}
        </Pressable>

        {showBell ? (
          <Pressable
            onPress={onToggleReminder}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={reminderEnabled ? 'Désactiver le rappel de paie' : 'Rappel le jour de la paie'}
            style={styles.bellButton}
          >
            <AppIcon
              family="ionicons"
              name={reminderEnabled ? 'notifications' : 'notifications-outline'}
              size={18}
              color={reminderEnabled ? colors.warning : colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
    </PlanFinanceContainer>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 64,
  },
  accentBar: {
    width: ACCENT_BAR_WIDTH,
    flexShrink: 0,
  },
  mainPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  copyBlock: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    ...typographyKit.eyebrow,
    fontSize: typography.meta,
    letterSpacing: 0.4,
  },
  subtitle: {
    ...typographyKit.microMedium,
    lineHeight: typography.micro + 4,
  },
  badge: {
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    maxWidth: '46%',
  },
  badgeText: {
    ...jakartaSemiboldText,
    fontSize: typography.micro,
    fontVariant: ['tabular-nums'],
  },
  bellButton: {
    alignSelf: 'center',
    paddingRight: spacing.sm,
    paddingLeft: spacing.xs,
    flexShrink: 0,
  },
});

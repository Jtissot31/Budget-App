import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DashboardCard } from '@/components/DashboardCard';
import { jakartaMediumText, spacing, typography, type AppColors } from '@/constants/theme';
import { listRowTitle } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';

export type PaymentListRowBadgeVariant = 'upcoming' | 'upcomingIncome' | 'paid' | 'received';

type StatusBadge = {
  label: string;
  variant: PaymentListRowBadgeVariant;
};

type Props = {
  avatar: ReactNode;
  title: string;
  meta?: string | null;
  statusBadge?: StatusBadge | null;
  amount: ReactNode;
  footer?: ReactNode;
  onPress?: () => void;
};

export function PaymentListRow({
  avatar,
  title,
  meta,
  statusBadge,
  amount,
  footer,
  onPress,
}: Props) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const card = (
    <DashboardCard style={styles.card}>
      {avatar}
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {title}
        </Text>
        {meta ? (
          <View style={styles.metaRow}>
            <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
              {meta}
            </Text>
          </View>
        ) : null}
        {footer}
      </View>
      <View style={styles.amountBlock}>
        {statusBadge ? (
          <View
            style={[
              styles.badge,
              statusBadge.variant === 'received' && styles.badgeReceived,
              statusBadge.variant === 'paid' && styles.badgePaid,
              statusBadge.variant === 'upcoming' && styles.badgeUpcoming,
              statusBadge.variant === 'upcomingIncome' && styles.badgeUpcomingIncome,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                statusBadge.variant === 'received' && styles.badgeTextReceived,
                statusBadge.variant === 'paid' && styles.badgeTextPaid,
                statusBadge.variant === 'upcoming' && styles.badgeTextUpcoming,
                statusBadge.variant === 'upcomingIncome' && styles.badgeTextUpcomingIncome,
              ]}
            >
              {statusBadge.label}
            </Text>
          </View>
        ) : null}
        {amount}
      </View>
    </DashboardCard>
  );

  if (!onPress) {
    return card;
  }

  return (
    <Pressable onPress={onPress} android_ripple={null}>
      {card}
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.lg,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: spacing.xs,
    },
    title: {
      ...listRowTitle,
      fontSize: 13,
      color: colors.text,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minWidth: 0,
    },
    meta: {
      ...jakartaMediumText,
      fontSize: typography.micro,
      flex: 1,
      minWidth: 0,
      color: colors.textMuted,
    },
    amountBlock: {
      alignItems: 'flex-end',
      flexShrink: 0,
    },
    badge: {
      marginBottom: spacing.xs,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    badgeUpcoming: {
      backgroundColor: 'rgba(230,160,0,0.14)',
    },
    badgeUpcomingIncome: {
      backgroundColor: 'rgba(0,230,100,0.1)',
    },
    badgePaid: {
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    badgeReceived: {
      backgroundColor: 'rgba(0,230,100,0.1)',
    },
    badgeText: {
      ...jakartaMediumText,
      fontSize: 11,
      letterSpacing: 0.3,
    },
    badgeTextUpcoming: {
      color: colors.warning,
    },
    badgeTextUpcomingIncome: {
      color: colors.success,
    },
    badgeTextPaid: {
      color: colors.textMuted,
    },
    badgeTextReceived: {
      color: colors.success,
    },
  });
}

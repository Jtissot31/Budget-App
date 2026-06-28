import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { CheckingBalanceSparkline } from '@/components/dashboard/CheckingBalanceSparkline';
import { NetWorthAmountRow } from '@/components/NetWorthAmountRow';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { interBoldText, spacing } from '@/constants/theme';
import { netWorthHeroAmount } from '@/lib/textLayout';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  checkingBalance: number;
  checkingBalanceSeries: number[];
};

export function HomeAvailableNowHero({ checkingBalance, checkingBalanceSeries }: Props) {
  const { colors } = useAppTheme();
  const [balancesHidden, setBalancesHidden] = useState(false);
  const maskedLabel = useMemo(() => '••••••', []);

  return (
    <View style={styles.hero}>
      <DashboardSectionLabel style={styles.eyebrow}>DISPONIBLE MAINTENANT</DashboardSectionLabel>

      <View style={styles.amountRow}>
        {balancesHidden ? (
          <Text style={[netWorthHeroAmount, styles.maskedAmount, { color: colors.text }, interBoldText]}>
            {maskedLabel}
          </Text>
        ) : (
          <NetWorthAmountRow totalBalance={checkingBalance} />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={balancesHidden ? 'Afficher les montants' : 'Masquer les montants'}
          hitSlop={10}
          onPress={() => {
            tapHaptic();
            setBalancesHidden((current) => !current);
          }}
          style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}
        >
          <AppIcon
            family="material-community"
            name={balancesHidden ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>

      {!balancesHidden && checkingBalanceSeries.length >= 2 ? (
        <View style={styles.sparklineClip}>
          <CheckingBalanceSparkline values={checkingBalanceSeries} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    overflow: 'visible',
  },
  eyebrow: {
    marginBottom: spacing.xs,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  eyeButton: {
    padding: spacing.xs,
  },
  maskedAmount: {
    letterSpacing: 2,
  },
  sparklineClip: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.78,
  },
});

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CheckingBalanceSparkline } from '@/components/dashboard/CheckingBalanceSparkline';
import { NetWorthAmountRow } from '@/components/NetWorthAmountRow';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { interBoldText, interMediumText, spacing } from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { netWorthHeroAmount } from '@/lib/textLayout';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  checkingBalance: number;
  monthlyNetFlux: number;
  checkingBalanceSeries: number[];
};

function formatFluxAmount(value: number): string {
  const sign = value >= 0 ? '+' : '−';
  return `${sign}${formatDisplayMoneyAbsolute(Math.abs(value))}`;
}

export function HomeAvailableNowHero({ checkingBalance, monthlyNetFlux, checkingBalanceSeries }: Props) {
  const { colors } = useAppTheme();
  const [balancesHidden, setBalancesHidden] = useState(false);
  const maskedLabel = useMemo(() => '••••••', []);
  const fluxColor = monthlyNetFlux >= 0 ? colors.accentGreen : colors.danger;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.containerBackground,
          borderColor: colors.containerBorder,
        },
      ]}
    >
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
          <MaterialCommunityIcons
            name={balancesHidden ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>

      {balancesHidden ? (
        <Text style={[styles.fluxLine, { color: colors.textMuted }, interMediumText]}>Flux masqué</Text>
      ) : (
        <Text style={[styles.fluxLine, { color: fluxColor }, interMediumText]}>
          Flux net ce mois : {formatFluxAmount(monthlyNetFlux)} (revenus − dépenses)
        </Text>
      )}

      {!balancesHidden && checkingBalanceSeries.length >= 2 ? (
        <View style={styles.sparklineClip}>
          <CheckingBalanceSparkline values={checkingBalanceSeries} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.sm,
    overflow: 'hidden',
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
  fluxLine: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  sparklineClip: {
    marginHorizontal: -spacing.lg,
    marginBottom: -spacing.lg,
    marginTop: spacing.xs,
    paddingBottom: 18,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
  },
  pressed: {
    opacity: 0.78,
  },
});

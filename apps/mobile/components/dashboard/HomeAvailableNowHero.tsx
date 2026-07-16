import { StyleSheet, View } from 'react-native';
import { CheckingBalanceSparkline } from '@/components/dashboard/CheckingBalanceSparkline';
import { NetWorthAmountRow } from '@/components/NetWorthAmountRow';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { spacing } from '@/constants/theme';

type Props = {
  checkingBalance: number;
  checkingBalanceSeries: number[];
};

export function HomeAvailableNowHero({ checkingBalance, checkingBalanceSeries }: Props) {
  return (
    <View style={styles.hero}>
      <DashboardSectionLabel style={styles.eyebrow}>DISPONIBLE MAINTENANT</DashboardSectionLabel>

      <NetWorthAmountRow totalBalance={checkingBalance} />

      {checkingBalanceSeries.length >= 2 ? (
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
  sparklineClip: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
});

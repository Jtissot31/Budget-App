import { StyleSheet, Text, View } from 'react-native';
import {
  interBoldText,
  interSemiboldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { formatDisplayMoney } from '@/lib/formatDisplayMoney';
import { formatNumberDisplay } from '@/lib/formatNumber';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  monthlyIncome: number;
  monthlyExpenses: number;
};

function formatCompactStat(value: number): string {
  const { main } = formatDisplayMoney(value);
  return main;
}

export function HomeQuickStatsRow({ monthlyIncome, monthlyExpenses }: Props) {
  const { colors } = useAppTheme();
  const savingsRate =
    monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : null;
  const savingsPositive = savingsRate != null && savingsRate >= 0;

  return (
    <View style={styles.row}>
      <View style={[styles.tile, { backgroundColor: colors.containerBackground }]}>
        <Text style={[styles.label, { color: colors.textMuted }, interSemiboldText]}>REVENUS</Text>
        <Text style={[styles.value, { color: colors.text }, interBoldText]} numberOfLines={1}>
          {formatCompactStat(monthlyIncome)}
        </Text>
      </View>

      <View style={[styles.tile, { backgroundColor: colors.containerBackground }]}>
        <Text style={[styles.label, { color: colors.textMuted }, interSemiboldText]}>DÉPENSES</Text>
        <Text style={[styles.value, { color: colors.text }, interBoldText]} numberOfLines={1}>
          {formatCompactStat(monthlyExpenses)}
        </Text>
      </View>

      <View style={[styles.tile, { backgroundColor: colors.containerBackground }]}>
        <Text style={[styles.label, { color: colors.textMuted }, interSemiboldText]}>ÉPARGNE</Text>
        <Text
          style={[
            styles.value,
            { color: savingsPositive ? colors.accentGreen : colors.danger },
            interBoldText,
          ]}
          numberOfLines={1}
        >
          {savingsRate == null
            ? '—'
            : `${formatNumberDisplay(savingsRate, { maximumFractionDigits: 0 })} %`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    borderRadius: radius.card,
    padding: spacing.sm,
    gap: spacing.xs,
    minWidth: 0,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
});

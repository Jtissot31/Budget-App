import { StyleSheet, Text, View } from 'react-native';
import {
  interSemiboldText,
  moneyAmountTypography,
  radius,
  spacing,
} from '@/constants/theme';
import { formatDisplayMoney } from '@/lib/formatDisplayMoney';
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

  return (
    <View style={styles.row}>
      <View style={[styles.tile, { backgroundColor: colors.containerBackground }]}>
        <Text style={[styles.label, { color: colors.textMuted }, interSemiboldText]}>REVENUS</Text>
        <Text style={[styles.value, { color: colors.text }, moneyAmountTypography({ tier: 'row', fontSize: 15 })]} numberOfLines={1}>
          {formatCompactStat(monthlyIncome)}
        </Text>
      </View>

      <View style={[styles.tile, { backgroundColor: colors.containerBackground }]}>
        <Text style={[styles.label, { color: colors.textMuted }, interSemiboldText]}>DÉPENSES</Text>
        <Text style={[styles.value, { color: colors.text }, moneyAmountTypography({ tier: 'row', fontSize: 15 })]} numberOfLines={1}>
          {formatCompactStat(monthlyExpenses)}
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
    fontVariant: ['tabular-nums'],
  },
});

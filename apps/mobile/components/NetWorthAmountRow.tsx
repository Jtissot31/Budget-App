import { StyleSheet, Text, View } from 'react-native';
import { portfolioDark, portfolioLight } from '@/constants/theme';
import { formatDisplayMoney } from '@/lib/formatDisplayMoney';
import { netWorthHeroAmount, singleLineAmountProps } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';

const LIGHT_PORTFOLIO_TEXT = portfolioLight.text;

export function NetWorthAmountRow({
  totalBalance,
  centered = false,
}: {
  totalBalance: number;
  /** When true, centers the amount row (hero cash-flow column). */
  centered?: boolean;
}) {
  const { isLight } = useAppTheme();
  const textColor = isLight ? LIGHT_PORTFOLIO_TEXT : portfolioDark.text;
  const sign = totalBalance < 0 ? '−' : '';
  const { main } = formatDisplayMoney(totalBalance);

  return (
    <View style={[styles.netWorthAmountRow, centered && styles.netWorthAmountRowCentered]}>
      <Text style={[styles.netWorthAmountMain, { color: textColor }]} {...singleLineAmountProps}>
        {sign}
        {main}
      </Text>
      <Text style={[styles.netWorthAmountDollar, { color: textColor }]}>$</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  netWorthAmountRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  netWorthAmountRowCentered: {
    alignSelf: 'center',
    marginTop: 0,
  },
  netWorthAmountDollar: {
    ...netWorthHeroAmount,
    marginLeft: 2,
  },
  netWorthAmountMain: {
    ...netWorthHeroAmount,
  },
});

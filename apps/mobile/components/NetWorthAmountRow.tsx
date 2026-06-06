import { StyleSheet, Text, View } from 'react-native';
import { portfolioDark, portfolioLight } from '@/constants/theme';
import { formatDisplayMoney } from '@/lib/formatDisplayMoney';
import { netWorthHeroAmount, singleLineAmountProps } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';

const LIGHT_PORTFOLIO_TEXT = portfolioLight.text;

export function NetWorthAmountRow({ totalBalance }: { totalBalance: number }) {
  const { isLight } = useAppTheme();
  const textColor = isLight ? LIGHT_PORTFOLIO_TEXT : portfolioDark.text;
  const sign = totalBalance < 0 ? '−' : '';
  const { main } = formatDisplayMoney(totalBalance);

  return (
    <View style={styles.netWorthAmountRow}>
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
  netWorthAmountDollar: {
    ...netWorthHeroAmount,
    marginLeft: 2,
  },
  netWorthAmountMain: {
    ...netWorthHeroAmount,
  },
});

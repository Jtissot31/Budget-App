import { StyleSheet, Text, View } from 'react-native';
import { interBoldText, interExtraBoldText, portfolioDark, portfolioLight } from '@/constants/theme';
import { formatFrCaMoneyMainAndSeparatedDollarSuffix } from '@/lib/formatCompactGainDollars';
import { singleLineAmountProps } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';

const LIGHT_PORTFOLIO_TEXT = portfolioLight.text;

export function NetWorthAmountRow({ totalBalance }: { totalBalance: number }) {
  const { isLight } = useAppTheme();
  const textColor = isLight ? LIGHT_PORTFOLIO_TEXT : portfolioDark.text;
  const sign = totalBalance < 0 ? '−' : '';
  const { main } = formatFrCaMoneyMainAndSeparatedDollarSuffix(totalBalance);

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
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  netWorthAmountDollar: {
    ...interBoldText,
    fontSize: 28,
    opacity: 0.6,
    marginLeft: 2,
  },
  netWorthAmountMain: {
    ...interExtraBoldText,
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 52,
    letterSpacing: -2,
  },
});

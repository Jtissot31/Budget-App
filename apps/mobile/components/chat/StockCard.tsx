import { StyleSheet, Text, View } from 'react-native';
import {
  interBoldText,
  interRegularText,
  interSemiboldText,
  radius,
  spacing,
} from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import { formatNumberDisplay } from '@/lib/formatNumber';
import type { StockPayload } from './types';

type Props = {
  stock: StockPayload;
};

function formatPrice(value: number, currency = '$') {
  return `${formatNumberDisplay(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatChangePercent(value: number) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)} %`;
}

export function StockCard({ stock }: Props) {
  const { colors, isLight } = useAppTheme();
  const isPositive = stock.changePercent >= 0;
  const changeColor = isPositive ? colors.primary : colors.danger;

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
      <View style={styles.header}>
        <Text style={[styles.symbol, { color: colors.primary }]}>{stock.symbol}</Text>
        <Text style={[styles.name, { color: colors.textMuted }]} numberOfLines={1}>
          {stock.name}
        </Text>
      </View>
      <View style={styles.footer}>
        <Text style={[styles.price, { color: colors.text }]}>{formatPrice(stock.price, stock.currency)}</Text>
        <Text style={[styles.changeText, { color: changeColor }, interSemiboldText]}>
          {formatChangePercent(stock.changePercent)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  symbol: {
    ...interBoldText,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  name: {
    ...interRegularText,
    fontSize: 12,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  price: {
    ...interBoldText,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  changeText: {
    fontSize: 13,
  },
});

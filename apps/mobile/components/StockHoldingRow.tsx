import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SparklineChart } from '@/components/chat/SparklineChart';
import {
  jakartaSemiboldText,
  moneyAmountTypography,
  spacing,
  typographyKit,
} from '@/constants/theme';
import {
  formatStockDayChangePercent,
  mockStockHoldingTotalValue,
  type MockStockHolding,
} from '@/constants/mockStockPortfolio';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { useAppTheme } from '@/lib/themeContext';

const SPARKLINE_WIDTH = 56;
const SPARKLINE_HEIGHT = 28;

type Props = {
  holding: MockStockHolding;
  embedded?: boolean;
  isLast?: boolean;
  onPress?: () => void;
};

export const StockHoldingRow = memo(function StockHoldingRow({
  holding,
  embedded = false,
  isLast = false,
  onPress,
}: Props) {
  const { colors } = useAppTheme();
  const [sparklineWidth, setSparklineWidth] = useState(SPARKLINE_WIDTH);
  const totalValue = mockStockHoldingTotalValue(holding);
  const dayUp = holding.dayChangePercent >= 0;
  const changeColor = dayUp ? colors.success : colors.danger;

  const rowContent = (
    <View style={[styles.mainRow, embedded && styles.mainRowEmbedded]}>
        <View style={styles.identityCol}>
          <Text style={[styles.ticker, jakartaSemiboldText, { color: colors.text }]} numberOfLines={1}>
            {holding.ticker}
          </Text>
          <Text
            style={[styles.companyName, typographyKit.caption, { color: colors.textMuted }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {holding.companyName}
          </Text>
        </View>

        <View
          style={styles.sparklineSlot}
          onLayout={(event) => {
            const width = Math.floor(event.nativeEvent.layout.width);
            if (width > 0 && width !== sparklineWidth) {
              setSparklineWidth(width);
            }
          }}
        >
          <SparklineChart
            data={holding.sparkline}
            width={sparklineWidth}
            height={SPARKLINE_HEIGHT}
            positive={dayUp}
          />
        </View>

        <View style={styles.valuesCol}>
          <Text
            style={[moneyAmountTypography({ tier: 'row' }), styles.totalValue, { color: colors.text }]}
            numberOfLines={1}
          >
            {formatCompactCurrency(totalValue)}
          </Text>
          <Text style={[styles.dayChange, typographyKit.microMedium, { color: changeColor }]}>
            {formatStockDayChangePercent(holding.dayChangePercent)}
          </Text>
        </View>
    </View>
  );

  return (
    <View style={[styles.shell, embedded && styles.shellEmbedded]}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Voir ${holding.ticker}`}
          onPress={onPress}
          style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
        >
          {rowContent}
        </Pressable>
      ) : (
        rowContent
      )}

      {embedded && !isLast ? <View style={styles.dividerEmbedded} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  shell: {
    minHeight: 56,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  shellEmbedded: {
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
    minHeight: 0,
    gap: spacing.sm,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 0,
  },
  mainRowEmbedded: {
    paddingHorizontal: spacing.lg,
  },
  identityCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ticker: {
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  companyName: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.1,
  },
  sparklineSlot: {
    width: SPARKLINE_WIDTH,
    height: SPARKLINE_HEIGHT,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuesCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
    minWidth: 88,
    gap: 2,
  },
  totalValue: {
    textAlign: 'right',
  },
  dayChange: {
    fontSize: 11,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
    textAlign: 'right',
  },
  dividerEmbedded: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  pressable: {
    borderRadius: 12,
  },
  pressed: {
    opacity: 0.75,
  },
});

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatStockDayChangePercent,
  mockStockHoldingTotalValue,
  type MockStockHolding,
} from '@/constants/mockStockPortfolio';
import { BUDGET_DANGER_COLOR } from '@/lib/categoryBudgetUsage';
import {
  DASHBOARD_VALUE_GREEN,
  moneyAmountTypography,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  holding: MockStockHolding;
  onPress?: () => void;
};

const CARD_SURFACE = '#28282E';
const AVATAR_SIZE = 28;
const CARD_MIN_HEIGHT = 128;
const CARD_BODY_MIN_HEIGHT = 56;

function stockTickerShort(ticker: string): string {
  const base = ticker.split('.')[0]?.trim();
  return base || ticker;
}

function stockTickerInitial(ticker: string): string {
  const short = stockTickerShort(ticker);
  return short.charAt(0).toUpperCase() || '?';
}

export const StockHoldingTile = memo(function StockHoldingTile({ holding, onPress }: Props) {
  const { colors } = useAppTheme();
  const totalValue = mockStockHoldingTotalValue(holding);
  const dayUp = holding.dayChangePercent >= 0;
  const changeColor = dayUp ? DASHBOARD_VALUE_GREEN : BUDGET_DANGER_COLOR;
  const tickerLabel = stockTickerShort(holding.ticker);

  const card = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: CARD_SURFACE,
          borderColor: colors.containerBorder,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.avatarLabel, typographyKit.microMedium, { color: colors.textMuted }]}>
              {stockTickerInitial(holding.ticker)}
            </Text>
          </View>
          <Text style={[styles.ticker, typographyKit.captionSemibold, { color: colors.text }]} numberOfLines={1}>
            {tickerLabel}
          </Text>
        </View>
        <Text style={[styles.change, typographyKit.captionSemibold, { color: changeColor }]} numberOfLines={1}>
          {formatStockDayChangePercent(holding.dayChangePercent)}
        </Text>
      </View>

      <View style={styles.cardValueRow}>
        <Text
          style={[moneyAmountTypography({ fontSize: 17, lineHeight: 21 }), styles.value, { color: colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {formatCompactCurrency(totalValue)}
        </Text>
      </View>
    </View>
  );

  if (!onPress) return card;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir ${holding.ticker}`}
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      {card}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  pressed: {
    opacity: 0.88,
  },
  card: {
    width: '100%',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg + 2,
    minHeight: CARD_MIN_HEIGHT,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minWidth: 0,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0.2,
  },
  ticker: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  change: {
    flexShrink: 0,
    fontSize: 13,
    lineHeight: 17,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  cardValueRow: {
    flex: 1,
    minHeight: CARD_BODY_MIN_HEIGHT,
    justifyContent: 'flex-end',
    paddingTop: spacing.lg,
  },
  value: {
    alignSelf: 'stretch',
    includeFontPadding: false,
  },
});

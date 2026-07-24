import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import {
  formatStockDayChangePercent,
  mockStockHoldingTotalValue,
  type MockStockHolding,
} from '@/constants/mockStockPortfolio';
import {
  planFinanceContainerCompactTilePaddingStyle,
  planFinanceContainerPressedStyle,
} from '@/constants/planFinanceKit';
import {
  moneyAmountTypography,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { getStockLogoAsset } from '@/lib/stockLogo';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  holding: MockStockHolding;
  onPress?: () => void;
};

const AVATAR_SIZE = 28;
const CARD_MIN_HEIGHT = 148;
const CARD_BODY_MIN_HEIGHT = 52;

function stockTickerShort(ticker: string): string {
  const base = ticker.split('.')[0]?.trim();
  return base || ticker;
}

function stockTickerInitial(ticker: string): string {
  const short = stockTickerShort(ticker);
  return short.charAt(0).toUpperCase() || '?';
}

function StockHoldingLogo({ ticker }: { ticker: string }) {
  const { colors } = useAppTheme();
  const asset = useMemo(() => getStockLogoAsset(ticker), [ticker]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [asset]);

  const showLogo = Boolean(asset) && !failed;

  if (showLogo && asset) {
    return (
      <View style={styles.logoSlot}>
        <Image
          source={asset}
          style={styles.logoImage}
          contentFit="contain"
          contentPosition="center"
          transition={0}
          cachePolicy="memory-disk"
          recyclingKey={`stock-logo-${ticker}`}
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  return (
    <View style={styles.logoSlot}>
      <Text style={[styles.avatarLabel, typographyKit.microMedium, { color: colors.textMuted }]}>
        {stockTickerInitial(ticker)}
      </Text>
    </View>
  );
}

export const StockHoldingTile = memo(function StockHoldingTile({ holding, onPress }: Props) {
  const { colors } = useAppTheme();
  const totalValue = mockStockHoldingTotalValue(holding);
  const dayUp = holding.dayChangePercent >= 0;
  const changeColor = dayUp ? colors.success : colors.danger;
  const tickerLabel = stockTickerShort(holding.ticker);

  const card = (
    <PlanFinanceContainer style={styles.card}>
      <View style={styles.headerArea}>
        <View style={styles.changeRow}>
          <Text style={[styles.change, typographyKit.micro, { color: changeColor }]} numberOfLines={1}>
            {formatStockDayChangePercent(holding.dayChangePercent)}
          </Text>
        </View>
        <View style={styles.identityRow}>
          <StockHoldingLogo ticker={holding.ticker} />
          <View style={styles.identityTextCol}>
            <Text style={[typographyKit.listPrimary, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
              {tickerLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardValueRow}>
        <Text
          style={[moneyAmountTypography({ tier: 'stat' }), styles.value, { color: colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {formatCompactCurrency(totalValue)}
        </Text>
      </View>
    </PlanFinanceContainer>
  );

  if (!onPress) return card;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir ${holding.ticker}`}
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && planFinanceContainerPressedStyle()]}
    >
      {card}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  card: {
    width: '100%',
    ...planFinanceContainerCompactTilePaddingStyle(),
    minHeight: CARD_MIN_HEIGHT,
  },
  headerArea: {
    minWidth: 0,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    minWidth: 0,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    minWidth: 0,
  },
  identityTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
    paddingTop: 1,
  },
  /** Transparent — logo sits on the PlanFinanceContainer card, no well fill. */
  logoSlot: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  logoImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarLabel: {
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0.2,
  },
  companyName: {
    letterSpacing: 0.05,
  },
  change: {
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
    textAlign: 'right',
  },
  cardValueRow: {
    flex: 1,
    minHeight: CARD_BODY_MIN_HEIGHT,
    justifyContent: 'flex-end',
    paddingTop: spacing.md,
  },
  value: {
    alignSelf: 'stretch',
    includeFontPadding: false,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DashboardCard } from '@/components/DashboardCard';
import { StockHoldingTile } from '@/components/StockHoldingTile';
import {
  MOCK_STOCK_HOLDINGS,
  mockStockPortfolioTotalValue,
} from '@/constants/mockStockPortfolio';
import {
  moneyAmountTypography,
  PORTFOLIO_SECTION_GAP,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { useAppTheme } from '@/lib/themeContext';

export function StockPortfolioSection() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const holdings = MOCK_STOCK_HOLDINGS;
  const portfolioTotal = mockStockPortfolioTotalValue(holdings);

  return (
    <View style={styles.section}>
      <DashboardCard>
        <View style={styles.summaryBlock}>
          <View style={styles.summaryMetaRow}>
            <Text style={[styles.summaryLabel, typographyKit.eyebrow, { color: colors.textMuted }]}>
              Valeur totale
            </Text>
            <Text style={[styles.holdingCount, typographyKit.micro, { color: colors.textMuted }]}>
              {holdings.length} positions
            </Text>
          </View>
          <Text
            style={[moneyAmountTypography({ tier: 'stat' }), styles.summaryAmount, { color: colors.text }]}
          >
            {formatCompactCurrency(portfolioTotal)}
          </Text>
        </View>
      </DashboardCard>

      <View style={styles.holdingGrid}>
        {holdings.map((holding) => (
          <View key={holding.id} style={styles.tileSlot}>
            <StockHoldingTile
              holding={holding}
              onPress={() => {
                router.push({ pathname: '/stock/[ticker]', params: { ticker: holding.ticker } });
              }}
            />
          </View>
        ))}
      </View>

      <Text style={[styles.disclaimer, typographyKit.microMedium, { color: colors.textMuted }]}>
        Données de démonstration — non liées à un courtier.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: PORTFOLIO_SECTION_GAP,
  },
  summaryBlock: {
    gap: spacing.sm,
  },
  summaryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  summaryAmount: {
    textAlign: 'left',
  },
  holdingCount: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.2,
    flexShrink: 0,
  },
  holdingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tileSlot: {
    width: '48%',
    flexGrow: 1,
    minWidth: 158,
    maxWidth: '48%',
  },
  disclaimer: {
    paddingHorizontal: spacing.xs,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.1,
  },
});

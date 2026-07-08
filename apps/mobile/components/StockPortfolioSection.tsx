import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DashboardCard } from '@/components/DashboardCard';
import { StockHoldingRow } from '@/components/StockHoldingRow';
import {
  MOCK_STOCK_HOLDINGS,
  mockStockPortfolioTotalValue,
} from '@/constants/mockStockPortfolio';
import { jakartaSemiboldText, moneyAmountTypography, spacing, typographyKit } from '@/constants/theme';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { useAppTheme } from '@/lib/themeContext';

export function StockPortfolioSection() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const holdings = MOCK_STOCK_HOLDINGS;
  const portfolioTotal = mockStockPortfolioTotalValue(holdings);

  return (
    <View style={styles.section}>
      <DashboardCard padding={0} innerStyle={styles.groupCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCopy}>
            <Text style={[styles.summaryLabel, typographyKit.eyebrow, { color: colors.textMuted }]}>
              Valeur totale
            </Text>
            <Text
              style={[moneyAmountTypography({ tier: 'cardMetric' }), styles.summaryAmount, { color: colors.text }]}
            >
              {formatCompactCurrency(portfolioTotal)}
            </Text>
          </View>
          <Text style={[styles.holdingCount, typographyKit.caption, { color: colors.textSecondary }]}>
            {holdings.length} positions
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        {holdings.map((holding, index) => (
          <StockHoldingRow
            key={holding.id}
            holding={holding}
            embedded
            isLast={index === holdings.length - 1}
            onPress={() => {
              router.push({ pathname: '/stock/[ticker]', params: { ticker: holding.ticker } });
            }}
          />
        ))}
      </DashboardCard>

      <Text style={[styles.disclaimer, typographyKit.microMedium, { color: colors.textMuted }]}>
        Données de démonstration — non liées à un courtier.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  groupCard: {
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  summaryLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  summaryAmount: {
    textAlign: 'left',
  },
  holdingCount: {
    ...jakartaSemiboldText,
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 0,
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  disclaimer: {
    paddingHorizontal: spacing.xs,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.1,
  },
});

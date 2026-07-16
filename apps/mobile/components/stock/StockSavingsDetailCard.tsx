import { StyleSheet, Text, View } from 'react-native';
import { SurfaceCard } from '@/components/SurfaceCard';
import type { MockStockDetail } from '@/constants/mockStockDetail';
import {
  DASHBOARD_VALUE_GREEN,
  DASHBOARD_VALUE_RED,
  containerSurfaceStyle,
  detailSectionLabelStyle,
  detailSectionsCardStyle,
  detailSubSectionHeaderStyle,
  detailSubSectionsGap,
  moneyAmountTypography,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { formatDisplayMoney, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import { mockStockPortfolioTotalValue } from '@/constants/mockStockPortfolio';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  detail: MockStockDetail;
};

function formatReturnPercent(percent: number): string {
  return `${percent >= 0 ? '+' : '−'}${Math.abs(percent).toLocaleString('fr-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;
}

function DetailRow({
  label,
  value,
  valueColor,
  valueKind = 'money',
  isLast = false,
}: {
  label: string;
  value: string;
  valueColor?: string;
  /** Money / tabular metrics use Onest; plain copy stays Jakarta. */
  valueKind?: 'money' | 'text';
  isLast?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.detailRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[typographyKit.metaMedium, styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text
        style={[
          valueKind === 'money'
            ? moneyAmountTypography({ tier: 'row' })
            : typographyKit.bodyMedium,
          styles.detailValue,
          { color: valueColor ?? colors.text },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function StockSavingsDetailCard({ detail }: Props) {
  const { colors, isLight } = useAppTheme();
  const surface = containerSurfaceStyle(isLight);
  const { holding, position } = detail;
  const portfolioTotal = mockStockPortfolioTotalValue();
  const portfolioPercent = portfolioTotal > 0 ? (position.totalValue / portfolioTotal) * 100 : 0;
  const currentPriceLabel = formatDisplayMoney(holding.pricePerShare).main;
  const avgPriceLabel = formatDisplayMoney(position.avgPrice).main;
  const returnPositive = position.totalReturnDollar >= 0;
  const returnColor = returnPositive ? DASHBOARD_VALUE_GREEN : DASHBOARD_VALUE_RED;
  const returnDollar = formatSignedDisplayMoney(position.totalReturnDollar, {
    leadingPlusWhenPositive: true,
  }).replace('$', ' $');
  const returnPercent = formatReturnPercent(position.totalReturnPercent);

  return (
    <SurfaceCard
      style={[
        detailSectionsCardStyle(),
        {
          gap: spacing.md,
          borderWidth: surface.borderWidth,
          borderColor: surface.borderColor,
        },
      ]}
    >
      <Text style={[detailSectionLabelStyle(), { color: colors.textMuted }]}>DÉTAILS</Text>

      <View>
        <View style={[styles.rowsBlock, { borderTopColor: colors.border }]}>
          <DetailRow
            label="Rendement total"
            value={`${returnDollar}  ·  ${returnPercent}`}
            valueColor={returnColor}
          />
          <DetailRow label="Prix moyen d'achat" value={`${avgPriceLabel} $`} />
          <DetailRow label="Prix actuel" value={`${currentPriceLabel} $`} />
          <DetailRow
            label="% du portefeuille"
            value={`${portfolioPercent.toLocaleString('fr-CA', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} %`}
            isLast
          />
        </View>

        {detail.categories.length > 0 ? (
          <View style={styles.subsection}>
            <Text style={[detailSubSectionHeaderStyle(), { color: colors.textMuted }]}>Catégorie</Text>
            <View style={styles.chipRow}>
              {detail.categories.map((category) => (
                <View
                  key={category}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
                  ]}
                >
                  <Text style={[typographyKit.metaSemibold, { color: colors.text }]}>{category}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {detail.recurringPurchases.length > 0 ? (
          <View style={styles.subsection}>
            <Text style={[detailSubSectionHeaderStyle(), { color: colors.textMuted }]}>
              Achats récurrents
            </Text>
            <View style={[styles.rowsBlock, { borderTopColor: colors.border }]}>
              {detail.recurringPurchases.map((purchase, index) => (
                <View
                  key={purchase.id}
                  style={[
                    styles.recurringRow,
                    index < detail.recurringPurchases.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.recurringCopy}>
                    <Text style={[typographyKit.bodyMedium, { color: colors.text }]}>{purchase.account}</Text>
                    <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>
                      {purchase.frequency}
                    </Text>
                  </View>
                  <Text style={[moneyAmountTypography({ tier: 'row' }), { color: colors.text }]}>
                    {formatCompactCurrency(purchase.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.subsection}>
          <Text style={[detailSubSectionHeaderStyle(), { color: colors.textMuted }]}>Dividendes</Text>
          <View style={[styles.rowsBlock, { borderTopColor: colors.border }]}>
            <DetailRow label="Rendement sur 12 mois" value={detail.dividends.yield12m} valueKind="text" />
            <DetailRow label="Fréquence" value={detail.dividends.frequency} valueKind="text" isLast />
          </View>
        </View>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  rowsBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    flex: 1,
  },
  detailValue: {
    textAlign: 'right',
    flexShrink: 1,
    maxWidth: '62%',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  subsection: {
    gap: spacing.xs,
    marginTop: detailSubSectionsGap,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  recurringCopy: {
    flex: 1,
    gap: 2,
  },
});

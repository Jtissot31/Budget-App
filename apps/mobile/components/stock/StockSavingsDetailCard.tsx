import { useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SurfaceCard } from '@/components/SurfaceCard';
import type { MockStockDetail } from '@/constants/mockStockDetail';
import {
  jakartaBoldText,
  jakartaExtraBoldText,
  moneyAmountTypography,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { formatDisplayMoney, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
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

function formatReturnLine(dollar: number, percent: number): string {
  const dollarText = formatSignedDisplayMoney(dollar, { leadingPlusWhenPositive: true });
  return `${dollarText.replace('$', ' $')} (${formatReturnPercent(percent)})`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[typographyKit.metaMedium, styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typographyKit.bodyMedium, styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function ReturnMetric({
  label,
  dollar,
  percent,
  emphasized = false,
}: {
  label: string;
  dollar: number;
  percent: number;
  emphasized?: boolean;
}) {
  const { colors } = useAppTheme();
  const positive = dollar >= 0;
  const color = positive ? colors.success : colors.danger;
  const line = formatReturnLine(dollar, percent);

  return (
    <View style={[styles.returnMetric, emphasized && styles.returnMetricEmphasized]}>
      <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>{label}</Text>
      <Text
        style={[
          emphasized ? moneyAmountTypography({ tier: 'stat' }) : moneyAmountTypography({ tier: 'row' }),
          { color },
        ]}
      >
        {line}
      </Text>
    </View>
  );
}

export function StockSavingsDetailCard({ detail }: Props) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const { holding, position, displayTicker } = detail;
  const portfolioTotal = mockStockPortfolioTotalValue();
  const portfolioPercent =
    portfolioTotal > 0 ? (position.totalValue / portfolioTotal) * 100 : 0;
  const currentPriceLabel = formatDisplayMoney(holding.pricePerShare).main;
  const avgPriceLabel = formatDisplayMoney(position.avgPrice).main;

  return (
    <SurfaceCard borderRadius={radius.md} padding={spacing.lg} style={styles.card}>
      <View style={styles.headerRow}>
        <View
          style={[
            styles.logoBadge,
            { backgroundColor: detail.logoColor },
          ]}
        >
          <Text style={styles.logoLetter}>{detail.logoLetter}</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text style={[typographyKit.rowTitle, { color: colors.text }]} numberOfLines={2}>
            {detail.issuerName}
          </Text>
          <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>{displayTicker}</Text>
        </View>
      </View>

      <View style={styles.positionBlock}>
        <Text style={[moneyAmountTypography({ tier: 'netWorth' }), { color: colors.text }]}>
          {formatCompactCurrency(position.totalValue)}
        </Text>
        <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>{position.sharesLabel}</Text>
      </View>

      <ReturnMetric
        label="Rendement total"
        dollar={position.totalReturnDollar}
        percent={position.totalReturnPercent}
        emphasized
      />

      <ReturnMetric
        label="Variation du jour"
        dollar={position.dayReturnDollar}
        percent={position.dayReturnPercent}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => {
          tapHaptic();
          setExpanded((prev) => !prev);
        }}
        style={({ pressed }) => [styles.expandHeader, pressed && styles.pressed]}
      >
        <Text style={[typographyKit.metaSemibold, { color: colors.textMuted }]}>Plus de détails</Text>
        <AppIcon family="ionicons"
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>

      {expanded ? (
        <View style={[styles.expandBody, { borderTopColor: colors.border }]}>
          <DetailRow label="Prix moyen d'achat" value={`${avgPriceLabel} $`} />
          <DetailRow label="Prix actuel" value={`${currentPriceLabel} $`} />
          <DetailRow
            label="% du portefeuille"
            value={`${portfolioPercent.toLocaleString('fr-CA', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} %`}
          />

          {detail.categories.length > 0 ? (
            <View style={styles.categoryBlock}>
              <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>Catégorie</Text>
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
              <Text style={[jakartaBoldText, styles.subsectionTitle, { color: colors.text }]}>
                Achats récurrents
              </Text>
              {detail.recurringPurchases.map((purchase) => (
                <View key={purchase.id} style={styles.recurringRow}>
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
          ) : null}

          <View style={styles.subsection}>
            <Text style={[jakartaBoldText, styles.subsectionTitle, { color: colors.text }]}>Dividendes</Text>
            <DetailRow label="Rendement sur 12 mois" value={detail.dividends.yield12m} />
            <DetailRow label="Fréquence" value={detail.dividends.frequency} />
          </View>
        </View>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    ...jakartaExtraBoldText,
    color: '#FFFFFF',
    fontSize: 15,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  positionBlock: {
    gap: spacing.xs,
  },
  returnMetric: {
    gap: spacing.xs,
  },
  returnMetricEmphasized: {
    paddingVertical: spacing.xs,
  },
  expandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  expandBody: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    flex: 1,
  },
  detailValue: {
    textAlign: 'right',
    flexShrink: 0,
  },
  categoryBlock: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
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
    paddingTop: spacing.sm,
  },
  subsectionTitle: {
    fontSize: 14,
    letterSpacing: -0.1,
    marginBottom: spacing.xs,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  recurringCopy: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.78,
  },
});

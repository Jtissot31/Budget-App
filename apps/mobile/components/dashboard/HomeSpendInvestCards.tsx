/**
 * Patrimoine — Placements insight card (full-width summary + sparkline).
 * Bound to live holdings / wealth stores (no hardcoded demo totals).
 */
import { memo, useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { SparklineChart } from '@/components/chat/SparklineChart';
import type { MockStockHolding } from '@/constants/mockStockPortfolio';
import { moneyAmountTypography, typographyKit } from '@/constants/theme';
import {
  buildPortfolioSummary,
  EMPTY_PORTFOLIO_SUMMARY,
  portfolioVariationLabel,
  type PortfolioSummary,
} from '@/lib/buildPortfolioSummary';
import { ensureDbReady } from '@/lib/init';
import { getLoans, getWealthAssets } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { generateIntradaySparkline } from '@/lib/intradayStockSparkline';
import { loadMockStockHoldingsOrder } from '@/lib/mockStockHoldingsOrder';
import { useAppTheme } from '@/lib/themeContext';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import type { Loan } from '@/types';

const SPARK_H = 36;
const ENDPOINT_R = 2.5;

function loansByIdMap(loans: readonly Loan[]): Map<string, Loan> {
  return new Map(loans.map((loan) => [loan.id, loan]));
}

/** Value-weighted portfolio intraday mark-to-market series (downsampled). */
function buildPortfolioIntradaySeries(
  holdings: readonly MockStockHolding[],
  maxPoints = 28,
): number[] {
  if (holdings.length === 0) return [];

  const perHolding = holdings.map((h) => ({
    shares: h.shares,
    series: generateIntradaySparkline(h),
  }));
  const len = Math.min(...perHolding.map((p) => p.series.length));
  if (len < 2) return [];

  const totals: number[] = [];
  for (let i = 0; i < len; i += 1) {
    let sum = 0;
    for (const row of perHolding) {
      sum += row.shares * (row.series[i] ?? 0);
    }
    totals.push(sum);
  }

  if (totals.length <= maxPoints) return totals;
  const out: number[] = [];
  const step = (totals.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i += 1) {
    out.push(totals[Math.round(i * step)] ?? 0);
  }
  return out;
}

/** Flat green fill sparkline when intraday series is empty. */
const FilledFallbackSparkline = memo(function FilledFallbackSparkline({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  const midY = height * 0.55;
  const d = `M 2 ${midY} L ${width - 4} ${midY}`;
  const fill = `${d} L ${width - 4} ${height - 2} L 2 ${height - 2} Z`;
  const gid = 'home-invest-fallback-fill';
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={fill} fill={`url(#${gid})`} />
      <Path d={d} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <Circle cx={width - 4} cy={midY} r={ENDPOINT_R} fill={color} />
    </Svg>
  );
});

type Props = {
  /** When false, the card is a static summary (already on Patrimoine). Default true. */
  interactive?: boolean;
};

/** Placements card (full-width). Kept as HomeSpendInvestCards for call-site stability. */
export function HomeSpendInvestCards({ interactive = true }: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [portfolio, setPortfolio] = useState<PortfolioSummary>(EMPTY_PORTFOLIO_SUMMARY);
  const [portfolioSeries, setPortfolioSeries] = useState<number[]>([]);
  const [cardWidth, setCardWidth] = useState(0);

  const load = useCallback(async () => {
    await ensureDbReady();
    const [holdings, wealthAssets, loans] = await Promise.all([
      loadMockStockHoldingsOrder(),
      getWealthAssets(),
      getLoans(),
    ]);

    // Stocks + biens matériels: the card says « Placements », so it totals both sides.
    const summary = buildPortfolioSummary(holdings, wealthAssets, loansByIdMap(loans));
    setPortfolio(summary);
    // An intraday shape exists for quoted holdings only — the footer names that scope.
    setPortfolioSeries(summary.hasStocks ? buildPortfolioIntradaySeries(holdings, 28) : []);
  }, []);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => {
      void load();
    });
  }, [load]);

  useRefreshOnFocus(load, { minIntervalMs: 5_000 });

  const portfolioLabel = formatDisplayMoneyAbsolute(portfolio.total);
  const portfolioVariation = portfolioVariationLabel(portfolio.variation);
  const variationUp = (portfolio.variation?.percent ?? 0) >= 0;
  const portfolioEmpty = portfolio.isEmpty && portfolioSeries.length < 2;
  // Neutral caption when the total is real but nothing about its variation is knowable
  // (unquoted assets bought at an unrecorded cost) — never a fabricated 0 %.
  const portfolioFooter = portfolioEmpty
    ? 'Aucun placement'
    : (portfolioVariation ?? 'Valeur actuelle');
  const variationColor = !portfolioVariation
    ? colors.textMuted
    : variationUp
      ? colors.accentGreen
      : colors.danger;

  const onCardLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.floor(e.nativeEvent.layout.width);
    setCardWidth((prev) => (prev === next ? prev : next));
  }, []);

  const sparkW = Math.max(0, cardWidth - 28);

  const cardBody = (
      <ProtoGlassCard padding={14} style={styles.card}>
        <Text style={[styles.title, { color: colors.textMuted }]} numberOfLines={1}>
          Placements
        </Text>
        <Text
          style={[
            moneyAmountTypography({ tier: 'stat', fontSize: 22 }),
            { color: colors.text, letterSpacing: -0.5 },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {portfolioLabel}
        </Text>
        <View style={styles.sparkWrap}>
          {sparkW > 0 && portfolioSeries.length >= 2 ? (
            <SparklineChart
              data={portfolioSeries}
              width={sparkW}
              height={SPARK_H}
              positive={variationUp}
              showFill
              showEndpointDot
              strokeWidth={1.5}
            />
          ) : sparkW > 0 && !portfolioEmpty ? (
            <FilledFallbackSparkline width={sparkW} height={SPARK_H} color={variationColor} />
          ) : (
            <View style={{ height: SPARK_H }} />
          )}
        </View>
        <Text
          style={[styles.footer, { color: portfolioEmpty ? colors.textMuted : variationColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {portfolioFooter}
        </Text>
      </ProtoGlassCard>
  );

  if (!interactive) {
    return (
      <View
        accessibilityLabel={`Placements, ${portfolioLabel}, ${portfolioFooter}`}
        onLayout={onCardLayout}
        style={styles.cardPress}
      >
        {cardBody}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Placements, ${portfolioLabel}, ${portfolioFooter}`}
      onPress={() => {
        tapHaptic();
        router.push('/patrimoine');
      }}
      onLayout={onCardLayout}
      style={({ pressed }) => [styles.cardPress, pressed && { opacity: 0.82 }]}
    >
      {cardBody}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardPress: {
    width: '100%',
  },
  card: {
    gap: 8,
    minHeight: 148,
  },
  title: {
    ...typographyKit.metaMedium,
    fontSize: 12,
    letterSpacing: -0.1,
  },
  sparkWrap: {
    width: '100%',
    height: SPARK_H,
    marginTop: 2,
    marginBottom: 2,
  },
  footer: {
    ...typographyKit.metaMedium,
    fontSize: 11,
    letterSpacing: -0.1,
  },
});

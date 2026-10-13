import { useCallback, useMemo, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { StockDetailHero, StockDetailIdentity } from '@/components/stock/StockDetailSections';
import { StockPositionCard } from '@/components/stock/StockPositionCard';
import { StockSavingsDetailCard } from '@/components/stock/StockSavingsDetailCard';
import { FixedScreenHeader } from '@/components/FixedScreenHeader';
import {
  CHART_FULL_BLEED_RIGHT_INSET,
  PortfolioChartCard,
  type NetWorthChartPeriod,
  type PortfolioChartCardHandle,
} from '@/components/PortfolioChartCard';
import { getMockStockDetail } from '@/constants/mockStockDetail';
import {
  buildStockChartTrendPoints,
  STOCK_NET_WORTH_CHART_PERIODS,
} from '@/lib/intradayStockSparkline';
import {
  DASHBOARD_VALUE_GREEN,
  DASHBOARD_VALUE_RED,
  spacing,
} from '@/constants/theme';
import { formatDisplayMoney } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

function formatStockChartScrubValue(value: number): string {
  const { main } = formatDisplayMoney(value);
  return `${main} $`;
}

export default function StockDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ ticker?: string }>();
  const ticker = typeof params.ticker === 'string' ? params.ticker : '';
  const detail = useMemo(() => getMockStockDetail(ticker), [ticker]);
  const chartRef = useRef<PortfolioChartCardHandle>(null);

  const getChartPoints = useCallback(
    (period: NetWorthChartPeriod) =>
      detail ? buildStockChartTrendPoints(detail.holding, period) : [],
    [detail],
  );

  const dismissChartCursor = useCallback(() => {
    chartRef.current?.clearSelection();
  }, []);

  const dayUp = (detail?.holding.dayChangePercent ?? 0) >= 0;
  const chartLineColor = dayUp ? DASHBOARD_VALUE_GREEN : DASHBOARD_VALUE_RED;

  return (
    <PageTransition>
      <View style={styles.screen}>
        <FixedScreenHeader title={detail?.displayTicker ?? 'Détail action'} onBack={() => router.back()} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={dismissChartCursor}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + spacing.xl, 56) },
          ]}
        >
          {detail ? (
            <>
              <Pressable onPress={dismissChartCursor} accessibilityRole="none">
                <View style={styles.heroBlock}>
                  <StockDetailIdentity detail={detail} />
                  <StockDetailHero detail={detail} />
                </View>
              </Pressable>

              <View style={styles.chartBleed}>
                <PortfolioChartCard
                  ref={chartRef}
                  points={[]}
                  getChartPoints={getChartPoints}
                  allowedPeriods={STOCK_NET_WORTH_CHART_PERIODS}
                  initialPeriod="1J"
                  formatScrubValue={formatStockChartScrubValue}
                  lineColor={chartLineColor}
                  plotHorizontalInset={0}
                  plotHorizontalInsetRight={CHART_FULL_BLEED_RIGHT_INSET}
                  selectionPersistence="release"
                  scrubTimePeriods={['1J']}
                />
              </View>

              <Pressable onPress={dismissChartCursor} accessibilityRole="none" style={styles.belowChart}>
                <StockPositionCard detail={detail} />
                <StockSavingsDetailCard detail={detail} />
              </Pressable>
            </>
          ) : (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              Action introuvable pour ce ticker.
            </Text>
          )}
        </ScrollView>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  heroBlock: {
    gap: spacing.sm,
  },
  belowChart: {
    gap: spacing.xl,
  },
  chartBleed: {
    marginHorizontal: -spacing.lg,
    width: '100%',
    alignSelf: 'center',
  },
  empty: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: spacing.xl,
  },
  pressed: {
    opacity: 0.78,
  },
});

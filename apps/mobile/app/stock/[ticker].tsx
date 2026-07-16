import { useCallback, useMemo, useRef } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
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
import { StockSavingsDetailCard } from '@/components/stock/StockSavingsDetailCard';
import {
  CHART_FULL_BLEED_RIGHT_INSET,
  PortfolioChartCard,
  type NetWorthChartPeriod,
  type PortfolioChartCardHandle,
} from '@/components/PortfolioChartCard';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { getMockStockDetail } from '@/constants/mockStockDetail';
import {
  buildStockChartTrendPoints,
  STOCK_NET_WORTH_CHART_PERIODS,
} from '@/lib/intradayStockSparkline';
import { jakartaExtraBoldText } from '@/constants/plusJakartaFonts';
import {
  DASHBOARD_VALUE_GREEN,
  DASHBOARD_VALUE_RED,
  spacing,
  typography,
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
        <View
          style={[
            styles.topBar,
            { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.lg + spacing.md },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
              pressed && styles.pressed,
            ]}
          >
            <AppIcon family="ionicons" name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {detail?.holding.ticker ?? 'Détail action'}
          </Text>
          <View style={styles.topBarSpacer} />
        </View>

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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
    ...jakartaExtraBoldText,
    fontSize: typography.body,
    letterSpacing: -0.2,
  },
  topBarSpacer: {
    width: 38,
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

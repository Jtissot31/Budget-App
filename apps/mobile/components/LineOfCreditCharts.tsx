import { useCallback, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { SurfaceCard } from '@/components/SurfaceCard';
import {
  detailCarouselPageMinHeight,
  interBoldText,
  interMediumText,
  spacing,
  typography,
} from '@/constants/theme';
import type { LineOfCreditBalanceHistoryResult } from '@/lib/buildLineOfCreditBalanceHistory';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

const LOC_UTIL_GREEN = '#4ADE80';
const LOC_UTIL_ORANGE = '#FBBF24';
const LOC_UTIL_RED = '#FF6B6B';
const LOC_DISPONIBLE_GRAY = '#8B949E';

const DONUT_CHART_HEIGHT = 148;
const DONUT_LEGEND_HEIGHT = 24;
const DONUT_SIZE = DONUT_CHART_HEIGHT + spacing.sm + DONUT_LEGEND_HEIGHT;
const DONUT_STROKE = 16;
const BALANCE_CHART_HEIGHT = 148;
const LOC_CAROUSEL_CARD_MIN_HEIGHT = detailCarouselPageMinHeight;
const LOC_CAROUSEL_CHART_HEIGHT = BALANCE_CHART_HEIGHT + spacing.sm + 20;

function lineOfCreditUtilColor(utilPct: number): string {
  if (utilPct > 80) return LOC_UTIL_RED;
  if (utilPct >= 50) return LOC_UTIL_ORANGE;
  return LOC_UTIL_GREEN;
}

function balanceTrendPhrase(points: { label: string; value: number }[]): string | null {
  if (points.length < 2) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const delta = last.value - first.value;
  if (delta === 0) {
    return `Ton solde est stable depuis ${first.label.toLowerCase()}`;
  }
  const verb = delta > 0 ? 'augmenté' : 'diminué';
  return `Ton solde a ${verb} de ${formatDisplayMoneyAbsolute(Math.abs(delta))} depuis ${first.label.toLowerCase()}`;
}

function ChartEyebrow({ label }: { label: string }) {
  const { colors } = useAppTheme();
  return <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{label}</Text>;
}

function ChartLegendItem({ color, label }: { color: string; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function UtilizationDonut({
  used,
  available,
  limit,
  usedColor,
}: {
  used: number;
  available: number;
  limit: number;
  usedColor: string;
}) {
  const { colors, isLight } = useAppTheme();
  const radiusValue = (DONUT_SIZE - DONUT_STROKE) / 2;
  const circumference = 2 * Math.PI * radiusValue;
  const safeTotal = Math.max(limit, used + available, 1);
  const usedFraction = used / safeTotal;
  const availableFraction = available / safeTotal;
  const usedDash = usedFraction * circumference;
  const availableDash = availableFraction * circumference;
  const trackColor = isLight ? colors.border : colors.scopeTrack;

  return (
    <View style={styles.donutBlock}>
      <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
        <Circle
          cx={DONUT_SIZE / 2}
          cy={DONUT_SIZE / 2}
          r={radiusValue}
          stroke={trackColor}
          strokeWidth={DONUT_STROKE}
          fill="none"
        />
        <Circle
          cx={DONUT_SIZE / 2}
          cy={DONUT_SIZE / 2}
          r={radiusValue}
          stroke={LOC_DISPONIBLE_GRAY}
          strokeWidth={DONUT_STROKE}
          fill="none"
          strokeDasharray={`${availableDash} ${circumference - availableDash}`}
          strokeDashoffset={-usedDash}
          rotation={-90}
          origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}
          strokeLinecap="butt"
        />
        <Circle
          cx={DONUT_SIZE / 2}
          cy={DONUT_SIZE / 2}
          r={radiusValue}
          stroke={usedColor}
          strokeWidth={DONUT_STROKE}
          fill="none"
          strokeDasharray={`${usedDash} ${circumference - usedDash}`}
          rotation={-90}
          origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}
          strokeLinecap="butt"
        />
      </Svg>
      <View style={styles.donutCenter} pointerEvents="none">
        <Text style={[styles.donutTotal, { color: colors.text }]}>
          {formatDisplayMoneyAbsolute(used)}
        </Text>
        <Text style={[styles.donutCaption, { color: colors.textMuted }]}>utilisé</Text>
      </View>
    </View>
  );
}

function UtilizationSlide({
  usedBalance,
  available,
  creditLimit,
  usedColor,
  carousel = false,
}: {
  usedBalance: number;
  available: number;
  creditLimit: number;
  usedColor: string;
  carousel?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <SurfaceCard
      style={[styles.sectionCard, carousel && styles.locCarouselCard]}
      innerStyle={styles.sectionInner}
    >
      <ChartEyebrow label="Utilisation de la marge" />

      <View style={[styles.donutRow, carousel && styles.carouselChartBlock]}>
        <UtilizationDonut
          used={usedBalance}
          available={available}
          limit={creditLimit}
          usedColor={usedColor}
        />
        <View style={styles.donutStats}>
          <View style={styles.donutStatRow}>
            <ChartLegendItem color={usedColor} label="Utilisé" />
            <Text style={[styles.donutStatValue, { color: colors.text }]}>
              {formatDisplayMoneyAbsolute(usedBalance)}
            </Text>
          </View>
          <View style={styles.donutStatRow}>
            <ChartLegendItem color={LOC_DISPONIBLE_GRAY} label="Disponible" />
            <Text style={[styles.donutStatValue, { color: colors.text }]}>
              {formatDisplayMoneyAbsolute(available)}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.infoLine, { color: colors.textMuted }]}>
        Il te reste {formatDisplayMoneyAbsolute(available)} de disponible sur une limite de{' '}
        {formatDisplayMoneyAbsolute(creditLimit)}
      </Text>
    </SurfaceCard>
  );
}

function BalanceHistoryLineChart({
  points,
  creditLimit,
  chartWidth,
}: {
  points: { label: string; value: number }[];
  creditLimit: number;
  chartWidth: number;
}) {
  const { colors } = useAppTheme();

  const chartPaths = useMemo(() => {
    if (points.length < 2 || chartWidth <= 0) {
      return null;
    }

    const padX = 4;
    const plotTop = 10;
    const plotBottom = BALANCE_CHART_HEIGHT - 22;
    const innerWidth = Math.max(chartWidth - padX * 2, 1);
    const plotHeight = Math.max(plotBottom - plotTop, 1);

    const values = points.map((point) => point.value);
    const dataMin = Math.min(...values, 0);
    const dataMax = Math.max(...values, creditLimit, 1);
    const range = Math.max(dataMax - dataMin, 1);

    const coords = points.map((point, index) => ({
      x: padX + (index / (points.length - 1)) * innerWidth,
      y: plotBottom - ((point.value - dataMin) / range) * plotHeight,
    }));

    const linePath = coords
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');
    const fillPath = `${linePath} L ${coords[coords.length - 1]!.x.toFixed(2)} ${plotBottom} L ${coords[0]!.x.toFixed(2)} ${plotBottom} Z`;

    const limitY = plotBottom - ((creditLimit - dataMin) / range) * plotHeight;
    const labelStride = points.length > 10 ? 3 : points.length > 6 ? 2 : 1;

    return { linePath, fillPath, coords, limitY, padX, innerWidth, plotBottom, labelStride };
  }, [chartWidth, creditLimit, points]);

  if (!chartPaths) return null;

  const limitLabel = `Limite · ${formatDisplayMoneyAbsolute(creditLimit)}`;

  return (
    <Svg width={chartWidth} height={BALANCE_CHART_HEIGHT}>
      <Defs>
        <LinearGradient id="locBalanceFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={LOC_UTIL_GREEN} stopOpacity={0.28} />
          <Stop offset="1" stopColor={LOC_UTIL_GREEN} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>
      <Line
        x1={chartPaths.padX}
        y1={chartPaths.limitY}
        x2={chartPaths.padX + chartPaths.innerWidth}
        y2={chartPaths.limitY}
        stroke={colors.textMuted}
        strokeWidth={1}
        strokeDasharray="4 4"
        opacity={0.55}
      />
      <SvgText
        x={chartPaths.padX + chartPaths.innerWidth}
        y={Math.max(chartPaths.limitY - 6, 10)}
        fontSize={9}
        fontWeight="600"
        fill={colors.textMuted}
        textAnchor="end"
      >
        {limitLabel}
      </SvgText>
      <Path d={chartPaths.fillPath} fill="url(#locBalanceFill)" />
      <Path
        d={chartPaths.linePath}
        stroke={LOC_UTIL_GREEN}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point, index) => {
        if (index % chartPaths.labelStride !== 0 && index !== points.length - 1) return null;
        const x = chartPaths.coords[index]?.x ?? chartPaths.padX;
        return (
          <SvgText
            key={`${point.label}-${index}`}
            x={x}
            y={BALANCE_CHART_HEIGHT - 4}
            fontSize={9}
            fontWeight="700"
            fill={colors.textMuted}
            textAnchor="middle"
          >
            {point.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function BalanceHistorySlide({
  balanceHistory,
  creditLimit,
  chartWidth,
  carousel = false,
}: {
  balanceHistory: LineOfCreditBalanceHistoryResult;
  creditLimit: number;
  chartWidth: number;
  carousel?: boolean;
}) {
  const { colors } = useAppTheme();
  const trendText = balanceTrendPhrase(balanceHistory.points);

  return (
    <SurfaceCard
      style={[styles.sectionCard, carousel && styles.locCarouselCard]}
      innerStyle={styles.sectionInner}
    >
      <ChartEyebrow
        label={balanceHistory.isSimulated ? 'Historique du solde · aperçu' : 'Historique du solde'}
      />
      {balanceHistory.isSimulated ? (
        <Text style={[styles.simulatedNote, { color: colors.textMuted }]}>
          Courbe illustratif simulée pour la démo
        </Text>
      ) : null}
      {trendText ? (
        <Text style={[styles.trendLine, { color: colors.text }]}>{trendText}</Text>
      ) : null}
      <View style={carousel ? styles.carouselChartBlock : undefined}>
        <BalanceHistoryLineChart
          points={balanceHistory.points}
          creditLimit={creditLimit}
          chartWidth={chartWidth}
        />
      </View>
    </SurfaceCard>
  );
}

function LineOfCreditChartCarousel({
  usedBalance,
  available,
  creditLimit,
  usedColor,
  balanceHistory,
}: {
  usedBalance: number;
  available: number;
  creditLimit: number;
  usedColor: string;
  balanceHistory: LineOfCreditBalanceHistoryResult;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const { colors, isLight } = useAppTheme();

  const pageCount = 2;
  const chartWidth = pageWidth > 0 ? pageWidth - spacing.lg * 2 : 0;
  const dotColor = isLight ? colors.border : colors.scopeTrack;

  const onCarouselLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0) {
      setPageWidth((prev) => (Math.abs(prev - width) > 0.5 ? width : prev));
    }
  }, []);

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const page = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      const clamped = Math.min(Math.max(0, page), pageCount - 1);
      setActiveIndex((prev) => (prev === clamped ? prev : clamped));
    },
    [pageCount, pageWidth],
  );

  return (
    <View style={styles.carouselWrap} onLayout={onCarouselLayout}>
      {pageWidth > 0 ? (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            onMomentumScrollEnd={onMomentumScrollEnd}
            scrollEventThrottle={16}
          >
            <View key="utilization" style={[styles.carouselPage, { width: pageWidth }]}>
              <UtilizationSlide
                usedBalance={usedBalance}
                available={available}
                creditLimit={creditLimit}
                usedColor={usedColor}
                carousel
              />
            </View>
            <View key="history" style={[styles.carouselPage, { width: pageWidth }]}>
              <BalanceHistorySlide
                balanceHistory={balanceHistory}
                creditLimit={creditLimit}
                chartWidth={chartWidth}
                carousel
              />
            </View>
          </ScrollView>
          <View style={styles.pagination}>
            {Array.from({ length: pageCount }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  { backgroundColor: dotColor },
                  index === activeIndex && [styles.dotActive, { backgroundColor: LOC_UTIL_GREEN }],
                ]}
              />
            ))}
          </View>
        </>
      ) : (
        <View style={styles.carouselPlaceholder} />
      )}
    </View>
  );
}

export function LineOfCreditCharts({
  balance,
  creditLimit,
  balanceHistory,
}: {
  balance: number;
  creditLimit: number;
  balanceHistory: LineOfCreditBalanceHistoryResult | null;
}) {
  const usedBalance = Math.max(balance, 0);
  const available = Math.max(creditLimit - usedBalance, 0);
  const utilPct =
    creditLimit > 0 ? Math.min((usedBalance / creditLimit) * 100, 100) : 0;
  const usedColor = lineOfCreditUtilColor(utilPct);

  if (balanceHistory && balanceHistory.points.length >= 2) {
    return (
      <LineOfCreditChartCarousel
        usedBalance={usedBalance}
        available={available}
        creditLimit={creditLimit}
        usedColor={usedColor}
        balanceHistory={balanceHistory}
      />
    );
  }

  return (
    <UtilizationSlide
      usedBalance={usedBalance}
      available={available}
      creditLimit={creditLimit}
      usedColor={usedColor}
    />
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    gap: spacing.sm,
  },
  sectionInner: {
    gap: spacing.sm,
  },
  eyebrow: {
    ...interBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    ...interBoldText,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  donutBlock: {
    width: DONUT_SIZE,
    height: DONUT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  donutTotal: {
    fontSize: typography.caption,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  donutCaption: {
    ...interBoldText,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  donutStats: {
    flex: 1,
    gap: spacing.md,
  },
  donutStatRow: {
    gap: 4,
  },
  donutStatValue: {
    fontSize: typography.body,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  infoLine: {
    ...interMediumText,
    fontSize: typography.meta,
    lineHeight: 18,
  },
  trendLine: {
    ...interMediumText,
    fontSize: typography.meta,
    lineHeight: 18,
  },
  simulatedNote: {
    ...interMediumText,
    fontSize: typography.micro,
    lineHeight: 16,
  },
  carouselWrap: {
    width: '100%',
  },
  carouselPage: {
    minHeight: LOC_CAROUSEL_CARD_MIN_HEIGHT,
  },
  locCarouselCard: {
    flex: 1,
    minHeight: LOC_CAROUSEL_CARD_MIN_HEIGHT,
  },
  carouselChartBlock: {
    minHeight: LOC_CAROUSEL_CHART_HEIGHT,
    justifyContent: 'center',
  },
  carouselPlaceholder: {
    height: LOC_CAROUSEL_CARD_MIN_HEIGHT,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 99,
  },
  dotActive: {
    width: 18,
  },
});

import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';
import { SurfaceCard } from '@/components/SurfaceCard';
import {
  detailCarouselPageMinHeight,
  moneyAmountTypography,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import {
  computeLoanAmortization,
  MORTGAGE_CHART_CAPITAL,
  MORTGAGE_CHART_INTEREST,
  type MortgageAmortizationResult,
} from '@/lib/mortgageAmortization';
import { useAppTheme } from '@/lib/themeContext';
import type { Loan, LoanType } from '@/types';

const LOAN_TYPES_WITH_PAYMENT_DONUT: LoanType[] = ['mortgage', 'personal_loan'];

const ANNUAL_CHART_HEIGHT = 148;
const ANNUAL_CHART_LEGEND_HEIGHT = 24;
const MORTGAGE_CAROUSEL_CHART_HEIGHT =
  ANNUAL_CHART_HEIGHT + spacing.sm + ANNUAL_CHART_LEGEND_HEIGHT;
const DONUT_SIZE = MORTGAGE_CAROUSEL_CHART_HEIGHT;
const DONUT_STROKE = 16;
const MORTGAGE_CAROUSEL_CARD_MIN_HEIGHT = detailCarouselPageMinHeight;

function ChartEyebrow({ label }: { label: string }) {
  const { colors } = useAppTheme();
  return (
    <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{label}</Text>
  );
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

function PaymentSplitDonut({
  principal,
  interest,
  total,
}: {
  principal: number;
  interest: number;
  total: number;
}) {
  const { colors, isLight } = useAppTheme();
  const radiusValue = (DONUT_SIZE - DONUT_STROKE) / 2;
  const circumference = 2 * Math.PI * radiusValue;
  const safeTotal = Math.max(total, principal + interest, 1);
  const principalFraction = principal / safeTotal;
  const interestFraction = interest / safeTotal;
  const principalDash = principalFraction * circumference;
  const interestDash = interestFraction * circumference;
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
          stroke={MORTGAGE_CHART_INTEREST}
          strokeWidth={DONUT_STROKE}
          fill="none"
          strokeDasharray={`${interestDash} ${circumference - interestDash}`}
          strokeDashoffset={-principalDash}
          rotation={-90}
          origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}
          strokeLinecap="butt"
        />
        <Circle
          cx={DONUT_SIZE / 2}
          cy={DONUT_SIZE / 2}
          r={radiusValue}
          stroke={MORTGAGE_CHART_CAPITAL}
          strokeWidth={DONUT_STROKE}
          fill="none"
          strokeDasharray={`${principalDash} ${circumference - principalDash}`}
          rotation={-90}
          origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}
          strokeLinecap="butt"
        />
      </Svg>
      <View style={styles.donutCenter} pointerEvents="none">
        <Text style={[styles.donutTotal, { color: colors.text }]}>
          {formatDisplayMoneyAbsolute(total)}
        </Text>
        <Text style={[styles.donutCaption, { color: colors.textMuted }]}>par paiement</Text>
      </View>
    </View>
  );
}

function AnnualStackedBarChart({
  schedule,
  chartWidth,
}: {
  schedule: MortgageAmortizationResult;
  chartWidth: number;
}) {
  const { colors } = useAppTheme();
  const summaries = schedule.annualSummaries;
  if (summaries.length === 0) return null;

  const maxAnnualTotal = Math.max(
    ...summaries.map((year) => year.principalPaid + year.interestPaid),
    1,
  );
  const barGap = summaries.length > 20 ? 3 : 5;
  const barWidth = Math.max(
    6,
    (chartWidth - barGap * (summaries.length - 1)) / summaries.length,
  );
  const plotHeight = ANNUAL_CHART_HEIGHT - 28;
  const labelStride = summaries.length > 16 ? 5 : summaries.length > 10 ? 3 : 2;

  return (
    <View>
      <Svg width={chartWidth} height={ANNUAL_CHART_HEIGHT}>
        {summaries.map((year, index) => {
          const total = year.principalPaid + year.interestPaid;
          const scale = total / maxAnnualTotal;
          const barHeight = Math.max(scale * plotHeight, total > 0 ? 4 : 0);
          const x = index * (barWidth + barGap);
          const interestHeight = (year.interestPaid / Math.max(total, 1)) * barHeight;
          const principalHeight = barHeight - interestHeight;
          const baseY = ANNUAL_CHART_HEIGHT - 20;
          return (
            <Fragment key={`${year.calendarYear}-${index}`}>
              <Rect
                x={x}
                y={baseY - interestHeight}
                width={barWidth}
                height={interestHeight}
                rx={2}
                fill={MORTGAGE_CHART_INTEREST}
                opacity={0.55}
              />
              <Rect
                x={x}
                y={baseY - barHeight}
                width={barWidth}
                height={principalHeight}
                rx={2}
                fill={MORTGAGE_CHART_CAPITAL}
              />
              {index % labelStride === 0 || index === summaries.length - 1 ? (
                <SvgText
                  x={x + barWidth / 2}
                  y={ANNUAL_CHART_HEIGHT - 4}
                  fontSize={9}
                  fontWeight="700"
                  fill={colors.textMuted}
                  textAnchor="middle"
                >
                  {String(year.calendarYear).slice(-2)}
                </SvgText>
              ) : null}
            </Fragment>
          );
        })}
      </Svg>
      <View style={styles.annualLegendRow}>
        <ChartLegendItem color={MORTGAGE_CHART_CAPITAL} label="Capital" />
        <ChartLegendItem color={MORTGAGE_CHART_INTEREST} label="Intérêts" />
      </View>
    </View>
  );
}

function PaymentSplitDonutCard({
  loan,
  schedule,
  carousel = false,
}: {
  loan: Loan;
  schedule: MortgageAmortizationResult;
  carousel?: boolean;
}) {
  const { colors } = useAppTheme();
  const split = schedule.currentPaymentSplit;
  if (!split || split.total <= 0) return null;

  const metaLabel =
    loan.type === 'mortgage'
      ? schedule.hasRate
        ? `Paiement ${loan.rateType === 'variable' ? 'variable' : 'actuel'}`
        : 'Estimation sans taux'
      : schedule.hasRate
        ? 'Paiement actuel'
        : 'Estimation sans taux';

  return (
    <SurfaceCard
      style={[styles.sectionCard, carousel && styles.mortgageCarouselCard]}
      innerStyle={styles.sectionInner}
    >
      <ChartEyebrow label="Répartition du paiement" />
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Capital vs intérêts
      </Text>
      <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>{metaLabel}</Text>
      <View style={[styles.donutRow, carousel && styles.carouselChartBlock]}>
        <PaymentSplitDonut
          principal={split.principal}
          interest={split.interest}
          total={split.total}
        />
        <View style={styles.donutStats}>
          <View style={styles.donutStatRow}>
            <ChartLegendItem color={MORTGAGE_CHART_CAPITAL} label="Capital" />
            <Text style={[styles.donutStatValue, { color: colors.text }]}>
              {formatDisplayMoneyAbsolute(split.principal)}
            </Text>
          </View>
          <View style={styles.donutStatRow}>
            <ChartLegendItem color={MORTGAGE_CHART_INTEREST} label="Intérêts" />
            <Text style={[styles.donutStatValue, { color: colors.text }]}>
              {formatDisplayMoneyAbsolute(split.interest)}
            </Text>
          </View>
          {!schedule.hasRate ? (
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
              Ajoutez un taux pour affiner la répartition.
            </Text>
          ) : null}
        </View>
      </View>
    </SurfaceCard>
  );
}

function useLoanAmortizationSchedule(loan: Loan | null) {
  return useMemo(() => {
    if (!loan || !LOAN_TYPES_WITH_PAYMENT_DONUT.includes(loan.type)) return null;
    return computeLoanAmortization(loan);
  }, [loan]);
}

export function LoanPaymentDonutChart({ loan }: { loan: Loan }) {
  const schedule = useLoanAmortizationSchedule(loan.type === 'personal_loan' ? loan : null);
  if (!schedule) return null;
  return <PaymentSplitDonutCard loan={loan} schedule={schedule} />;
}

function AnnualPaymentsCard({
  schedule,
  chartWidth,
  carousel = false,
}: {
  schedule: MortgageAmortizationResult;
  chartWidth: number;
  carousel?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <SurfaceCard
      style={[styles.sectionCard, carousel && styles.mortgageCarouselCard]}
      innerStyle={styles.sectionInner}
    >
      <ChartEyebrow label="Paiements annuels" />
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Capital et intérêts par année
      </Text>
      <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>
        Les premières années sont surtout des intérêts
      </Text>
      <View style={carousel ? styles.carouselChartBlock : undefined}>
        <AnnualStackedBarChart schedule={schedule} chartWidth={chartWidth} />
      </View>
    </SurfaceCard>
  );
}

function MortgageChartCarousel({
  loan,
  schedule,
}: {
  loan: Loan;
  schedule: MortgageAmortizationResult;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const { colors, isLight } = useAppTheme();

  const hasDonut = Boolean(schedule.currentPaymentSplit && schedule.currentPaymentSplit.total > 0);
  const hasAnnual = schedule.annualSummaries.length > 0;
  const pageCount = (hasDonut ? 1 : 0) + (hasAnnual ? 1 : 0);
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

  if (pageCount === 0) return null;

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
            {hasDonut ? (
              <View key="donut" style={[styles.carouselPage, { width: pageWidth }]}>
                <PaymentSplitDonutCard loan={loan} schedule={schedule} carousel />
              </View>
            ) : null}
            {hasAnnual ? (
              <View key="annual" style={[styles.carouselPage, { width: pageWidth }]}>
                <AnnualPaymentsCard schedule={schedule} chartWidth={chartWidth} carousel />
              </View>
            ) : null}
          </ScrollView>
          {pageCount > 1 ? (
            <View style={styles.pagination}>
              {Array.from({ length: pageCount }, (_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    { backgroundColor: dotColor },
                    index === activeIndex && [styles.dotActive, { backgroundColor: colors.primary }],
                  ]}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.carouselPlaceholder} />
      )}
    </View>
  );
}

export function MortgageDetailCharts({ loan }: { loan: Loan }) {
  const schedule = useLoanAmortizationSchedule(loan.type === 'mortgage' ? loan : null);

  if (!schedule) return null;

  return <MortgageChartCarousel loan={loan} schedule={schedule} />;
}

const styles = StyleSheet.create({
  sectionCard: {
    gap: spacing.sm,
  },
  sectionInner: {
    gap: spacing.sm,
  },
  eyebrow: {
    ...typographyKit.eyebrow,
  },
  sectionTitle: {
    ...typographyKit.sectionTitle,
  },
  sectionMeta: {
    ...typographyKit.metaMedium,
  },
  sectionHint: {
    ...typographyKit.microMedium,
    marginTop: spacing.xs,
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
    ...typographyKit.eyebrow,
    fontSize: 10,
    letterSpacing: 0.4,
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
    ...moneyAmountTypography({ tier: 'row' }),
    letterSpacing: -0.2,
  },
  donutCaption: {
    ...typographyKit.microUpper,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  donutStats: {
    flex: 1,
    gap: spacing.md,
  },
  donutStatRow: {
    gap: 4,
  },
  donutStatValue: {
    ...moneyAmountTypography({ tier: 'card' }),
  },
  annualLegendRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  carouselWrap: {
    width: '100%',
  },
  carouselPage: {
    minHeight: MORTGAGE_CAROUSEL_CARD_MIN_HEIGHT,
  },
  mortgageCarouselCard: {
    flex: 1,
    minHeight: MORTGAGE_CAROUSEL_CARD_MIN_HEIGHT,
  },
  carouselChartBlock: {
    minHeight: MORTGAGE_CAROUSEL_CHART_HEIGHT,
    justifyContent: 'center',
  },
  carouselPlaceholder: {
    height: MORTGAGE_CAROUSEL_CARD_MIN_HEIGHT,
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

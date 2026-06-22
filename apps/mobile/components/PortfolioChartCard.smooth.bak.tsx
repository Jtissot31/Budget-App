import { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { GlassContainer } from '@/components/GlassContainer';
import {
  LINEAR_CHART_NEGATIVE,
  LINEAR_CHART_NEGATIVE_LIGHT,
} from '@/constants/linearChart';
import {
  jakartaBoldText,
  jakartaExtraBoldText,
  PAGE_PADDING_HORIZONTAL,
  portfolioDark,
  portfolioLight,
  chartTokens,
  radius,
  spacing,
} from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { chartMetricAmount } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';

const ASSETS_PILL_COLOR = chartTokens.line;
const DEBTS_PILL_COLOR = chartTokens.negative;
const PILL_BORDER_RADIUS = 24;

export type NetWorthTrendPoint = {
  label: string;
  value: number;
};

export type NetWorthChartPeriod = '1S' | '1M' | '6M';

const CHART_CARD_PADDING = PAGE_PADDING_HORIZONTAL;
const CHART_HEIGHT = 150;
const CHART_VERTICAL_PADDING = 10;
const CHART_Y_DOMAIN_TOP_PADDING_RATIO = 0.1;
const CHART_Y_DOMAIN_BOTTOM_PADDING_RATIO = 0.03;

const CHART_STROKE_MAIN = 2.5;
const CHART_STROKE_GLOW = 10;
const CHART_GLOW_OPACITY = 0.22;
const END_DOT_R = 6;
const END_DOT_GLOW_R = 8;
const END_DOT_GLOW_OPACITY = 0.35;
// Extra space (px) around the SVG so the end-dot glow is never clipped.
const SVG_DOT_OVERFLOW = END_DOT_GLOW_R + 2;

const NET_WORTH_PERIOD_TABS: { id: NetWorthChartPeriod; label: string }[] = [
  { id: '1S', label: '1S' },
  { id: '1M', label: '1M' },
  { id: '6M', label: '6M' },
];

const NET_WORTH_PERIOD_POINT_COUNT: Record<NetWorthChartPeriod, number> = {
  '1S': 3,
  '1M': 4,
  '6M': 6,
};

function sliceNetWorthPointsForPeriod(points: NetWorthTrendPoint[], period: NetWorthChartPeriod) {
  const count = Math.min(NET_WORTH_PERIOD_POINT_COUNT[period], points.length);
  return points.slice(points.length - count);
}

const CHART_CURVE_TENSION = 14;

function buildSmoothLinePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(index - 1, 0)];
    const current = points[index];
    const next = points[index + 1];
    const after = points[Math.min(index + 2, points.length - 1)];
    const control1X = current.x + (next.x - previous.x) / CHART_CURVE_TENSION;
    const control1Y = current.y + (next.y - previous.y) / CHART_CURVE_TENSION;
    const control2X = next.x - (after.x - current.x) / CHART_CURVE_TENSION;
    const control2Y = next.y - (after.y - current.y) / CHART_CURVE_TENSION;
    path += ` C ${control1X} ${control1Y} ${control2X} ${control2Y} ${next.x} ${next.y}`;
  }
  return path;
}

/**
 * Splits the polyline into per-segment cubic bezier paths, each coloured
 * green (going up / flat) or red (going down) based on the SVG-space delta.
 * Because SVG y grows downward, next.y > current.y means value decreased.
 */
function buildSegmentPaths(
  points: { x: number; y: number }[],
  positiveColor: string,
  negativeColor: string,
): { path: string; color: string }[] {
  if (points.length < 2) return [];
  const segments: { path: string; color: string }[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const previous = points[Math.max(i - 1, 0)];
    const current = points[i];
    const next = points[i + 1];
    const after = points[Math.min(i + 2, points.length - 1)];
    const c1x = current.x + (next.x - previous.x) / CHART_CURVE_TENSION;
    const c1y = current.y + (next.y - previous.y) / CHART_CURVE_TENSION;
    const c2x = next.x - (after.x - current.x) / CHART_CURVE_TENSION;
    const c2y = next.y - (after.y - current.y) / CHART_CURVE_TENSION;
    const segPath = `M ${current.x} ${current.y} C ${c1x} ${c1y} ${c2x} ${c2y} ${next.x} ${next.y}`;
    const goingDown = next.y > current.y;
    segments.push({ path: segPath, color: goingDown ? negativeColor : positiveColor });
  }
  return segments;
}

function buildSmoothChartPaths(values: number[], chartWidth: number) {
  const dataMin = Math.min(...values, 0);
  const dataMax = Math.max(...values, 0);
  const dataRange = Math.max(dataMax - dataMin, 1);
  const minValue = dataMin - dataRange * CHART_Y_DOMAIN_BOTTOM_PADDING_RATIO;
  const maxValue = dataMax + dataRange * CHART_Y_DOMAIN_TOP_PADDING_RATIO;
  const range = maxValue - minValue;
  const innerHeight = CHART_HEIGHT - CHART_VERTICAL_PADDING * 2;
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * chartWidth;
    const y = CHART_VERTICAL_PADDING + (1 - (value - minValue) / range) * innerHeight;
    return { x, y };
  });
  const [firstPoint] = points;
  const lastPoint = points[points.length - 1] ?? firstPoint;
  const linePath = buildSmoothLinePath(points);
  const areaPath = `${linePath} L ${lastPoint.x} ${CHART_HEIGHT} L ${firstPoint.x} ${CHART_HEIGHT} Z`;

  return { areaPath, lastPoint, linePath, points };
}

function PeriodSelector({
  active,
  onChange,
}: {
  active: NetWorthChartPeriod;
  onChange: (period: NetWorthChartPeriod) => void;
}) {
  const { colors, isLight } = useAppTheme();
  const activeBg = isLight ? 'rgba(14, 168, 94, 0.14)' : portfolioDark.periodActiveBg;
  const activeColor = isLight ? portfolioLight.chartCurve : portfolioDark.chartCurve;
  const inactiveColor = isLight ? colors.textMuted : portfolioDark.textMuted;

  return (
    <View style={styles.periodSelectorRow}>
      {NET_WORTH_PERIOD_TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.id)}
            style={[styles.periodSelectorTab, selected && { backgroundColor: activeBg }]}
          >
            <Text
              style={[
                styles.periodSelectorLabel,
                { color: selected ? activeColor : inactiveColor },
                selected && styles.periodSelectorLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function formatScopePillAmount(amount: number, mode: 'asset' | 'debt') {
  const abs = Math.abs(amount);
  if (mode === 'debt') {
    return abs === 0 ? formatDisplayMoneyAbsolute(0) : `−${formatDisplayMoneyAbsolute(abs)}`;
  }
  return formatDisplayMoneyAbsolute(abs);
}

function ScopeMetricPill({
  label,
  amount,
  amountColor,
  backgroundColor,
  labelColor,
  amountMode = 'asset',
}: {
  label: string;
  amount: number;
  amountColor: string;
  backgroundColor: string;
  labelColor: string;
  amountMode?: 'asset' | 'debt';
}) {
  return (
    <View style={[styles.metricPill, { backgroundColor }]}>
      <Text style={[styles.metricPillLabel, { color: labelColor }]}>{label}</Text>
      <Text style={[styles.metricPillAmount, { color: amountColor }]} numberOfLines={1}>
        {formatScopePillAmount(amount, amountMode)}
      </Text>
    </View>
  );
}

export function PortfolioChartCard({
  points,
  totalAssets,
  totalDebts,
}: {
  points: NetWorthTrendPoint[];
  totalAssets: number;
  totalDebts: number;
}) {
  const { colors, isLight } = useAppTheme();
  const [chartPeriod, setChartPeriod] = useState<NetWorthChartPeriod>('6M');
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      setContainerWidth(nextWidth);
    }
  }, []);

  const chartWidth = Math.max(containerWidth - CHART_CARD_PADDING * 2, 0);
  const visiblePoints = useMemo(
    () => sliceNetWorthPointsForPeriod(points, chartPeriod),
    [chartPeriod, points],
  );
  const values = useMemo(() => visiblePoints.map((point) => point.value), [visiblePoints]);
  const chart = useMemo(() => buildSmoothChartPaths(values, chartWidth), [values, chartWidth]);
  const positiveColor = isLight ? portfolioLight.chartCurve : portfolioDark.chartCurve;
  const negativeColor = isLight ? LINEAR_CHART_NEGATIVE_LIGHT : LINEAR_CHART_NEGATIVE;
  const segments = useMemo(
    () => buildSegmentPaths(chart.points, positiveColor, negativeColor),
    [chart.points, positiveColor, negativeColor],
  );
  const lastSegmentColor = segments[segments.length - 1]?.color ?? positiveColor;
  const chartAreaBg = isLight ? portfolioLight.chartFill : 'transparent';
  const gradientTop = isLight ? portfolioLight.chartCurve : portfolioDark.chartCurve;
  const gradientBottom = isLight ? 'rgba(14, 168, 94, 0)' : portfolioDark.chartFillBottom;
  const monthLabelColor = isLight ? colors.textMuted : portfolioDark.textTertiary;
  const pillBackground = isLight ? portfolioLight.chartFill : portfolioDark.card;
  const pillLabelColor = isLight ? colors.textMuted : portfolioDark.textMuted;

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      {containerWidth > 0 ? (
        <GlassContainer
          style={{ width: '100%' }}
          borderRadius={radius.card}
          padding={CHART_CARD_PADDING}
        >
          <PeriodSelector active={chartPeriod} onChange={setChartPeriod} />
          <View
            style={[
              styles.chartFrame,
              { width: chartWidth, height: CHART_HEIGHT, backgroundColor: chartAreaBg },
            ]}
          >
            {/* SVG is intentionally wider/taller by SVG_DOT_OVERFLOW on each side so the
                end-dot glow is never clipped. The negative margin pulls it back into the
                frame so the chart coordinates line up exactly with the View. */}
            <Svg
              width={chartWidth + SVG_DOT_OVERFLOW * 2}
              height={CHART_HEIGHT + SVG_DOT_OVERFLOW * 2}
              viewBox={`${-SVG_DOT_OVERFLOW} ${-SVG_DOT_OVERFLOW} ${chartWidth + SVG_DOT_OVERFLOW * 2} ${CHART_HEIGHT + SVG_DOT_OVERFLOW * 2}`}
              style={{ marginLeft: -SVG_DOT_OVERFLOW, marginTop: -SVG_DOT_OVERFLOW }}
            >
              <Defs>
                <LinearGradient id="portfolioAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={gradientTop} stopOpacity={isLight ? 0.35 : 0.4} />
                  <Stop offset="100%" stopColor={gradientBottom} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d={chart.areaPath} fill="url(#portfolioAreaGradient)" />
              {/* Glow pass — rendered before main lines so glows sit underneath */}
              {segments.map((seg, i) => (
                <Path
                  key={`glow-${i}`}
                  d={seg.path}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={CHART_STROKE_GLOW}
                  strokeOpacity={CHART_GLOW_OPACITY}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {/* Main line pass */}
              {segments.map((seg, i) => (
                <Path
                  key={`line-${i}`}
                  d={seg.path}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={CHART_STROKE_MAIN}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              <Circle
                cx={chart.lastPoint.x}
                cy={chart.lastPoint.y}
                r={END_DOT_GLOW_R}
                fill={lastSegmentColor}
                opacity={END_DOT_GLOW_OPACITY}
              />
              <Circle
                cx={chart.lastPoint.x}
                cy={chart.lastPoint.y}
                r={END_DOT_R}
                fill={lastSegmentColor}
              />
            </Svg>
          </View>
          <View style={styles.monthAxis}>
            {visiblePoints.map((point, index) => (
              <Text
                key={`${point.label}-${index}`}
                style={[
                  styles.monthLabel,
                  index === 0 && styles.monthLabelStart,
                  index === visiblePoints.length - 1 && styles.monthLabelEnd,
                  { color: monthLabelColor },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.84}
              >
                {point.label}
              </Text>
            ))}
          </View>
          <View style={styles.metricPillsRow}>
            <ScopeMetricPill
              label="Actifs"
              amount={totalAssets}
              amountColor={ASSETS_PILL_COLOR}
              backgroundColor={pillBackground}
              labelColor={pillLabelColor}
            />
            <ScopeMetricPill
              label="Dettes"
              amount={totalDebts}
              amountColor={DEBTS_PILL_COLOR}
              backgroundColor={pillBackground}
              labelColor={pillLabelColor}
              amountMode="debt"
            />
          </View>
        </GlassContainer>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
    width: '100%',
  },
  periodSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  periodSelectorTab: {
    minWidth: 36,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  periodSelectorLabel: {
    ...jakartaBoldText,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  periodSelectorLabelActive: {
    ...jakartaExtraBoldText,
  },
  chartFrame: {
    alignSelf: 'center',
    borderRadius: radius.sm,
    overflow: 'visible',
  },
  monthAxis: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  monthLabel: {
    ...jakartaBoldText,
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  monthLabelStart: {
    textAlign: 'left',
  },
  monthLabelEnd: {
    textAlign: 'right',
  },
  metricPillsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginTop: spacing.md,
  },
  metricPill: {
    flex: 1,
    minWidth: 0,
    borderRadius: PILL_BORDER_RADIUS,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  metricPillLabel: {
    ...jakartaBoldText,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metricPillAmount: {
    ...chartMetricAmount,
    marginTop: 4,
  },
});

import { useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { GlassContainer } from '@/components/GlassContainer';
import {
  LINEAR_CHART_NEGATIVE,
  LINEAR_CHART_NEGATIVE_LIGHT,
} from '@/constants/linearChart';
import {
  interBoldText,
  interExtraBoldText,
  PAGE_PADDING_HORIZONTAL,
  portfolioDark,
  portfolioLight,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

export type NetWorthTrendPoint = {
  label: string;
  value: number;
};

export type NetWorthChartPeriod = '1S' | '1M' | '6M' | '1A' | 'all';

const CHART_CARD_PADDING = PAGE_PADDING_HORIZONTAL;
const CHART_HEIGHT = 150;
const CHART_VERTICAL_PADDING = 10;

const CHART_STROKE_MAIN = 2.5;
const CHART_STROKE_GLOW = 10;
const CHART_GLOW_OPACITY = 0.22;
const END_DOT_R = 6;
const END_DOT_GLOW_R = 8;
const END_DOT_GLOW_OPACITY = 0.35;

const NET_WORTH_PERIOD_TABS: Array<{ id: NetWorthChartPeriod; label: string }> = [
  { id: '1S', label: '1S' },
  { id: '1M', label: '1M' },
  { id: '6M', label: '6M' },
  { id: '1A', label: '1A' },
  { id: 'all', label: 'Tout' },
];

const NET_WORTH_PERIOD_POINT_COUNT: Record<NetWorthChartPeriod, number> = {
  '1S': 2,
  '1M': 2,
  '6M': 5,
  '1A': 5,
  all: 5,
};

function sliceNetWorthPointsForPeriod(points: NetWorthTrendPoint[], period: NetWorthChartPeriod) {
  const count = Math.min(NET_WORTH_PERIOD_POINT_COUNT[period], points.length);
  return points.slice(points.length - count);
}

function buildSmoothLinePath(points: Array<{ x: number; y: number }>) {
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
    const control1X = current.x + (next.x - previous.x) / 6;
    const control1Y = current.y + (next.y - previous.y) / 6;
    const control2X = next.x - (after.x - current.x) / 6;
    const control2Y = next.y - (after.y - current.y) / 6;
    path += ` C ${control1X} ${control1Y} ${control2X} ${control2Y} ${next.x} ${next.y}`;
  }
  return path;
}

function buildSmoothChartPaths(values: number[], chartWidth: number) {
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const range = Math.max(maxValue - minValue, 1);
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

export function PortfolioChartCard({ points }: { points: NetWorthTrendPoint[] }) {
  const { colors, isLight } = useAppTheme();
  const [chartPeriod, setChartPeriod] = useState<NetWorthChartPeriod>('6M');
  const screenWidth = Dimensions.get('window').width;
  const chartCardWidth = screenWidth - PAGE_PADDING_HORIZONTAL * 2;
  const chartWidth = chartCardWidth - CHART_CARD_PADDING * 2;
  const visiblePoints = useMemo(
    () => sliceNetWorthPointsForPeriod(points, chartPeriod),
    [chartPeriod, points],
  );
  const values = useMemo(() => visiblePoints.map((point) => point.value), [visiblePoints]);
  const chart = useMemo(() => buildSmoothChartPaths(values, chartWidth), [values, chartWidth]);
  const previousMonthValue = values[Math.max(values.length - 2, 0)] ?? 0;
  const delta = values[values.length - 1] - previousMonthValue;
  const deltaPositive = delta >= 0;
  const chartTone = isLight
    ? deltaPositive
      ? portfolioLight.chartCurve
      : LINEAR_CHART_NEGATIVE_LIGHT
    : deltaPositive
      ? portfolioDark.chartCurve
      : LINEAR_CHART_NEGATIVE;
  const chartAreaBg = isLight ? portfolioLight.chartFill : 'transparent';
  const gradientTop = isLight ? portfolioLight.chartCurve : portfolioDark.chartCurve;
  const gradientBottom = isLight ? 'rgba(14, 168, 94, 0)' : portfolioDark.chartFillBottom;
  const monthLabelColor = isLight ? colors.textMuted : portfolioDark.textTertiary;

  return (
    <View style={styles.wrapper}>
      <GlassContainer
        style={{ width: chartCardWidth }}
        borderRadius={radius.lg}
        padding={CHART_CARD_PADDING}
      >
        <PeriodSelector active={chartPeriod} onChange={setChartPeriod} />
        <View
          style={[
            styles.chartFrame,
            { width: chartWidth, height: CHART_HEIGHT, backgroundColor: chartAreaBg },
          ]}
        >
          <Svg width={chartWidth} height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}>
            <Defs>
              <LinearGradient id="portfolioAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={gradientTop} stopOpacity={isLight ? 0.35 : 0.4} />
                <Stop offset="100%" stopColor={gradientBottom} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={chart.areaPath} fill="url(#portfolioAreaGradient)" />
            <Path
              d={chart.linePath}
              fill="none"
              stroke={chartTone}
              strokeWidth={CHART_STROKE_GLOW}
              strokeOpacity={CHART_GLOW_OPACITY}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={chart.linePath}
              fill="none"
              stroke={chartTone}
              strokeWidth={CHART_STROKE_MAIN}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Circle
              cx={chart.lastPoint.x}
              cy={chart.lastPoint.y}
              r={END_DOT_GLOW_R}
              fill={chartTone}
              opacity={END_DOT_GLOW_OPACITY}
            />
            <Circle cx={chart.lastPoint.x} cy={chart.lastPoint.y} r={END_DOT_R} fill={chartTone} />
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
      </GlassContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: PAGE_PADDING_HORIZONTAL,
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
    ...interBoldText,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  periodSelectorLabelActive: {
    ...interExtraBoldText,
  },
  chartFrame: {
    alignSelf: 'center',
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  monthAxis: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  monthLabel: {
    ...interBoldText,
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
});

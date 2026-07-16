import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { DASHBOARD_VALUE_GREEN, jakartaMediumText, moneyAmountTypography } from '@/constants/theme';
import { ThemeSegmentedControl } from '@/components/ThemeSegmentedControl';
import { formatDisplayMoney } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

const CHART_LINE = DASHBOARD_VALUE_GREEN;
const CHART_STROKE_WIDTH = 2;
/** Soft under-line wash — keep fade shape, stronger so it reads on dark canvas. */
const AREA_FILL_TOP_OPACITY = 0.45;
const AREA_FILL_MID_OPACITY = 0.16;
const AREA_FILL_BOTTOM_OPACITY = 0;
/** Always-visible dot at the latest (in-progress) point. */
const ENDPOINT_DOT_R = 3;
const ENDPOINT_DOT_HALO_R = ENDPOINT_DOT_R + 2;
const ENDPOINT_HALO_BREATHE_MS = 1800;
const ENDPOINT_RIPPLE_MS = 2600;
const ENDPOINT_RIPPLE_EXPAND = 5;
/** Period-change line morph — fast ease-out. */
const MORPH_DURATION_MS = 320;
const MORPH_EASING = Easing.out(Easing.cubic);
/** Fixed sample count so periods with different point counts can interpolate. */
const MORPH_SAMPLE_COUNT = 48;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
/** Larger dot when scrubbing a historical point. */
const SELECTION_DOT_R = 4;
const SVG_DOT_OVERFLOW = SELECTION_DOT_R + 2;
const CROSSHAIR_COLOR = '#888888';
const CROSSHAIR_WIDTH = 1;
const POINT_LABEL_FONT_SIZE = 11;
const POINT_LABEL_OFFSET = 10;
const POINT_LABEL_CHAR_WIDTH = POINT_LABEL_FONT_SIZE * 0.55;
const POINT_LABEL_PAD_H = 5;
const POINT_LABEL_PAD_V = 2;

export type NetWorthTrendPoint = {
  label: string;
  value: number;
};

export type NetWorthChartPeriod =
  | '1J'
  | '1S'
  | '1M'
  | '3M'
  | '6M'
  | 'CA'
  | 'YTD'
  | '1A'
  | '2A'
  | '3A'
  | '5A'
  | '10A'
  | 'TOUT';

const CHART_HEIGHT = 190;
const CHART_VERTICAL_PADDING = 6;
/** Horizontal inset on both edges — room for endpoint dot and balanced plot margins. */
const CHART_HORIZONTAL_INSET = 1;
/** Right inset when plotHorizontalInset is 0 — keeps endpoint halo inside the frame (RN clips overflow). */
export const CHART_FULL_BLEED_RIGHT_INSET = ENDPOINT_DOT_HALO_R + 1;
const CHART_Y_PADDING_RATIO = 0.05;

export const PERIOD_DELTA_LABELS: Record<NetWorthChartPeriod, string> = {
  '1J': 'aujourd’hui',
  '1S': 'dernière semaine',
  '1M': 'ce dernier mois',
  '3M': 'ces 3 derniers mois',
  '6M': 'ces 6 derniers mois',
  CA: 'cette année',
  YTD: 'depuis le début de l’année',
  '1A': 'cette dernière année',
  '2A': 'ces 2 dernières années',
  '3A': 'ces 3 dernières années',
  '5A': 'ces 5 dernières années',
  '10A': 'ces 10 dernières années',
  TOUT: 'toute la période',
};

const NET_WORTH_PERIOD_TAB_LABELS: Record<NetWorthChartPeriod, string> = {
  '1J': '1J',
  '1S': '1S',
  '1M': '1M',
  '3M': '3M',
  '6M': '6M',
  CA: 'CA',
  YTD: 'YTD',
  '1A': '1A',
  '2A': '2A',
  '3A': '3A',
  '5A': '5A',
  '10A': '10A',
  TOUT: 'TOUT',
};

type NetWorthPeriodLabels = Partial<Record<NetWorthChartPeriod, string>>;

const MONTHS_FR = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];

function makeDemoPoints(values: number[], labels?: string[]): NetWorthTrendPoint[] {
  return values.map((value, index) => ({
    label: labels?.[index] ?? MONTHS_FR[index % 12] ?? '',
    value,
  }));
}

const DEMO_1S = makeDemoPoints(
  [21200, 21360, 21205, 20940, 20710, 20980, 21250, 21470],
  ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'AUJ'],
);

const DEMO_1M = makeDemoPoints([
  20600, 20740, 20590, 20820, 21010, 20860, 20690, 20950,
  21180, 21030, 20850, 21100, 21360, 21200, 20980, 21260,
  21520, 21370, 21140, 21390, 21560, 21410, 21350, 21470,
]);

const DEMO_3M = makeDemoPoints([
  19400, 19620, 19480, 19850, 20080, 19840, 20260, 20540,
  20310, 20700, 20980, 20720, 21140, 20890, 21230, 21060,
  21380, 21190, 21420, 21470,
]);

const DEMO_6M = makeDemoPoints([
  18100, 18380, 18220, 18640, 18920, 18680, 19080, 19360,
  19090, 19520, 19840, 19560, 20010, 20350, 20980, 21470,
]);

const DEMO_CA = makeDemoPoints([
  20500, 20260, 20680, 20420, 20890, 20610, 21080, 20830,
  21260, 21040, 21390, 21470,
]);

const DEMO_1A = makeDemoPoints([
  18700, 19080, 18850, 19380, 19820, 19540, 20150, 22200,
  25100, 23200, 21880, 21470,
]);

const DEMO_PERIOD_SERIES: Record<NetWorthChartPeriod, NetWorthTrendPoint[]> = {
  '1J': DEMO_1S.slice(-2),
  '1S': DEMO_1S,
  '1M': DEMO_1M,
  '3M': DEMO_3M,
  '6M': DEMO_6M,
  CA: DEMO_CA,
  YTD: DEMO_CA,
  '1A': DEMO_1A,
  '2A': DEMO_1A,
  '3A': DEMO_1A,
  '5A': DEMO_1A,
  '10A': DEMO_1A,
  TOUT: DEMO_1A,
};

/** Maximum chart points rendered per period (drives demo size and downsampling target). */
const PERIOD_MAX_CHART_POINTS: Record<NetWorthChartPeriod, number> = {
  '1J': 2,
  '1S': 8,
  '1M': 24,
  '3M': 20,
  '6M': 16,
  CA: 12,
  YTD: 12,
  '1A': 12,
  '2A': 16,
  '3A': 18,
  '5A': 20,
  '10A': 24,
  TOUT: 24,
};

/** Raw real-data window (points to slice) before downsampling to PERIOD_MAX_CHART_POINTS. */
const PERIOD_REAL_WINDOW: Record<NetWorthChartPeriod, number> = {
  '1J': 2,
  '1S': 8,
  '1M': 12,
  '3M': 18,
  '6M': 26,
  CA: Infinity,
  YTD: Infinity,
  '1A': Infinity,
  '2A': Infinity,
  '3A': Infinity,
  '5A': Infinity,
  '10A': Infinity,
  TOUT: Infinity,
};

/**
 * LTTB downsampling — preserves peaks/troughs instead of averaging them away.
 * Keeps the visual volatility of stock-style price lines when reducing point count.
 */
function downsampleData(data: NetWorthTrendPoint[], maxPoints: number): NetWorthTrendPoint[] {
  if (data.length <= maxPoints) return data;
  if (maxPoints <= 2) return [data[0], data[data.length - 1]];

  const sampled: NetWorthTrendPoint[] = [data[0]];
  const bucketSize = (data.length - 2) / (maxPoints - 2);
  let anchorIndex = 0;

  for (let bucket = 0; bucket < maxPoints - 2; bucket += 1) {
    const nextBucketStart = Math.floor((bucket + 1) * bucketSize) + 1;
    const nextBucketEnd = Math.min(Math.floor((bucket + 2) * bucketSize) + 1, data.length);
    const nextBucketLength = Math.max(nextBucketEnd - nextBucketStart, 1);

    let avgX = 0;
    let avgY = 0;
    for (let index = nextBucketStart; index < nextBucketEnd; index += 1) {
      avgX += index;
      avgY += data[index].value;
    }
    avgX /= nextBucketLength;
    avgY /= nextBucketLength;

    const rangeStart = Math.floor(bucket * bucketSize) + 1;
    const rangeEnd = Math.floor((bucket + 1) * bucketSize) + 1;
    const anchorX = anchorIndex;
    const anchorY = data[anchorIndex].value;

    let maxArea = -1;
    let maxAreaIndex = rangeStart;
    for (let index = rangeStart; index < rangeEnd; index += 1) {
      const area = Math.abs(
        (anchorX - avgX) * (data[index].value - anchorY) -
          (anchorX - index) * (avgY - anchorY),
      );
      if (area > maxArea) {
        maxArea = area;
        maxAreaIndex = index;
      }
    }

    sampled.push(data[maxAreaIndex]);
    anchorIndex = maxAreaIndex;
  }

  sampled.push(data[data.length - 1]);
  return sampled;
}

function getVisiblePoints(
  points: NetWorthTrendPoint[] | undefined,
  period: NetWorthChartPeriod,
  periodRealWindowOverride?: Partial<Record<NetWorthChartPeriod, number>>,
  periodMaxChartPointsOverride?: Partial<Record<NetWorthChartPeriod, number>>,
): NetWorthTrendPoint[] {
  const safePoints = points ?? [];
  if (safePoints.length === 0) {
    return DEMO_PERIOD_SERIES[period] ?? [];
  }
  const demo = DEMO_PERIOD_SERIES[period];
  const realWindow = periodRealWindowOverride?.[period] ?? PERIOD_REAL_WINDOW[period];
  const maxPoints = periodMaxChartPointsOverride?.[period] ?? PERIOD_MAX_CHART_POINTS[period];
  const windowed = Number.isFinite(realWindow) ? safePoints.slice(-Math.max(realWindow, 2)) : safePoints;
  const chartSource = windowed.length >= 2 ? windowed : safePoints;
  if (chartSource.length >= 2) {
    return downsampleData(chartSource, maxPoints);
  }
  return demo && demo.length > 0 ? demo : safePoints;
}


/** Straight segments with rounded joins — same stock-chart rhythm as SparklineChart / LOC charts. */
function buildStockLinePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  return pts
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

/** Linear resample onto a uniform grid — used to morph between different-length series. */
function resampleValues(values: number[], count: number): number[] {
  if (count <= 0) return [];
  if (values.length === 0) return Array.from({ length: count }, () => 0);
  if (values.length === 1) return Array.from({ length: count }, () => values[0]);
  return Array.from({ length: count }, (_, index) => {
    const ratio = index / Math.max(count - 1, 1);
    const position = ratio * (values.length - 1);
    const lower = Math.floor(position);
    const upper = Math.min(lower + 1, values.length - 1);
    const fraction = position - lower;
    return values[lower] * (1 - fraction) + values[upper] * fraction;
  });
}

type MorphFrame = { d: string; fillD: string; lastX: number; lastY: number };

/** Worklet-safe morph frame — interpolates resampled values and y-domain. */
function computeMorphFrame(
  progress: number,
  fromYs: number[],
  toYs: number[],
  yMinFrom: number,
  yMaxFrom: number,
  yMinTo: number,
  yMaxTo: number,
  plotWidth: number,
  leftInset: number,
): MorphFrame {
  'worklet';
  const safeFrom = fromYs ?? [];
  const safeTo = toYs ?? [];
  const count = Math.max(safeFrom.length, safeTo.length, 0);
  if (count === 0) {
    return { d: '', fillD: '', lastX: leftInset, lastY: CHART_VERTICAL_PADDING };
  }

  const yMin = yMinFrom + progress * (yMinTo - yMinFrom);
  const yMax = yMaxFrom + progress * (yMaxTo - yMaxFrom);
  const range = yMax - yMin;
  const innerHeight = CHART_HEIGHT - CHART_VERTICAL_PADDING * 2;
  const safeRange = range === 0 ? 1 : range;
  const fillBottom = CHART_HEIGHT - CHART_VERTICAL_PADDING;

  let d = '';
  let firstX = leftInset;
  let lastX = leftInset;
  let lastY = CHART_VERTICAL_PADDING;

  for (let index = 0; index < count; index += 1) {
    const fromValue = safeFrom[index] ?? safeFrom[safeFrom.length - 1] ?? 0;
    const toValue = safeTo[index] ?? safeTo[safeTo.length - 1] ?? fromValue;
    const value = fromValue + progress * (toValue - fromValue);
    const x = leftInset + (index / Math.max(count - 1, 1)) * plotWidth;
    const y = CHART_VERTICAL_PADDING + (1 - (value - yMin) / safeRange) * innerHeight;
    if (index === 0) {
      firstX = x;
    }
    d += `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
    lastX = x;
    lastY = y;
  }

  const lineD = d.trim();
  const fillD = lineD
    ? `${lineD} L ${lastX.toFixed(2)} ${fillBottom.toFixed(2)} L ${firstX.toFixed(2)} ${fillBottom.toFixed(2)} Z`
    : '';

  return { d: lineD, fillD, lastX, lastY };
}

function computeYDomain(values: number[]): { yMin: number; yMax: number } {
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const range = dataMax - dataMin;
  if (range === 0) {
    return { yMin: dataMin - 1, yMax: dataMax + 1 };
  }
  return { yMin: dataMin - range * CHART_Y_PADDING_RATIO, yMax: dataMax + range * CHART_Y_PADDING_RATIO };
}

type ChartPoint = { x: number; y: number };

function getChartPlotMetrics(
  chartWidth: number,
  leftInset = CHART_HORIZONTAL_INSET,
  rightInset = leftInset,
) {
  const plotWidth = Math.max(chartWidth - leftInset - rightInset, 1);
  return { plotWidth, leftInset };
}

function buildChartPaths(
  values: number[],
  chartWidth: number,
  leftInset = CHART_HORIZONTAL_INSET,
  rightInset = leftInset,
) {
  const { yMin, yMax } = computeYDomain(values);
  const range = yMax - yMin;
  const innerHeight = CHART_HEIGHT - CHART_VERTICAL_PADDING * 2;
  const { plotWidth, leftInset: plotLeftInset } = getChartPlotMetrics(chartWidth, leftInset, rightInset);
  const pts: ChartPoint[] = values.map((value, index) => {
    const x = plotLeftInset + (index / Math.max(values.length - 1, 1)) * plotWidth;
    const y = CHART_VERTICAL_PADDING + (1 - (value - yMin) / range) * innerHeight;
    return { x, y };
  });
  const linePath = buildStockLinePath(pts);
  return { points: pts, linePath };
}

/** Map touch x (0..chartWidth) to point index; aligned with [leftInset, leftInset + plotWidth] x range. */
function findPointIndexFromX(
  touchX: number,
  chartWidth: number,
  pointCount: number,
  leftInset = CHART_HORIZONTAL_INSET,
  rightInset = leftInset,
): number {
  if (pointCount <= 1) return 0;
  const { plotWidth, leftInset: plotLeftInset } = getChartPlotMetrics(chartWidth, leftInset, rightInset);
  const clampedX = Math.max(plotLeftInset, Math.min(plotLeftInset + plotWidth, touchX));
  const ratio = (clampedX - plotLeftInset) / plotWidth;
  return Math.round(ratio * (pointCount - 1));
}

/** Snap x to nearest chart index; null when that index is today (last point). */
function resolveHistoricalSelectionIndex(
  touchX: number,
  chartWidth: number,
  pointCount: number,
  lastIndex: number,
  leftInset = CHART_HORIZONTAL_INSET,
  rightInset = leftInset,
): number | null {
  const nearestIndex = findPointIndexFromX(touchX, chartWidth, pointCount, leftInset, rightInset);
  return nearestIndex === lastIndex ? null : nearestIndex;
}

function clampChartTouchX(touchX: number, chartWidth: number): number {
  return Math.max(0, Math.min(chartWidth, touchX));
}

/** Claim scrub only when the finger clearly moves sideways — vertical stays with ScrollView. */
const SCRUB_ACTIVATION_DX = 8;

function isHorizontalScrubGesture(dx: number, dy: number): boolean {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return ax >= SCRUB_ACTIVATION_DX && ax > ay;
}

function getChartTouchXAtGrant(event: GestureResponderEvent, framePageX: number): number {
  const { locationX } = event.nativeEvent;
  if (typeof locationX === 'number' && Number.isFinite(locationX)) {
    return locationX;
  }
  return getChartTouchX(event, framePageX);
}

function getChartTouchX(event: GestureResponderEvent, framePageX: number): number {
  const { pageX } = event.nativeEvent;
  if (typeof pageX === 'number' && Number.isFinite(pageX)) {
    return pageX - framePageX;
  }
  const { locationX } = event.nativeEvent;
  if (typeof locationX === 'number' && Number.isFinite(locationX)) {
    return locationX;
  }
  const offsetX = (event.nativeEvent as { offsetX?: number }).offsetX;
  if (typeof offsetX === 'number' && Number.isFinite(offsetX)) {
    return offsetX;
  }
  return 0;
}

function formatChartPointAmount(value: number): string {
  const sign = value < 0 ? '−' : '';
  const { main } = formatDisplayMoney(value);
  return `${sign}${main} $`;
}

function computeSelectionLabelPosition(
  pointX: number,
  chartWidth: number,
  labelText: string,
): { x: number; textAnchor: 'start' | 'end' } {
  const estimatedWidth = labelText.length * POINT_LABEL_CHAR_WIDTH;
  const chartMid = chartWidth / 2;

  let placeOnRight = pointX < chartMid;

  if (placeOnRight && pointX + POINT_LABEL_OFFSET + estimatedWidth > chartWidth) {
    placeOnRight = false;
  } else if (!placeOnRight && pointX - POINT_LABEL_OFFSET - estimatedWidth < 0) {
    placeOnRight = true;
  }

  return placeOnRight
    ? { x: pointX + POINT_LABEL_OFFSET, textAnchor: 'start' }
    : { x: pointX - POINT_LABEL_OFFSET, textAnchor: 'end' };
}

export const ALL_NET_WORTH_CHART_PERIODS: NetWorthChartPeriod[] = ['1S', '1M', '3M', '6M', 'CA', '1A'];
export const PATRIMOINE_NET_WORTH_CHART_PERIODS: NetWorthChartPeriod[] = [
  '1J',
  '1S',
  '1M',
  '3M',
  '1A',
  '5A',
  '10A',
];
export const PATRIMOINE_NET_WORTH_PERIOD_LABELS: NetWorthPeriodLabels = {
  '1J': '1J',
  '1S': '1S',
  '1M': '1M',
  '3M': '3M',
  '1A': '1A',
  '5A': '5A',
  '10A': '10A',
};

/** Subtle halo breathe + expanding ripple on the in-progress endpoint. */
function AnimatedEndpointDot({
  morphProgress,
  morphFromYs,
  morphToYs,
  morphFromYMin,
  morphFromYMax,
  morphToYMin,
  morphToYMax,
  morphPlotWidth,
  morphLeftInset,
  lineColor,
}: {
  morphProgress: SharedValue<number>;
  morphFromYs: SharedValue<number[]>;
  morphToYs: SharedValue<number[]>;
  morphFromYMin: SharedValue<number>;
  morphFromYMax: SharedValue<number>;
  morphToYMin: SharedValue<number>;
  morphToYMax: SharedValue<number>;
  morphPlotWidth: SharedValue<number>;
  morphLeftInset: SharedValue<number>;
  lineColor: string;
}) {
  const breathe = useSharedValue(0);
  const ripple = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: ENDPOINT_HALO_BREATHE_MS,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(0, {
          duration: ENDPOINT_HALO_BREATHE_MS,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );
    ripple.value = withRepeat(
      withTiming(1, { duration: ENDPOINT_RIPPLE_MS, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(breathe);
      cancelAnimation(ripple);
    };
  }, [breathe, ripple]);

  const endpointPosition = useDerivedValue(() => {
    const frame = computeMorphFrame(
      morphProgress.value,
      morphFromYs.value,
      morphToYs.value,
      morphFromYMin.value,
      morphFromYMax.value,
      morphToYMin.value,
      morphToYMax.value,
      morphPlotWidth.value,
      morphLeftInset.value,
    );
    return { x: frame.lastX, y: frame.lastY };
  });

  const haloAnimatedProps = useAnimatedProps(() => ({
    cx: endpointPosition.value.x,
    cy: endpointPosition.value.y,
    opacity: 0.14 + breathe.value * 0.1,
    r: ENDPOINT_DOT_HALO_R + breathe.value * 0.5,
  }));

  const rippleAnimatedProps = useAnimatedProps(() => ({
    cx: endpointPosition.value.x,
    cy: endpointPosition.value.y,
    opacity: (1 - ripple.value) * 0.18,
    r: ENDPOINT_DOT_HALO_R + ripple.value * ENDPOINT_RIPPLE_EXPAND,
  }));

  const coreAnimatedProps = useAnimatedProps(() => ({
    cx: endpointPosition.value.x,
    cy: endpointPosition.value.y,
  }));

  return (
    <>
      <AnimatedCircle fill={lineColor} animatedProps={rippleAnimatedProps} />
      <AnimatedCircle fill={lineColor} animatedProps={haloAnimatedProps} />
      <AnimatedCircle r={ENDPOINT_DOT_R} fill={lineColor} animatedProps={coreAnimatedProps} />
    </>
  );
}

function syncMorphTargets(
  values: number[],
  chartWidth: number,
  leftInset: number,
  rightInset: number,
  morphFromYs: SharedValue<number[]>,
  morphToYs: SharedValue<number[]>,
  morphFromYMin: SharedValue<number>,
  morphFromYMax: SharedValue<number>,
  morphToYMin: SharedValue<number>,
  morphToYMax: SharedValue<number>,
  morphPlotWidth: SharedValue<number>,
  morphLeftInset: SharedValue<number>,
) {
  const resampled = resampleValues(values, MORPH_SAMPLE_COUNT);
  morphFromYs.value = resampled;
  morphToYs.value = resampled;
  const domain = computeYDomain(values);
  morphFromYMin.value = domain.yMin;
  morphFromYMax.value = domain.yMax;
  morphToYMin.value = domain.yMin;
  morphToYMax.value = domain.yMax;
  const plotWidth = Math.max(chartWidth - leftInset - rightInset, 1);
  morphPlotWidth.value = plotWidth;
  morphLeftInset.value = leftInset;
}

/** Animated area fill under the stock line — morphs with period transitions. */
function MorphingChartAreaFill({
  morphProgress,
  morphFromYs,
  morphToYs,
  morphFromYMin,
  morphFromYMax,
  morphToYMin,
  morphToYMax,
  morphPlotWidth,
  morphLeftInset,
  lineColor,
  fillGradId,
}: {
  morphProgress: SharedValue<number>;
  morphFromYs: SharedValue<number[]>;
  morphToYs: SharedValue<number[]>;
  morphFromYMin: SharedValue<number>;
  morphFromYMax: SharedValue<number>;
  morphToYMin: SharedValue<number>;
  morphToYMax: SharedValue<number>;
  morphPlotWidth: SharedValue<number>;
  morphLeftInset: SharedValue<number>;
  lineColor: string;
  fillGradId: string;
}) {
  const areaAnimatedProps = useAnimatedProps(() => {
    const frame = computeMorphFrame(
      morphProgress.value,
      morphFromYs.value,
      morphToYs.value,
      morphFromYMin.value,
      morphFromYMax.value,
      morphToYMin.value,
      morphToYMax.value,
      morphPlotWidth.value,
      morphLeftInset.value,
    );
    return { d: frame.fillD };
  });

  return (
    <>
      <Defs>
        <LinearGradient id={fillGradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={lineColor} stopOpacity={AREA_FILL_TOP_OPACITY} />
          <Stop offset="0.4" stopColor={lineColor} stopOpacity={AREA_FILL_MID_OPACITY} />
          <Stop offset="1" stopColor={lineColor} stopOpacity={AREA_FILL_BOTTOM_OPACITY} />
        </LinearGradient>
      </Defs>
      <AnimatedPath animatedProps={areaAnimatedProps} fill={`url(#${fillGradId})`} />
    </>
  );
}

/** Animated stock line + endpoint driven by shared morph state. */
function MorphingChartLine({
  morphProgress,
  morphFromYs,
  morphToYs,
  morphFromYMin,
  morphFromYMax,
  morphToYMin,
  morphToYMax,
  morphPlotWidth,
  morphLeftInset,
  lineColor,
  showEndpointDot,
}: {
  morphProgress: SharedValue<number>;
  morphFromYs: SharedValue<number[]>;
  morphToYs: SharedValue<number[]>;
  morphFromYMin: SharedValue<number>;
  morphFromYMax: SharedValue<number>;
  morphToYMin: SharedValue<number>;
  morphToYMax: SharedValue<number>;
  morphPlotWidth: SharedValue<number>;
  morphLeftInset: SharedValue<number>;
  lineColor: string;
  showEndpointDot: boolean;
}) {
  const lineAnimatedProps = useAnimatedProps(() => {
    const frame = computeMorphFrame(
      morphProgress.value,
      morphFromYs.value,
      morphToYs.value,
      morphFromYMin.value,
      morphFromYMax.value,
      morphToYMin.value,
      morphToYMax.value,
      morphPlotWidth.value,
      morphLeftInset.value,
    );
    return { d: frame.d };
  });

  return (
    <>
      <AnimatedPath
        animatedProps={lineAnimatedProps}
        fill="none"
        stroke={lineColor}
        strokeWidth={CHART_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showEndpointDot ? (
        <AnimatedEndpointDot
          morphProgress={morphProgress}
          morphFromYs={morphFromYs}
          morphToYs={morphToYs}
          morphFromYMin={morphFromYMin}
          morphFromYMax={morphFromYMax}
          morphToYMin={morphToYMin}
          morphToYMax={morphToYMax}
          morphPlotWidth={morphPlotWidth}
          morphLeftInset={morphLeftInset}
          lineColor={lineColor}
        />
      ) : null}
    </>
  );
}

function ChartPeriodSelector({
  active,
  onChange,
  allowedPeriods = ALL_NET_WORTH_CHART_PERIODS,
  periodLabels,
}: {
  active: NetWorthChartPeriod;
  onChange: (period: NetWorthChartPeriod) => void;
  allowedPeriods?: NetWorthChartPeriod[];
  periodLabels?: NetWorthPeriodLabels;
}) {
  const tabs = allowedPeriods.map((period) => ({
    id: period,
    label: periodLabels?.[period] ?? NET_WORTH_PERIOD_TAB_LABELS[period],
  }));

  return (
    <ThemeSegmentedControl
      tabs={tabs}
      active={active}
      onChange={onChange}
      showDivider={false}
      size="sm"
      variant="section"
      trackBgColor="transparent"
    />
  );
}

export type PortfolioChartCardHandle = {
  clearSelection: () => void;
};

export type PortfolioChartCardPeriodData = {
  period: NetWorthChartPeriod;
  /** Value at the selected chart point (defaults to the latest point). */
  currentValue: number;
  delta: number;
  deltaPercent: number;
  selectedIndex: number;
  selectedLabel: string;
  /** True while the user is actively scrubbing (finger/mouse down on chart). */
  isScrubbing: boolean;
};

export const PortfolioChartCard = forwardRef<
  PortfolioChartCardHandle,
  {
    points: NetWorthTrendPoint[];
    onPeriodData?: (data: PortfolioChartCardPeriodData) => void;
    /** Stroke color; defaults to portfolio green. */
    lineColor?: string;
    /** Period tabs to show; defaults to all periods including 1S. */
    allowedPeriods?: NetWorthChartPeriod[];
    /** Optional period tab labels keyed by period id. */
    periodLabels?: NetWorthPeriodLabels;
    /** Plot inset from chart frame edges; use 0 with full-bleed wrapper for screen-edge margin. */
    plotHorizontalInset?: number;
    /** Right plot inset; defaults to plotHorizontalInset. Use with plotHorizontalInset=0 for edge bleed. */
    plotHorizontalInsetRight?: number;
    /** Optional per-period real-data window (tail slice) override. */
    periodRealWindowOverride?: Partial<Record<NetWorthChartPeriod, number>>;
    /** Optional per-period max chart point override after downsampling. */
    periodMaxChartPointsOverride?: Partial<Record<NetWorthChartPeriod, number>>;
    /** When set, resolves chart points per period instead of slicing `points`. */
    getChartPoints?: (period: NetWorthChartPeriod) => NetWorthTrendPoint[];
    /** Initial period tab; defaults to 1M when allowed, else first tab. */
    initialPeriod?: NetWorthChartPeriod;
    /** Formats the scrub badge value; defaults to portfolio currency. */
    formatScrubValue?: (value: number) => string;
    /** `persist` keeps crosshair after release (portfolio). `release` clears on lift (stock detail). */
    selectionPersistence?: 'persist' | 'release';
    /** Show point label (e.g. intraday time) under the scrub price badge for these periods. */
    scrubTimePeriods?: NetWorthChartPeriod[];
    /** Soft gradient fill under the line (default on — matches portefeuille/cashflow). */
    showAreaFill?: boolean;
  }
>(function PortfolioChartCard(
  {
    points,
    onPeriodData,
    lineColor = CHART_LINE,
    allowedPeriods = ALL_NET_WORTH_CHART_PERIODS,
    periodLabels,
    plotHorizontalInset = CHART_HORIZONTAL_INSET,
    plotHorizontalInsetRight = plotHorizontalInset,
    periodRealWindowOverride,
    periodMaxChartPointsOverride,
    getChartPoints,
    initialPeriod,
    formatScrubValue,
    selectionPersistence = 'persist',
    scrubTimePeriods = [],
    showAreaFill = true,
  },
  ref,
) {
  const { colors } = useAppTheme();
  const areaFillGradId = useId().replace(/:/g, '');
  const [chartPeriod, setChartPeriod] = useState<NetWorthChartPeriod>(() => {
    if (initialPeriod && allowedPeriods.includes(initialPeriod)) return initialPeriod;
    return allowedPeriods.includes('1M') ? '1M' : (allowedPeriods[0] ?? ALL_NET_WORTH_CHART_PERIODS[0]);
  });
  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [scrubActive, setScrubActive] = useState(false);
  const chartFrameRef = useRef<View>(null);
  const chartFramePageXRef = useRef(0);
  const scrubAnchorChartXRef = useRef(0);
  const isWebDraggingRef = useRef(false);
  const webScrubActivatedRef = useRef(false);
  const webPointerDownClientRef = useRef({ x: 0, y: 0 });
  const onPeriodDataRef = useRef(onPeriodData);
  onPeriodDataRef.current = onPeriodData;
  const lastPeriodDataRef = useRef<PortfolioChartCardPeriodData | null>(null);
  const morphProgress = useSharedValue(1);
  const morphFromYs = useSharedValue<number[]>([]);
  const morphToYs = useSharedValue<number[]>([]);
  const morphFromYMin = useSharedValue(0);
  const morphFromYMax = useSharedValue(1);
  const morphToYMin = useSharedValue(0);
  const morphToYMax = useSharedValue(1);
  const morphPlotWidth = useSharedValue(0);
  const morphLeftInset = useSharedValue(plotHorizontalInset);
  const prevChartPeriodRef = useRef<NetWorthChartPeriod | null>(null);
  const prevValuesRef = useRef<number[]>([]);
  const prevLayoutRef = useRef({
    chartWidth: 0,
    plotHorizontalInset,
    plotHorizontalInsetRight,
  });

  const clearSelection = useCallback(() => {
    setScrubActive(false);
    setSelectedIndex(null);
  }, []);

  useImperativeHandle(ref, () => ({ clearSelection }), [clearSelection]);

  const measureChartFrame = useCallback(() => {
    chartFrameRef.current?.measureInWindow((pageX) => {
      if (Number.isFinite(pageX)) {
        chartFramePageXRef.current = pageX;
      }
    });
  }, []);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      setContainerWidth(nextWidth);
    }
  }, []);

  const chartWidth = Math.max(containerWidth, 0);
  const visiblePoints = useMemo(
    () =>
      getChartPoints
        ? getChartPoints(chartPeriod)
        : getVisiblePoints(
            points,
            chartPeriod,
            periodRealWindowOverride,
            periodMaxChartPointsOverride,
          ),
    [chartPeriod, getChartPoints, periodMaxChartPointsOverride, periodRealWindowOverride, points],
  );
  const values = useMemo(() => visiblePoints.map((point) => point.value), [visiblePoints]);
  const chart = useMemo(
    () => buildChartPaths(values, chartWidth, plotHorizontalInset, plotHorizontalInsetRight),
    [values, chartWidth, plotHorizontalInset, plotHorizontalInsetRight],
  );
  const lastIndex = Math.max(values.length - 1, 0);
  const isScrubbing =
    scrubActive && selectedIndex !== null && selectedIndex !== lastIndex;
  const displayIndex =
    selectionPersistence === 'release'
      ? isScrubbing
        ? selectedIndex!
        : lastIndex
      : selectedIndex ?? lastIndex;
  const clampedDisplayIndex = Math.min(Math.max(displayIndex, 0), lastIndex);
  const displayValue = values[clampedDisplayIndex] ?? values[lastIndex] ?? 0;
  const displayLabel = visiblePoints[clampedDisplayIndex]?.label ?? '';
  const firstValue = values[0] ?? displayValue;
  const delta = displayValue - firstValue;
  const deltaBase = Math.abs(firstValue) >= 1 ? Math.abs(firstValue) : Math.abs(displayValue - delta) >= 1
    ? Math.abs(displayValue - delta)
    : Math.abs(displayValue) >= 1
      ? Math.abs(displayValue)
      : 1;
  const deltaPercent = (delta / deltaBase) * 100;
  const showSelectionVisuals = isScrubbing;
  const selectionPoint = showSelectionVisuals ? chart.points[selectedIndex!] : null;
  const showEndpointDot = Boolean(!showSelectionVisuals && values.length > 0);
  const formatScrubLabel = formatScrubValue ?? formatChartPointAmount;
  const selectionAmountLabel = showSelectionVisuals
    ? formatScrubLabel(values[selectedIndex] ?? 0)
    : '';
  const selectionTimeLabel =
    showSelectionVisuals && scrubTimePeriods.includes(chartPeriod)
      ? visiblePoints[selectedIndex ?? 0]?.label ?? ''
      : '';
  const selectionBadgePrimary = selectionAmountLabel;
  const selectionLabelPosition = useMemo(() => {
    if (!selectionPoint || !selectionBadgePrimary || chartWidth <= 0) return null;
    return computeSelectionLabelPosition(selectionPoint.x, chartWidth, selectionBadgePrimary);
  }, [chartWidth, selectionBadgePrimary, selectionPoint]);

  useEffect(() => {
    if (chartWidth <= 0 || values.length === 0) return;

    const prevPeriod = prevChartPeriodRef.current;
    const prevValues = prevValuesRef.current;
    const prevLayout = prevLayoutRef.current;
    const periodChanged = prevPeriod !== null && prevPeriod !== chartPeriod;
    const valuesChangedWithoutPeriod =
      prevPeriod === chartPeriod && prevValues.length > 0 && prevValues !== values;
    const layoutChanged =
      prevPeriod !== null &&
      (prevLayout.chartWidth !== chartWidth ||
        prevLayout.plotHorizontalInset !== plotHorizontalInset ||
        prevLayout.plotHorizontalInsetRight !== plotHorizontalInsetRight);

    if (prevPeriod === null) {
      syncMorphTargets(
        values,
        chartWidth,
        plotHorizontalInset,
        plotHorizontalInsetRight,
        morphFromYs,
        morphToYs,
        morphFromYMin,
        morphFromYMax,
        morphToYMin,
        morphToYMax,
        morphPlotWidth,
        morphLeftInset,
      );
      morphProgress.value = 1;
    } else if (periodChanged) {
      const fromResampled = resampleValues(prevValues, MORPH_SAMPLE_COUNT);
      const toResampled = resampleValues(values, MORPH_SAMPLE_COUNT);
      const fromDomain = computeYDomain(prevValues);
      const toDomain = computeYDomain(values);
      morphFromYs.value = fromResampled;
      morphToYs.value = toResampled;
      morphFromYMin.value = fromDomain.yMin;
      morphFromYMax.value = fromDomain.yMax;
      morphToYMin.value = toDomain.yMin;
      morphToYMax.value = toDomain.yMax;
      morphPlotWidth.value = Math.max(
        chartWidth - plotHorizontalInset - plotHorizontalInsetRight,
        1,
      );
      morphLeftInset.value = plotHorizontalInset;

      cancelAnimation(morphProgress);
      morphProgress.value = 0;
      morphProgress.value = withTiming(1, {
        duration: MORPH_DURATION_MS,
        easing: MORPH_EASING,
      });
    } else if (valuesChangedWithoutPeriod) {
      syncMorphTargets(
        values,
        chartWidth,
        plotHorizontalInset,
        plotHorizontalInsetRight,
        morphFromYs,
        morphToYs,
        morphFromYMin,
        morphFromYMax,
        morphToYMin,
        morphToYMax,
        morphPlotWidth,
        morphLeftInset,
      );
      morphProgress.value = 1;
    } else if (layoutChanged) {
      syncMorphTargets(
        values,
        chartWidth,
        plotHorizontalInset,
        plotHorizontalInsetRight,
        morphFromYs,
        morphToYs,
        morphFromYMin,
        morphFromYMax,
        morphToYMin,
        morphToYMax,
        morphPlotWidth,
        morphLeftInset,
      );
    }

    prevChartPeriodRef.current = chartPeriod;
    prevValuesRef.current = values;
    prevLayoutRef.current = {
      chartWidth,
      plotHorizontalInset,
      plotHorizontalInsetRight,
    };
  }, [
    chartPeriod,
    chartWidth,
    morphFromYMax,
    morphFromYMin,
    morphFromYs,
    morphLeftInset,
    morphPlotWidth,
    morphProgress,
    morphToYMax,
    morphToYMin,
    morphToYs,
    plotHorizontalInset,
    plotHorizontalInsetRight,
    values,
  ]);

  useEffect(() => {
    lastPeriodDataRef.current = null;
  }, [points]);

  useEffect(() => {
    setSelectedIndex(null);
  }, [chartPeriod]);

  useEffect(() => {
    if (allowedPeriods.length === 0) return;
    if (!allowedPeriods.includes(chartPeriod)) {
      setChartPeriod(allowedPeriods.includes('1M') ? '1M' : allowedPeriods[0]);
    }
  }, [allowedPeriods, chartPeriod]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSelectedIndex(null);
      };
    }, []),
  );

  useEffect(() => {
    setSelectedIndex(null);
  }, [chartPeriod]);

  const clearSelectionAfterScrub = selectionPersistence === 'release';

  const updateSelectionFromX = useCallback(
    (touchX: number) => {
      if (chartWidth <= 0 || values.length === 0) return;
      const nextIndex = resolveHistoricalSelectionIndex(
        touchX,
        chartWidth,
        values.length,
        lastIndex,
        plotHorizontalInset,
        plotHorizontalInsetRight,
      );
      setSelectedIndex((current) => (current === nextIndex ? current : nextIndex));
    },
    [chartWidth, lastIndex, plotHorizontalInset, plotHorizontalInsetRight, values.length],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Never claim on touch-down — otherwise vertical page scroll is stolen by the scrubber.
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          isHorizontalScrubGesture(gestureState.dx, gestureState.dy),
        onMoveShouldSetPanResponderCapture: (_event, gestureState) =>
          isHorizontalScrubGesture(gestureState.dx, gestureState.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event, gestureState) => {
          setScrubActive(true);
          measureChartFrame();
          const currentX = clampChartTouchX(
            getChartTouchXAtGrant(event, chartFramePageXRef.current),
            chartWidth,
          );
          // Recover touch-start X: grant can fire after dx already accumulated.
          scrubAnchorChartXRef.current = currentX - gestureState.dx;
          updateSelectionFromX(currentX);
        },
        onPanResponderMove: (_event, gestureState) => {
          const touchX = clampChartTouchX(scrubAnchorChartXRef.current + gestureState.dx, chartWidth);
          updateSelectionFromX(touchX);
        },
        onPanResponderRelease: (_event, gestureState) => {
          setScrubActive(false);
          if (clearSelectionAfterScrub) {
            setSelectedIndex(null);
            return;
          }
          const touchX = clampChartTouchX(scrubAnchorChartXRef.current + gestureState.dx, chartWidth);
          updateSelectionFromX(touchX);
        },
        onPanResponderTerminate: () => {
          setScrubActive(false);
          setSelectedIndex(null);
        },
      }),
    [chartWidth, clearSelectionAfterScrub, measureChartFrame, updateSelectionFromX],
  );

  const handleWebMouseDown = useCallback(
    (event: GestureResponderEvent) => {
      const native = event.nativeEvent as GestureResponderEvent['nativeEvent'] & {
        clientX?: number;
        clientY?: number;
      };
      const frame = chartFrameRef.current as unknown as HTMLElement | null;
      const rect = frame?.getBoundingClientRect?.();
      const clientX =
        typeof native.clientX === 'number'
          ? native.clientX
          : typeof native.pageX === 'number'
            ? native.pageX
            : rect
              ? rect.left + (native.locationX ?? 0)
              : 0;
      const clientY =
        typeof native.clientY === 'number'
          ? native.clientY
          : typeof native.pageY === 'number'
            ? native.pageY
            : rect
              ? rect.top + (native.locationY ?? 0)
              : 0;
      isWebDraggingRef.current = true;
      webScrubActivatedRef.current = false;
      webPointerDownClientRef.current = { x: clientX, y: clientY };
      measureChartFrame();
      scrubAnchorChartXRef.current = clampChartTouchX(
        getChartTouchXAtGrant(event, chartFramePageXRef.current),
        chartWidth,
      );
    },
    [chartWidth, measureChartFrame],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleWindowMouseMove = (event: MouseEvent) => {
      if (!isWebDraggingRef.current || chartWidth <= 0) return;
      const frame = chartFrameRef.current as unknown as HTMLElement | null;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      const dx = event.clientX - webPointerDownClientRef.current.x;
      const dy = event.clientY - webPointerDownClientRef.current.y;

      if (!webScrubActivatedRef.current) {
        if (!isHorizontalScrubGesture(dx, dy)) {
          // Clearly vertical — abandon scrub so the page can scroll.
          if (Math.abs(dy) >= SCRUB_ACTIVATION_DX && Math.abs(dy) > Math.abs(dx)) {
            isWebDraggingRef.current = false;
            webScrubActivatedRef.current = false;
            setScrubActive(false);
            setSelectedIndex(null);
          }
          return;
        }
        webScrubActivatedRef.current = true;
        setScrubActive(true);
      }

      const touchX = clampChartTouchX(event.clientX - rect.left, chartWidth);
      updateSelectionFromX(touchX);
    };

    const handleWindowMouseUp = (event: MouseEvent) => {
      if (!isWebDraggingRef.current) return;
      const didScrub = webScrubActivatedRef.current;
      isWebDraggingRef.current = false;
      webScrubActivatedRef.current = false;
      setScrubActive(false);
      if (!didScrub) return;
      if (clearSelectionAfterScrub) {
        setSelectedIndex(null);
        return;
      }
      const frame = chartFrameRef.current as unknown as HTMLElement | null;
      if (!frame || chartWidth <= 0) return;
      const rect = frame.getBoundingClientRect();
      const touchX = clampChartTouchX(event.clientX - rect.left, chartWidth);
      updateSelectionFromX(touchX);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [chartWidth, clearSelectionAfterScrub, updateSelectionFromX]);

  useEffect(() => {
    const next: PortfolioChartCardPeriodData = {
      period: chartPeriod,
      currentValue: displayValue,
      delta,
      deltaPercent,
      selectedIndex: clampedDisplayIndex,
      selectedLabel: displayLabel,
      isScrubbing,
    };
    const prev = lastPeriodDataRef.current;
    if (
      prev &&
      prev.period === next.period &&
      prev.currentValue === next.currentValue &&
      prev.delta === next.delta &&
      prev.deltaPercent === next.deltaPercent &&
      prev.selectedIndex === next.selectedIndex &&
      prev.selectedLabel === next.selectedLabel &&
      prev.isScrubbing === next.isScrubbing
    ) {
      return;
    }
    lastPeriodDataRef.current = next;
    onPeriodDataRef.current?.(next);
  }, [chartPeriod, displayValue, delta, deltaPercent, clampedDisplayIndex, displayLabel, isScrubbing]);

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      {containerWidth > 0 ? (
        <View style={styles.card}>
          <View style={styles.chartArea}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={clearSelection}
              accessibilityRole="none"
              accessibilityLabel="Effacer la sélection du graphique"
            />
            <View
              ref={chartFrameRef}
              onLayout={measureChartFrame}
              accessibilityRole="adjustable"
              accessibilityLabel="Graphique interactif"
              accessibilityHint="Appuyez ou glissez sur le graphique pour voir une valeur historique"
              {...panResponder.panHandlers}
              {...(Platform.OS === 'web'
                ? {
                    onMouseDown: handleWebMouseDown,
                  }
                : null)}
              style={[
                styles.chartFrame,
                {
                  width: chartWidth,
                  height: CHART_HEIGHT,
                  backgroundColor: 'transparent',
                  // Let vertical browser/OS scrolling win; scrub still activates on horizontal drag.
                  ...(Platform.OS === 'web' ? { touchAction: 'pan-y' as const } : null),
                },
              ]}
            >
              <Svg
                width={chartWidth + SVG_DOT_OVERFLOW * 2}
                height={CHART_HEIGHT + SVG_DOT_OVERFLOW * 2}
                viewBox={`${-SVG_DOT_OVERFLOW} ${-SVG_DOT_OVERFLOW} ${chartWidth + SVG_DOT_OVERFLOW * 2} ${CHART_HEIGHT + SVG_DOT_OVERFLOW * 2}`}
                style={{ marginLeft: -SVG_DOT_OVERFLOW, marginTop: -SVG_DOT_OVERFLOW }}
              >
                {showAreaFill ? (
                  <MorphingChartAreaFill
                    morphProgress={morphProgress}
                    morphFromYs={morphFromYs}
                    morphToYs={morphToYs}
                    morphFromYMin={morphFromYMin}
                    morphFromYMax={morphFromYMax}
                    morphToYMin={morphToYMin}
                    morphToYMax={morphToYMax}
                    morphPlotWidth={morphPlotWidth}
                    morphLeftInset={morphLeftInset}
                    lineColor={lineColor}
                    fillGradId={areaFillGradId}
                  />
                ) : null}
                <MorphingChartLine
                  morphProgress={morphProgress}
                  morphFromYs={morphFromYs}
                  morphToYs={morphToYs}
                  morphFromYMin={morphFromYMin}
                  morphFromYMax={morphFromYMax}
                  morphToYMin={morphToYMin}
                  morphToYMax={morphToYMax}
                  morphPlotWidth={morphPlotWidth}
                  morphLeftInset={morphLeftInset}
                  lineColor={lineColor}
                  showEndpointDot={showEndpointDot}
                />
                {selectionPoint ? (
                  <Line
                    x1={selectionPoint.x}
                    y1={0}
                    x2={selectionPoint.x}
                    y2={CHART_HEIGHT}
                    stroke={CROSSHAIR_COLOR}
                    strokeWidth={CROSSHAIR_WIDTH}
                  />
                ) : null}
                {selectionPoint ? (
                  <Circle cx={selectionPoint.x} cy={selectionPoint.y} r={SELECTION_DOT_R} fill={lineColor} />
                ) : null}
              </Svg>
              {showSelectionVisuals && selectionPoint && selectionLabelPosition ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.selectionAmountBadge,
                    {
                      backgroundColor: colors.containerBackground,
                      borderColor: colors.containerBorder,
                      top: 2,
                      ...(selectionLabelPosition.textAnchor === 'start'
                        ? {
                            left:
                              selectionPoint.x + POINT_LABEL_OFFSET - POINT_LABEL_PAD_H,
                          }
                        : {
                            right:
                              chartWidth -
                              selectionPoint.x +
                              POINT_LABEL_OFFSET -
                              POINT_LABEL_PAD_H,
                          }),
                    },
                  ]}
                >
                  <Text style={[styles.selectionAmountText, { color: colors.text }]}>
                    {selectionBadgePrimary}
                  </Text>
                  {selectionTimeLabel ? (
                    <Text style={[styles.selectionTimeText, { color: colors.textMuted }]}>
                      {selectionTimeLabel}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
          <Pressable
            onPress={clearSelection}
            style={styles.periodSelectorRow}
            accessibilityRole="none"
            accessibilityLabel="Effacer la sélection du graphique"
          >
            <ChartPeriodSelector
              active={chartPeriod}
              onChange={setChartPeriod}
              allowedPeriods={allowedPeriods}
              periodLabels={periodLabels}
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
    width: '100%',
  },
  card: {
    width: '100%',
  },
  periodSelectorRow: {
    marginTop: 12,
  },
  chartArea: {
    width: '100%',
    height: CHART_HEIGHT,
    position: 'relative',
  },
  chartFrame: {
    alignSelf: 'center',
    overflow: 'visible',
    position: 'relative',
  },
  selectionAmountBadge: {
    position: 'absolute',
    paddingHorizontal: POINT_LABEL_PAD_H,
    paddingVertical: POINT_LABEL_PAD_V,
    borderRadius: 999,
    borderWidth: 1,
  },
  selectionAmountText: {
    ...moneyAmountTypography({
      tier: 'row',
      fontSize: POINT_LABEL_FONT_SIZE,
      lineHeight: POINT_LABEL_FONT_SIZE + 2,
    }),
  },
  selectionTimeText: {
    ...jakartaMediumText,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
    textAlign: 'center',
  },
});

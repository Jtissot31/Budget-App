/**
 * Wealthsimple-inspired cumulative step-area chart for Analyse dépenses.
 * Compares selected period (blue) vs prior period (white, full curve).
 * Scrub horizontally to read cumulative spend at a bucket (day / month).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { COLORS } from '@/constants/design-tokens';
import {
  moneyAmountTypography,
  spacing,
  typographyKit,
} from '@/constants/theme';
import {
  monthSpendProgressSeries,
  sharedSpendChartYMax,
  type SpendTrendGranularity,
} from '@/lib/buildMonthSpendSeries';
import { formatDisplayMoney } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

const CHART_H = 128;
const LINE_W = 2.5;
const PRIOR_LINE_W = 2;
const CORNER_R = 5;
const PAD_X = 8;
const PAD_TOP = 6;
const PAD_BOTTOM = 4;
/** Matches Accueil Dépenses sparkline end marker, slightly larger on the hero chart. */
const ENDPOINT_R = 3.5;

type Props = {
  /** Selected-period cumulative totals. */
  series: number[];
  /** Prior-period cumulative, aligned to `series` length. */
  comparisonSeries: number[];
  /** Period total (usually last real cumulative value). */
  periodTotal: number;
  /** Index of “today” / last active bucket — default scrub + progress endpoint. */
  activeIndex: number;
  /** Optional budget ceiling for thin comparison line (month view). */
  budgetLimit?: number;
  /** Week / month / year copy for French labels. */
  granularity?: SpendTrendGranularity;
  /** Scrub hint for a series index (e.g. « Lun 12 », « Jour 3 », « Mars »). */
  getScrubLabel?: (index: number) => string;
  /** e.g. « Mois dernier » / « Semaine dernière » / « Année dernière » */
  priorPeriodPhrase?: string;
};

function formatMoneyFr(value: number): string {
  const { main, appendSeparatedDollar } = formatDisplayMoney(value);
  return appendSeparatedDollar ? `${main} $` : main;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Claim scrub only when the finger clearly moves sideways — vertical stays with FlatList. */
const SCRUB_ACTIVATION_DX = 8;

function isHorizontalScrubGesture(dx: number, dy: number): boolean {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return ax >= SCRUB_ACTIVATION_DX && ax > ay;
}

type Pt = { x: number; y: number };

/**
 * Axis-aligned step vertices for cumulative spend:
 * hold until an expense day → vertical rise → hold again through today.
 * Always ends with an explicit point at `endIndex` so the line plateaus
 * horizontally after the last spend (never stops mid-riser).
 */
function buildProgressStepVertices(
  values: number[],
  endIndex: number,
  toX: (i: number) => number,
  toY: (v: number) => number,
): Pt[] {
  if (values.length === 0) return [];
  const end = clamp(endIndex, 0, values.length - 1);
  const pts: Pt[] = [{ x: toX(0), y: toY(values[0] ?? 0) }];
  let yVal = values[0] ?? 0;

  for (let i = 1; i <= end; i += 1) {
    const next = values[i] ?? yVal;
    if (Math.abs(next - yVal) >= 0.01) {
      // Horizontal to this day at the previous total, then vertical step.
      pts.push({ x: toX(i), y: toY(yVal) });
      pts.push({ x: toX(i), y: toY(next) });
      yVal = next;
    }
  }

  const endPt = { x: toX(end), y: toY(values[end] ?? yVal) };
  const last = pts[pts.length - 1]!;
  if (Math.abs(last.x - endPt.x) > 0.5 || Math.abs(last.y - endPt.y) > 0.5) {
    pts.push(endPt);
  }
  return pts;
}

/**
 * Rounded path through axis-aligned step vertices (Wealthsimple-style soft corners).
 */
function buildRoundedStepPaths(points: Pt[], cornerR: number, bottomY: number): {
  line: string;
  area: string;
} {
  if (points.length === 0) return { line: '', area: '' };
  if (points.length === 1) {
    const p = points[0]!;
    const line = `M ${p.x} ${p.y}`;
    return {
      line,
      area: `${line} L ${p.x} ${bottomY} L ${p.x} ${bottomY} Z`,
    };
  }

  const parts: string[] = [`M ${points[0]!.x.toFixed(2)} ${points[0]!.y.toFixed(2)}`];

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dy = b.y - a.y;
    const dx = b.x - a.x;
    if (Math.abs(dy) < 0.5 || Math.abs(dx) < 0.5) {
      // Pure horizontal or vertical segment
      parts.push(`L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`);
      continue;
    }

    const r = Math.min(cornerR, Math.abs(dx) / 2, Math.abs(dy) / 2);
    const hx = b.x - Math.sign(dx) * r;
    const vy = a.y + Math.sign(dy) * r;

    parts.push(`L ${hx.toFixed(2)} ${a.y.toFixed(2)}`);
    parts.push(`Q ${b.x.toFixed(2)} ${a.y.toFixed(2)} ${b.x.toFixed(2)} ${vy.toFixed(2)}`);
    parts.push(`L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`);
  }

  const line = parts.join(' ');
  const last = points[points.length - 1]!;
  const first = points[0]!;
  const area = `${line} L ${last.x.toFixed(2)} ${bottomY.toFixed(2)} L ${first.x.toFixed(2)} ${bottomY.toFixed(2)} Z`;
  return { line, area };
}

/** Dense day points for prior-month (full completed) curve. */
function buildDenseDayPoints(
  values: number[],
  toX: (i: number) => number,
  toY: (v: number) => number,
): Pt[] {
  return values.map((v, i) => ({ x: toX(i), y: toY(v) }));
}

function buildDenseRoundedStepPaths(
  points: Pt[],
  cornerR: number,
  bottomY: number,
): { line: string; area: string } {
  if (points.length === 0) return { line: '', area: '' };
  if (points.length === 1) {
    const p = points[0]!;
    const line = `M ${p.x} ${p.y}`;
    return {
      line,
      area: `${line} L ${p.x} ${bottomY} L ${p.x} ${bottomY} Z`,
    };
  }

  const parts: string[] = [`M ${points[0]!.x.toFixed(2)} ${points[0]!.y.toFixed(2)}`];

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dy = b.y - a.y;
    const dx = b.x - a.x;
    if (Math.abs(dy) < 0.5) {
      parts.push(`L ${b.x.toFixed(2)} ${a.y.toFixed(2)}`);
      continue;
    }

    const r = Math.min(cornerR, Math.abs(dx) / 2, Math.abs(dy) / 2);
    const hx = b.x - r;
    const vy = a.y + Math.sign(dy) * r;

    parts.push(`L ${hx.toFixed(2)} ${a.y.toFixed(2)}`);
    parts.push(`Q ${b.x.toFixed(2)} ${a.y.toFixed(2)} ${b.x.toFixed(2)} ${vy.toFixed(2)}`);
    parts.push(`L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`);
  }

  const line = parts.join(' ');
  const last = points[points.length - 1]!;
  const first = points[0]!;
  const area = `${line} L ${last.x.toFixed(2)} ${bottomY.toFixed(2)} L ${first.x.toFixed(2)} ${bottomY.toFixed(2)} Z`;
  return { line, area };
}

export function CumulativeSpendStepChart({
  series,
  comparisonSeries,
  periodTotal,
  activeIndex,
  budgetLimit = 0,
  granularity = 'month',
  getScrubLabel,
  priorPeriodPhrase = 'Mois dernier',
}: Props) {
  const { colors, isLight } = useAppTheme();
  const [width, setWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const widthRef = useRef(0);
  const seriesRef = useRef(series);
  const activeRef = useRef(activeIndex);
  seriesRef.current = series;
  activeRef.current = activeIndex;

  const progressEnd = clamp(activeIndex, 0, Math.max(0, series.length - 1));
  const displayIndex = scrubIndex ?? progressEnd;
  const displayValue = series[displayIndex] ?? periodTotal;
  const comparisonAtDay =
    comparisonSeries[displayIndex] ?? comparisonSeries[comparisonSeries.length - 1] ?? 0;

  const chartA11y =
    granularity === 'week'
      ? 'Graphique des dépenses cumulées versus la semaine précédente. Glisser horizontalement pour explorer.'
      : granularity === 'year'
        ? 'Graphique des dépenses cumulées versus l’année précédente. Glisser horizontalement pour explorer.'
        : 'Graphique des dépenses cumulées versus le mois précédent. Glisser horizontalement pour explorer.';

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 0 && w !== widthRef.current) {
      widthRef.current = w;
      setWidth(w);
    }
  }, []);

  const indexFromX = useCallback((x: number) => {
    const data = seriesRef.current;
    if (data.length < 1 || widthRef.current <= 0) return 0;
    const innerW = Math.max(1, widthRef.current - PAD_X * 2);
    const t = clamp((x - PAD_X) / innerW, 0, 1);
    const maxIdx = Math.min(activeRef.current, data.length - 1);
    return clamp(Math.round(t * (data.length - 1)), 0, maxIdx);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_e, g) => isHorizontalScrubGesture(g.dx, g.dy),
        onMoveShouldSetPanResponderCapture: (_e, g) => isHorizontalScrubGesture(g.dx, g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          setScrubIndex(indexFromX(e.nativeEvent.locationX));
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          setScrubIndex(indexFromX(e.nativeEvent.locationX));
        },
        onPanResponderRelease: () => setScrubIndex(null),
        onPanResponderTerminate: () => setScrubIndex(null),
      }),
    [indexFromX],
  );

  const webPointerProps =
    Platform.OS === 'web'
      ? {
          onMouseMove: (e: { nativeEvent: { offsetX?: number; locationX?: number } }) => {
            const x = e.nativeEvent.offsetX ?? e.nativeEvent.locationX ?? 0;
            setScrubIndex(indexFromX(x));
          },
          onMouseLeave: () => setScrubIndex(null),
        }
      : null;

  const geometry = useMemo(() => {
    if (series.length < 1 || width <= 0) return null;

    const progressSeries = monthSpendProgressSeries(series, progressEnd);
    // One shared dollar domain for BOTH lines — never normalize each series to its own 0–1.
    const yMax = sharedSpendChartYMax(
      [progressSeries, series, comparisonSeries],
      [periodTotal],
    );
    const showBudget =
      budgetLimit > 0 && Number.isFinite(budgetLimit) && budgetLimit <= yMax * 1.02;
    const innerW = width - PAD_X * 2;
    const innerH = CHART_H - PAD_TOP - PAD_BOTTOM;
    const bottomY = PAD_TOP + innerH;
    const xLen = Math.max(series.length, comparisonSeries.length, 1);

    const toX = (i: number) =>
      PAD_X + (xLen === 1 ? innerW / 2 : (i / (xLen - 1)) * innerW);
    const toY = (v: number) => PAD_TOP + innerH - (clamp(v, 0, yMax) / yMax) * innerH;

    const priorPoints = buildDenseDayPoints(
      comparisonSeries.length > 0 ? comparisonSeries : [0],
      toX,
      toY,
    );
    const progressPoints = buildProgressStepVertices(progressSeries, progressEnd, toX, toY);

    const priorPaths = buildDenseRoundedStepPaths(priorPoints, CORNER_R, bottomY);
    const currentPaths = buildRoundedStepPaths(progressPoints, CORNER_R, bottomY);

    const budgetY = showBudget ? toY(budgetLimit) : null;
    const budgetEndX = toX(progressEnd);
    const endPt = progressPoints[progressPoints.length - 1] ?? null;
    const scrubPt =
      scrubIndex != null
        ? { x: toX(scrubIndex), y: toY(series[scrubIndex] ?? 0) }
        : null;

    return {
      priorLine: priorPaths.line,
      currentLine: currentPaths.line,
      currentArea: currentPaths.area,
      budgetY,
      budgetEndX,
      endPt,
      scrubPt,
      showBudget,
    };
  }, [budgetLimit, comparisonSeries, periodTotal, progressEnd, scrubIndex, series, width]);

  const currentLineColor = COLORS.chart.blue;
  const priorLineColor = isLight ? 'rgba(30,30,36,0.55)' : 'rgba(255,255,255,0.88)';
  const fillTop = isLight ? 'rgba(74,158,255,0.22)' : 'rgba(74,158,255,0.32)';
  const budgetColor = isLight ? 'rgba(30,30,36,0.28)' : 'rgba(255,255,255,0.28)';
  const activeScrubLabel =
    scrubIndex != null
      ? (getScrubLabel?.(scrubIndex) ?? `Jour ${scrubIndex + 1}`)
      : null;

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={styles.header} accessibilityRole="summary">
        <Text
          style={[
            moneyAmountTypography({ tier: 'detailHero' }),
            styles.primaryAmount,
            { color: colors.text },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {formatMoneyFr(displayValue)}
        </Text>
        {activeScrubLabel ? (
          <Text style={[styles.dayHint, { color: colors.textMuted }]}>{activeScrubLabel}</Text>
        ) : null}
        <Text style={[styles.compareHint, { color: colors.textMuted }]} numberOfLines={1}>
          {`${priorPeriodPhrase} · ${formatMoneyFr(comparisonAtDay)}`}
        </Text>
      </View>

      <View
        style={styles.chartHit}
        {...panResponder.panHandlers}
        {...webPointerProps}
        accessibilityLabel={chartA11y}
      >
        {geometry && width > 0 ? (
          <Svg width={width} height={CHART_H}>
            <Defs>
              <LinearGradient id="cumSpendFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={fillTop} stopOpacity={1} />
                <Stop offset="0.85" stopColor={fillTop} stopOpacity={0.05} />
                <Stop offset="1" stopColor={fillTop} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {geometry.currentArea ? (
              <Path d={geometry.currentArea} fill="url(#cumSpendFill)" />
            ) : null}
            {geometry.showBudget && geometry.budgetY != null ? (
              <Path
                d={`M ${PAD_X} ${geometry.budgetY.toFixed(2)} L ${geometry.budgetEndX.toFixed(2)} ${geometry.budgetY.toFixed(2)}`}
                stroke={budgetColor}
                strokeWidth={1.25}
                fill="none"
                strokeLinecap="round"
                strokeDasharray="4 4"
              />
            ) : null}
            {geometry.priorLine ? (
              <Path
                d={geometry.priorLine}
                stroke={priorLineColor}
                strokeWidth={PRIOR_LINE_W}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {geometry.currentLine ? (
              <Path
                d={geometry.currentLine}
                stroke={currentLineColor}
                strokeWidth={LINE_W}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {scrubIndex != null && geometry.scrubPt ? (
              <Circle
                cx={geometry.scrubPt.x}
                cy={geometry.scrubPt.y}
                r={4.5}
                fill={currentLineColor}
              />
            ) : geometry.endPt ? (
              <Circle
                cx={geometry.endPt.x}
                cy={geometry.endPt.y}
                r={ENDPOINT_R}
                fill={currentLineColor}
              />
            ) : null}
          </Svg>
        ) : (
          <View style={{ height: CHART_H }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: spacing.sm,
  },
  header: {
    alignItems: 'center',
    gap: 4,
  },
  primaryAmount: {
    letterSpacing: -1.2,
    textAlign: 'center',
  },
  dayHint: {
    ...typographyKit.caption,
    marginTop: -2,
  },
  compareHint: {
    ...typographyKit.caption,
    letterSpacing: -0.1,
    textAlign: 'center',
    marginTop: -2,
  },
  chartHit: {
    width: '100%',
    height: CHART_H,
  },
});


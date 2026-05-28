import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import {
  LINEAR_CHART_END_DOT_INNER_R,
  LINEAR_CHART_END_DOT_OUTER_OPACITY,
  LINEAR_CHART_END_DOT_OUTER_R,
  LINEAR_CHART_GLOW_MID_OPACITY,
  LINEAR_CHART_GLOW_MID_TRANSLATE_Y,
  LINEAR_CHART_GLOW_OUTER_OPACITY,
  LINEAR_CHART_STROKE_GLOW_MID,
  LINEAR_CHART_STROKE_GLOW_OUTER,
  LINEAR_CHART_STROKE_MAIN,
} from '@/constants/linearChart';
import { goalInitialSaved } from '@/lib/savingsGoalProgress';
import type { SavingsGoal } from '@/types';

const GOAL_SPARK_W = 300;
const GOAL_SPARK_H = 64;
const GOAL_SPARK_LABEL_H = 15;
export const GOAL_SPARK_TOTAL_H = GOAL_SPARK_H + GOAL_SPARK_LABEL_H;
const GOAL_SPARK_PAD = 10;
/** Chart window: current calendar month plus the previous 3 months. */
const GOAL_HISTORY_MONTH_OFFSETS = [-3, -2, -1, 0] as const;

function startOfMonthWithOffset(now: Date, monthDelta: number): Date {
  return new Date(now.getFullYear(), now.getMonth() + monthDelta, 1);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Indicative past balance: 0 until creation, then linear 0→current from createdAt→now when no granular history exists. */
function backfilledAmountAt(ts: number, nowMs: number, createdMs: number, current: number, target: number): number {
  if (target <= 0) return current;
  if (current >= target) return Math.min(ts <= nowMs ? current : target, target);
  if (ts <= createdMs) return 0;
  if (ts >= nowMs) return current;
  const denom = Math.max(nowMs - createdMs, 1);
  const u = (ts - createdMs) / denom;
  return clamp(u * current, 0, Math.min(current, target));
}

function monthTickLabelFr(monthStart: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(monthStart).replace(/\.$/, '');
}

export type GoalSparkAmountPoint = { t: number; v: number };

/**
 * Builds time-ordered indicative series: the last 4 calendar month anchors + today.
 */
export function buildGoalSparklineSeries(goal: SavingsGoal, now: Date): { points: GoalSparkAmountPoint[]; ticks: { t: number; label: string }[] } {
  const nowMs = now.getTime();
  const target = Math.max(goal.targetAmount, 0);
  const current = Math.max(goal.currentAmount, 0);
  const initialSaved = goalInitialSaved(goal);
  const parsedCreated = new Date(goal.createdAt).getTime();
  const createdMs = Math.min(Number.isFinite(parsedCreated) ? parsedCreated : nowMs, nowMs);

  const ticks = GOAL_HISTORY_MONTH_OFFSETS.map((off) => {
    const mStart = startOfMonthWithOffset(now, off);
    return { t: mStart.getTime(), label: monthTickLabelFr(mStart) };
  });

  const windowStartMs = ticks[0]!.t;

  if (target <= 0) {
    const pts: GoalSparkAmountPoint[] = [
      { t: windowStartMs, v: current },
      { t: nowMs, v: current },
    ];
    return { points: pts, ticks };
  }

  if (current >= target) {
    const pts: GoalSparkAmountPoint[] = [
      { t: windowStartMs, v: target },
      { t: nowMs, v: target },
    ];
    return { points: pts, ticks };
  }

  const uniq = new Map<number, number>();

  for (const off of GOAL_HISTORY_MONTH_OFFSETS) {
    const m = startOfMonthWithOffset(now, off);
    const mt = m.getTime();
    if (mt <= nowMs && mt >= windowStartMs - 1) {
      uniq.set(mt, backfilledAmountAt(mt, nowMs, createdMs, current, target));
    }
  }

  uniq.set(nowMs, current);

  const sortedPairs = [...uniq.entries()].sort((a, b) => a[0] - b[0]);
  const points = sortedPairs.map(([t, v]) => ({ t, v }));
  return { points, ticks };
}

type SparkPixPoint = { x: number; y: number; t: number };

function buildSparklinePaths(amountPts: GoalSparkAmountPoint[]) {
  const minV = Math.min(...amountPts.map((p) => p.v), 0);
  const maxV = Math.max(...amountPts.map((p) => p.v), 1);
  const range = Math.max(maxV - minV, 1);
  const t0 = amountPts[0]!.t;
  const tLast = amountPts[amountPts.length - 1]!.t;
  const span = Math.max(tLast - t0, 1);
  const iw = GOAL_SPARK_W - GOAL_SPARK_PAD * 2;
  const ih = GOAL_SPARK_H - GOAL_SPARK_PAD * 2;
  const pts: SparkPixPoint[] = amountPts.map((p) => ({
    t: p.t,
    x: GOAL_SPARK_PAD + ((p.t - t0) / span) * iw,
    y: GOAL_SPARK_PAD + (1 - (p.v - minV) / range) * ih,
  }));

  const segment = (from: number, to: number) =>
    pts
      .slice(from, to + 1)
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

  const lineFull = segment(0, pts.length - 1);
  const last = pts[pts.length - 1] ?? { x: GOAL_SPARK_PAD, y: GOAL_SPARK_PAD, t: t0 };

  const area = `${lineFull} L ${last.x} ${GOAL_SPARK_H - GOAL_SPARK_PAD} L ${pts[0]?.x ?? GOAL_SPARK_PAD} ${GOAL_SPARK_H - GOAL_SPARK_PAD} Z`;

  return { pts, lineFull, area, last, t0, span };
}

function tickXOnChart(tTick: number, t0: number, span: number): number {
  return GOAL_SPARK_PAD + ((tTick - t0) / span) * (GOAL_SPARK_W - GOAL_SPARK_PAD * 2);
}

export function sortGoalsForChartCarousel(goals: SavingsGoal[]): SavingsGoal[] {
  return [...goals].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id);
  });
}

export function GoalSparkChart({
  goal,
  stroke,
  areaFill,
  gridColor,
  labelColor,
}: {
  goal: SavingsGoal;
  stroke: string;
  areaFill: string;
  gridColor: string;
  labelColor: string;
}) {
  const series = useMemo(() => buildGoalSparklineSeries(goal, new Date()), [goal]);
  const { pts, lineFull, area, last, t0, span } = useMemo(() => buildSparklinePaths(series.points), [series.points]);

  const chartMidY = GOAL_SPARK_H / 2;
  const { ticks } = series;

  return (
    <View style={styles.sparkWrap}>
      <Svg width="100%" height={GOAL_SPARK_TOTAL_H} viewBox={`0 0 ${GOAL_SPARK_W} ${GOAL_SPARK_TOTAL_H}`}>
        <Line x1={GOAL_SPARK_PAD} y1={chartMidY} x2={GOAL_SPARK_W - GOAL_SPARK_PAD} y2={chartMidY} stroke={gridColor} strokeWidth={1} opacity={0.35} />
        <Line x1={GOAL_SPARK_PAD} y1={GOAL_SPARK_PAD + 6} x2={GOAL_SPARK_W - GOAL_SPARK_PAD} y2={GOAL_SPARK_PAD + 6} stroke={gridColor} strokeWidth={1} opacity={0.22} />
        <Line
          x1={GOAL_SPARK_PAD}
          y1={GOAL_SPARK_H - GOAL_SPARK_PAD - 6}
          x2={GOAL_SPARK_W - GOAL_SPARK_PAD}
          y2={GOAL_SPARK_H - GOAL_SPARK_PAD - 6}
          stroke={gridColor}
          strokeWidth={1}
          opacity={0.22}
        />
        <Path d={area} fill={areaFill} />
        <Path d={lineFull} fill="none" stroke={stroke} strokeWidth={LINEAR_CHART_STROKE_GLOW_OUTER} strokeOpacity={LINEAR_CHART_GLOW_OUTER_OPACITY} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={lineFull} fill="none" stroke={stroke} strokeWidth={LINEAR_CHART_STROKE_GLOW_MID} strokeOpacity={LINEAR_CHART_GLOW_MID_OPACITY} strokeLinecap="round" strokeLinejoin="round" transform={`translate(0 ${LINEAR_CHART_GLOW_MID_TRANSLATE_Y})`} />
        <Path d={lineFull} fill="none" stroke={stroke} strokeWidth={LINEAR_CHART_STROKE_MAIN} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={last.x} cy={last.y} r={LINEAR_CHART_END_DOT_OUTER_R} fill={stroke} opacity={LINEAR_CHART_END_DOT_OUTER_OPACITY} />
        <Circle cx={last.x} cy={last.y} r={LINEAR_CHART_END_DOT_INNER_R} fill={stroke} />
        {ticks.map((tk) => {
          const x = tickXOnChart(tk.t, t0, span);
          if (x < GOAL_SPARK_PAD - 4 || x > GOAL_SPARK_W - GOAL_SPARK_PAD + 4) return null;
          return (
            <SvgText
              key={`${tk.t}-${tk.label}`}
              x={x}
              y={GOAL_SPARK_H + 11}
              fill={labelColor}
              fontSize={9}
              fontWeight="600"
              textAnchor="middle"
            >
              {tk.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  sparkWrap: { marginTop: 2 },
});

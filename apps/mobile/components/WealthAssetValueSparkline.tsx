import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import {
  LINEAR_CHART_GLOW_MID_OPACITY,
  LINEAR_CHART_GLOW_MID_TRANSLATE_Y,
  LINEAR_CHART_GLOW_OUTER_OPACITY,
  LINEAR_CHART_STROKE_GLOW_MID,
  LINEAR_CHART_STROKE_GLOW_OUTER,
  LINEAR_CHART_STROKE_MAIN,
} from '@/constants/linearChart';
import type { WealthSixMonthHintPoint } from '@/lib/buildWealthSixMonthIndicativeSeries';
import { spacing, typography } from '@/constants/theme';

const CHART_W = 340;
const CHART_H = 72;
const CHART_PAD_X = 6;
const CHART_PAD_BOTTOM = 16;
/** Total viewport height incl. caption row */
const LABEL_Y = CHART_H + 12;
const TOTAL_H = LABEL_Y + 4;

type Props = {
  points: WealthSixMonthHintPoint[];
  stroke: string;
  areaFill: string;
  gridColor: string;
  labelColor: string;
};

/** Pixel layout from month-ordered indicative points — no numerical Y axis (avoids implying precision). */
function buildSvgPaths(series: WealthSixMonthHintPoint[]): { area: string; line: string } {
  if (series.length < 2) return { area: '', line: '' };

  const values = series.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const padY = Math.max(Math.abs(maxV - minV) * 0.08, Math.max(minV * 0.02, maxV * 0.015, 1));
  const lo = Math.max(0, minV - padY);
  const hi = maxV + padY;
  const range = Math.max(hi - lo, 1);

  const t0 = series[0]!.tMs;
  const span = Math.max(series[series.length - 1]!.tMs - t0, 1);
  const innerW = CHART_W - CHART_PAD_X * 2;
  const innerH = CHART_H - CHART_PAD_X * 2 - 4;

  const pix = series.map((p) => ({
    x: CHART_PAD_X + ((p.tMs - t0) / span) * innerW,
    y: CHART_PAD_X + (1 - (p.value - lo) / range) * innerH,
  }));

  const line =
    pix.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const last = pix[pix.length - 1];
  const first = pix[0];
  const area =
    `${line} L ${last?.x ?? 0} ${CHART_H - CHART_PAD_X} L ${first?.x ?? 0} ${CHART_H - CHART_PAD_X} Z`;

  return { line, area };
}

export function WealthAssetValueSparkline({ points, stroke, areaFill, gridColor, labelColor }: Props) {
  const { line, area } = useMemo(() => buildSvgPaths(points), [points]);

  const tickXs = useMemo(() => {
    if (points.length === 0) return [];
    const t0 = points[0]!.tMs;
    const span = Math.max(points[points.length - 1]!.tMs - t0, 1);
    const innerW = CHART_W - CHART_PAD_X * 2;
    return points.map((p) => ({
      label: p.label,
      x: CHART_PAD_X + ((p.tMs - t0) / span) * innerW,
    }));
  }, [points]);

  const chartMid = CHART_H / 2;

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={TOTAL_H} viewBox={`0 0 ${CHART_W} ${TOTAL_H}`}>
        <Line
          x1={CHART_PAD_X}
          y1={chartMid}
          x2={CHART_W - CHART_PAD_X}
          y2={chartMid}
          stroke={gridColor}
          strokeWidth={1}
          opacity={0.28}
        />
        <Line
          x1={CHART_PAD_X}
          y1={CHART_PAD_X + 6}
          x2={CHART_W - CHART_PAD_X}
          y2={CHART_PAD_X + 6}
          stroke={gridColor}
          strokeWidth={1}
          opacity={0.22}
        />
        <Line
          x1={CHART_PAD_X}
          y1={CHART_H - CHART_PAD_X - 4}
          x2={CHART_W - CHART_PAD_X}
          y2={CHART_H - CHART_PAD_X - 4}
          stroke={gridColor}
          strokeWidth={1}
          opacity={0.22}
        />
        {area ? <Path d={area} fill={areaFill} /> : null}
        {line ? (
          <>
            <Path d={line} fill="none" stroke={stroke} strokeWidth={LINEAR_CHART_STROKE_GLOW_OUTER} strokeOpacity={LINEAR_CHART_GLOW_OUTER_OPACITY} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={line} fill="none" stroke={stroke} strokeWidth={LINEAR_CHART_STROKE_GLOW_MID} strokeOpacity={LINEAR_CHART_GLOW_MID_OPACITY} strokeLinecap="round" strokeLinejoin="round" transform={`translate(0 ${LINEAR_CHART_GLOW_MID_TRANSLATE_Y})`} />
            <Path d={line} fill="none" stroke={stroke} strokeWidth={LINEAR_CHART_STROKE_MAIN} strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : null}
        {tickXs.map(({ x, label }) => (
          <SvgText
            key={`${label}-${x}`}
            x={x}
            y={LABEL_Y}
            fill={labelColor}
            fontSize={9}
            fontWeight="700"
            textAnchor="middle"
          >
            {label}
          </SvgText>
        ))}
      </Svg>
      <Text style={[styles.legend, { color: labelColor }]}>
        Indicatif — aucun historique mensuel conservé localement · courbe extrapolée
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
    marginTop: spacing.xs,
  },
  legend: {
    fontSize: typography.micro,
    fontWeight: '600',
    lineHeight: typography.micro + 4,
    letterSpacing: 0.15,
  },
});

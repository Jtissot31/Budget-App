/**
 * Small, quiet charts for summary cards (Wealthsimple-style: one line, no axes).
 *
 * - `AreaSparkline`  trend line + soft gradient fill, width from layout
 * - `RingGauge`      circular progress with centred label
 * - `SplitBar`       stacked horizontal bar + compact legend (allocation / répartition)
 */
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* ───────────────────────── AreaSparkline ───────────────────────── */

export function AreaSparkline({
  data,
  color,
  height = 56,
}: {
  data: readonly number[];
  color: string;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const paths = useMemo(() => {
    if (data.length < 2 || width <= 0) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padY = 4;
    const innerH = height - padY * 2;
    const pts = data.map((v, i) => ({
      x: (i / (data.length - 1)) * width,
      y: padY + innerH - ((v - min) / range) * innerH,
    }));
    // Smooth with cardinal-ish midpoints.
    let line = `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]!;
      const cur = pts[i]!;
      const mx = (prev.x + cur.x) / 2;
      line += ` C ${mx.toFixed(1)} ${prev.y.toFixed(1)}, ${mx.toFixed(1)} ${cur.y.toFixed(1)}, ${cur.x.toFixed(1)} ${cur.y.toFixed(1)}`;
    }
    const last = pts[pts.length - 1]!;
    const area = `${line} L ${last.x.toFixed(1)} ${height} L 0 ${height} Z`;
    return { line, area, last };
  }, [data, height, width]);

  return (
    <View
      style={{ height, width: '100%' }}
      onLayout={(e) => {
        const w = Math.floor(e.nativeEvent.layout.width);
        setWidth((prev) => (prev === w ? prev : w));
      }}
    >
      {paths ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={paths.area} fill={`url(#${gradientId})`} />
          <Path d={paths.line} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
          <Circle cx={paths.last.x - 3} cy={paths.last.y} r={3.5} fill={color} />
        </Svg>
      ) : null}
    </View>
  );
}

/* ───────────────────────── RingGauge ───────────────────────── */

export function RingGauge({
  progress,
  color,
  size = 72,
  stroke = 8,
  children,
}: {
  progress: number;
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const value = useSharedValue(0);
  const clamped = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    value.value = withTiming(clamped, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [clamped, value]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.borderSubtle} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

/* ───────────────────────── SplitBar ───────────────────────── */

export type SplitSegment = { key: string; label: string; value: number; color: string };

export function SplitBar({
  segments,
  height = 8,
  showLegend = true,
}: {
  segments: readonly SplitSegment[];
  height?: number;
  showLegend?: boolean;
}) {
  const { colors } = useAppTheme();
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;

  return (
    <View style={styles.split}>
      <View style={[styles.splitTrack, { height, borderRadius: height / 2 }]}>
        {visible.map((s, i) => (
          <View
            key={s.key}
            style={{
              flex: s.value / total,
              backgroundColor: s.color,
              marginLeft: i === 0 ? 0 : 2,
            }}
          />
        ))}
      </View>
      {showLegend ? (
        <View style={styles.legend}>
          {visible.map((s) => (
            <View key={s.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]} numberOfLines={1}>
                {s.label} {Math.round((s.value / total) * 100)} %
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Ordered palette for category / allocation segments (works in both themes). */
export const CHART_PALETTE = ['#22C55E', '#3B82F6', '#A855F7', '#F59E0B', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#EAB308', '#06B6D4', '#64748B'];

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  split: { gap: 10 },
  splitTrack: { flexDirection: 'row', overflow: 'hidden', width: '100%' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typographyKit.metaMedium, fontSize: 11 },
});

/**
 * Monochrome shade for segment `index` of `count` — white ramp on dark, ink ramp on light.
 * Keeps charts calm on the dark theme (colour is reserved for green/red meaning).
 */
export function monoShade(index: number, count: number, isLight: boolean): string {
  const steps = Math.max(1, count - 1);
  const alpha = 0.92 - (Math.min(index, steps) / steps) * 0.7;
  return isLight ? `rgba(10,10,15,${alpha.toFixed(2)})` : `rgba(255,255,255,${alpha.toFixed(2)})`;
}

/**
 * Muted accents for category identity — soft enough for the dark theme, distinct
 * enough to tell categories apart. Never used for good/bad meaning (that's green/red).
 */
export const SUBTLE_ACCENTS = [
  '#7FB3D5', // bleu acier
  '#8FC9A8', // sauge
  '#D9B77E', // sable
  '#B8A1D9', // lavande
  '#D49A9A', // vieux rose
  '#7EC4C1', // eau
  '#C9A27E', // caramel
  '#9AA8D9', // pervenche
  '#A9C47E', // olive
  '#C79AC0', // mauve
];

/** `#RRGGBB` → rgba at `alpha` (falls back to the input for other formats). */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1]!, 16)},${parseInt(m[2]!, 16)},${parseInt(m[3]!, 16)},${alpha})`;
}

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, FeDropShadow, Filter } from 'react-native-svg';
import { DashboardCard } from '@/components/DashboardCard';
import { dashboardPalette, interBoldText, interMediumText, spacing, typography } from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { singleLineAmountProps } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 148;
const RING_R = 60;
const RING_CX = RING_SIZE / 2;
const RING_CY = RING_SIZE / 2;
const RING_CIRC = 2 * Math.PI * RING_R;
const STROKE_W = 8;
const ANIMATE_MS = 900;

type HealthStatus = 'safe' | 'warning' | 'danger';

function getStatus(pct: number): HealthStatus {
  if (pct > 85) return 'danger';
  if (pct > 60) return 'warning';
  return 'safe';
}

function getStatusLabel(status: HealthStatus): string {
  if (status === 'danger') return 'Critique';
  if (status === 'warning') return 'Attention';
  return 'Bien';
}

function getAccentColor(status: HealthStatus, isLight: boolean): string {
  if (status === 'danger') return isLight ? '#CF222E' : '#ef4444';
  if (status === 'warning') return isLight ? '#D97706' : '#f59e0b';
  return isLight ? '#00A854' : '#22c55e';
}

function StatRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  const { colors, isLight } = useAppTheme();
  const muted = isLight ? colors.textMuted : '#7a7a7a';
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor ?? colors.text }]} {...singleLineAmountProps}>
        {value}
      </Text>
    </View>
  );
}

function HealthRing({ pct, accent }: { pct: number; accent: string }) {
  const { colors, isLight } = useAppTheme();
  const track = isLight ? colors.border : dashboardPalette.iconBox;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.min(pct, 100), {
      duration: ANIMATE_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, progress]);

  const animatedArc = useAnimatedProps(() => {
    const dash = (progress.value / 100) * RING_CIRC;
    const gap = RING_CIRC - dash;
    return {
      strokeDasharray: `${dash} ${gap}`,
      strokeDashoffset: RING_CIRC / 4,
    };
  });

  return (
    <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
      <Defs>
        <Filter id="ringGlow" x="-40%" y="-40%" width="180%" height="180%">
          <FeDropShadow dx={0} dy={0} stdDeviation={5} floodColor={accent} floodOpacity={0.55} />
        </Filter>
      </Defs>
      {/* track */}
      <Circle cx={RING_CX} cy={RING_CY} r={RING_R} fill="none" stroke={track} strokeWidth={STROKE_W} />
      {/* glow arc */}
      <AnimatedCircle
        cx={RING_CX}
        cy={RING_CY}
        r={RING_R}
        fill="none"
        stroke={accent}
        strokeWidth={STROKE_W + 2}
        strokeLinecap="round"
        filter="url(#ringGlow)"
        animatedProps={animatedArc}
      />
      {/* main arc */}
      <AnimatedCircle
        cx={RING_CX}
        cy={RING_CY}
        r={RING_R}
        fill="none"
        stroke={accent}
        strokeWidth={STROKE_W}
        strokeLinecap="round"
        animatedProps={animatedArc}
      />
    </Svg>
  );
}

type Props = {
  spent: number;
  limit: number;
};

export function BudgetHealthCard({ spent, limit }: Props) {
  const { colors, isLight } = useAppTheme();
  const muted = isLight ? colors.textMuted : '#7a7a7a';
  const dividerColor = isLight ? colors.border : '#2a2a2a';

  const hasLimit = limit > 0;
  const rawPct = hasLimit ? Math.round((spent / limit) * 100) : 0;
  const arcPct = Math.min(rawPct, 100);
  const available = limit - spent;
  const status = getStatus(rawPct);
  const accent = getAccentColor(status, isLight);
  const statusLabel = getStatusLabel(status);

  const barWidth = useSharedValue(0);
  useEffect(() => {
    barWidth.value = withTiming(arcPct, {
      duration: ANIMATE_MS + 100,
      easing: Easing.out(Easing.cubic),
    });
  }, [arcPct, barWidth]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%` as `${number}%`,
  }));

  return (
    <DashboardCard style={styles.card} padding={spacing.lg}>
      {/* header */}
      <View style={styles.header}>
        <Text style={[styles.headerLabel, { color: muted }]}>SANTÉ DU BUDGET</Text>
        {hasLimit && (
          <Text style={[styles.statusBadge, { color: accent }]}>{statusLabel}</Text>
        )}
      </View>

      {/* ring + stats */}
      <View style={styles.body}>
        <View style={styles.ringWrap}>
          <HealthRing pct={arcPct} accent={accent} />
          <View style={styles.ringCenter} pointerEvents="none">
            <Text style={[styles.ringPct, { color: accent }]} {...singleLineAmountProps}>
              {hasLimit ? `${rawPct > 999 ? '999+' : rawPct}%` : '—'}
            </Text>
            <Text style={[styles.ringPctLabel, { color: muted }]}>utilisé</Text>
          </View>
        </View>

        <View style={styles.statsCol}>
          <StatRow label="Dépensé" value={formatDisplayMoneyAbsolute(spent)} />
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          <StatRow label="Limite" value={hasLimit ? formatDisplayMoneyAbsolute(limit) : '—'} />
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          <StatRow
            label="Disponible"
            value={hasLimit ? formatDisplayMoneyAbsolute(Math.max(0, available)) : '—'}
            valueColor={hasLimit ? (available < 0 ? (isLight ? '#CF222E' : '#ef4444') : accent) : undefined}
          />
        </View>
      </View>

      {/* bottom bar */}
      {hasLimit && (
        <View style={[styles.barTrack, { backgroundColor: isLight ? colors.border : dashboardPalette.iconBox }]}>
          <Animated.View style={[styles.barFill, { backgroundColor: accent }, barStyle]} />
        </View>
      )}
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerLabel: {
    ...interBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.8,
  },
  statusBadge: {
    ...interBoldText,
    fontSize: typography.caption,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: {
    ...interBoldText,
    fontSize: 26,
    lineHeight: 30,
  },
  ringPctLabel: {
    ...interMediumText,
    fontSize: typography.micro,
    marginTop: 2,
  },
  statsCol: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 3,
  },
  statLabel: {
    ...interMediumText,
    fontSize: typography.caption,
  },
  statValue: {
    ...interBoldText,
    fontSize: typography.caption,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  barTrack: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
});

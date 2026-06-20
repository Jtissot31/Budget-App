import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardStatLegendItem } from '@/components/DashboardStatCard';
import {
  dashboardPalette,
  DASHBOARD_VALUE_GREEN,
  DASHBOARD_VALUE_RED,
  interBoldText,
  interMediumText,
  moneyAmountTypography,
  spacing,
  typography,
} from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 132;
const RING_R = 54;
const RING_CX = RING_SIZE / 2;
const RING_CY = RING_SIZE / 2;
const RING_CIRC = 2 * Math.PI * RING_R;
const STROKE_W = 10;
const ANIMATE_MS = 900;
const SHIMMER_DURATION_MS = 2600;
const SHIMMER_SEGMENT = 20;

const BUDGET_SPENT_COLOR = DASHBOARD_VALUE_RED;
const BUDGET_PROGRESS_COLOR = DASHBOARD_VALUE_GREEN;

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
  if (status === 'danger') return isLight ? '#CF222E' : DASHBOARD_VALUE_RED;
  if (status === 'warning') return isLight ? '#D97706' : '#f59e0b';
  return isLight ? '#00A854' : DASHBOARD_VALUE_GREEN;
}

function HealthRing({ pct }: { pct: number }) {
  const { colors, isLight } = useAppTheme();
  const track = isLight ? colors.border : dashboardPalette.scopeTrack;
  const inProgress = pct > 0 && pct < 100;
  const progress = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.min(pct, 100), {
      duration: ANIMATE_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, progress]);

  useEffect(() => {
    if (inProgress) {
      shimmer.value = withRepeat(
        withTiming(1, {
          duration: SHIMMER_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        false,
      );
    } else {
      cancelAnimation(shimmer);
      shimmer.value = 0;
    }

    return () => cancelAnimation(shimmer);
  }, [inProgress, shimmer]);

  const spentArc = useAnimatedProps(() => {
    const dash = (progress.value / 100) * RING_CIRC;
    const gap = RING_CIRC - dash;
    return {
      strokeDasharray: `${dash} ${gap}`,
    };
  });

  const shimmerArc = useAnimatedProps(() => {
    const filled = (progress.value / 100) * RING_CIRC;
    const travel = Math.max(filled - SHIMMER_SEGMENT, 0);
    const active = filled > 0 && filled < RING_CIRC;
    const offset = interpolate(shimmer.value, [0, 1], [0, travel]);

    return {
      strokeDasharray: `${SHIMMER_SEGMENT} ${RING_CIRC - SHIMMER_SEGMENT}`,
      strokeDashoffset: -offset,
      opacity:
        active && travel > 0
          ? interpolate(shimmer.value, [0, 0.12, 0.88, 1], [0, 0.55, 0.55, 0])
          : 0,
    };
  });

  return (
    <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
      <Circle cx={RING_CX} cy={RING_CY} r={RING_R} fill="none" stroke={track} strokeWidth={STROKE_W} />
      <AnimatedCircle
        cx={RING_CX}
        cy={RING_CY}
        r={RING_R}
        fill="none"
        stroke={BUDGET_PROGRESS_COLOR}
        strokeWidth={STROKE_W}
        strokeLinecap="round"
        rotation={-90}
        origin={`${RING_CX}, ${RING_CY}`}
        animatedProps={spentArc}
      />
      <AnimatedCircle
        cx={RING_CX}
        cy={RING_CY}
        r={RING_R}
        fill="none"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth={STROKE_W}
        strokeLinecap="round"
        rotation={-90}
        origin={`${RING_CX}, ${RING_CY}`}
        animatedProps={shimmerArc}
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
  const muted = colors.textMuted;

  const hasLimit = limit > 0;
  const rawPct = hasLimit ? Math.round((spent / limit) * 100) : 0;
  const arcPct = Math.min(rawPct, 100);
  const status = getStatus(rawPct);
  const accent = getAccentColor(status, isLight);
  const statusLabel = getStatusLabel(status);

  return (
    <DashboardCard style={styles.card} padding={spacing.lg}>
      <View style={styles.header}>
        <Text style={[styles.headerLabel, { color: muted }]}>SANTÉ DU BUDGET</Text>
        {hasLimit ? <Text style={[styles.statusBadge, { color: accent }]}>{statusLabel}</Text> : null}
      </View>

      <View style={styles.body}>
        <View style={styles.ringWrap}>
          <HealthRing pct={arcPct} />
          <View style={styles.ringCenter} pointerEvents="none">
            <Text
              style={[styles.ringPct, moneyAmountTypography({ tier: 'stat', fontSize: 24, lineHeight: 28 }), { color: accent }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {hasLimit ? `${rawPct > 999 ? '999+' : rawPct}%` : '—'}
            </Text>
            <Text style={[styles.ringPctLabel, { color: muted }]}>utilisé</Text>
          </View>
        </View>

        <View style={styles.legendCol}>
          <DashboardStatLegendItem
            color={BUDGET_SPENT_COLOR}
            label="Dépensé"
            value={formatDisplayMoneyAbsolute(spent)}
          />
          <DashboardStatLegendItem
            color={isLight ? colors.border : dashboardPalette.scopeTrack}
            label="total prévu"
            value={hasLimit ? formatDisplayMoneyAbsolute(limit) : '—'}
          />
        </View>
      </View>
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
    ...typographyKit.eyebrow,
    fontSize: typography.micro - 1,
    letterSpacing: 0.8,
  },
  statusBadge: {
    ...interBoldText,
    fontSize: typography.caption,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ringPct: {
    textAlign: 'center',
  },
  ringPctLabel: {
    ...interMediumText,
    fontSize: typography.micro,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  legendCol: {
    flex: 1,
    minWidth: 0,
    gap: spacing.md,
  },
});

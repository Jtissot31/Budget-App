import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, FeDropShadow, Filter } from 'react-native-svg';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import {
  interBoldText,
  interExtraBoldText,
  interMediumText,
  PAGE_PADDING_HORIZONTAL,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { colorWithAlpha, getDonutVisualFractions, type BudgetChartSegment } from '@/lib/budgetChart';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { rowTitleTextProps } from '@/lib/textLayout';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const CHART_SIZE = 248;
const STROKE = 18;
const RADIUS = (CHART_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SEGMENT_GAP = 3;
const MONO_GREEN = '#3adf8a';
const SEGMENT_DRAW_MS = 500;
const SEGMENT_DRAW_STAGGER_MS = 120;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function segmentOpacity(index: number) {
  if (index === 0) return 1;
  if (index === 1) return 0.55;
  if (index === 2) return 0.25;
  return Math.max(0.1, 0.25 - (index - 2) * 0.04);
}

function formatMoney(value: number) {
  return formatDisplayMoneyAbsolute(Math.max(0, value));
}

type DonutSegmentProps = {
  index: number;
  dash: number;
  startOffset: number;
  baseOpacity: number;
  dimmed: boolean;
  onPress?: () => void;
};

function DonutSegment({ index, dash, startOffset, baseOpacity, dimmed, onPress }: DonutSegmentProps) {
  const draw = useSharedValue(0);

  useEffect(() => {
    draw.value = 0;
    draw.value = withDelay(
      index * SEGMENT_DRAW_STAGGER_MS,
      withTiming(1, { duration: SEGMENT_DRAW_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [dash, draw, index]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: `${draw.value * dash} ${CIRCUMFERENCE - draw.value * dash}`,
  }));

  const opacity = dimmed ? baseOpacity * 0.38 : baseOpacity;

  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      cx={CHART_SIZE / 2}
      cy={CHART_SIZE / 2}
      r={RADIUS}
      stroke={MONO_GREEN}
      strokeWidth={STROKE}
      fill="none"
      strokeOpacity={opacity}
      strokeLinecap="butt"
      strokeDashoffset={-startOffset}
      rotation={-90}
      origin={`${CHART_SIZE / 2}, ${CHART_SIZE / 2}`}
      filter={index === 0 ? 'url(#budgetSegGlow)' : undefined}
      onPress={onPress}
    />
  );
}

type Props = {
  segments: BudgetChartSegment[];
  totalAllocated: number;
  totalSpent: number;
  selectedId?: string | null;
  onSelectSegment?: (id: string) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

export function BudgetAllocationChart({
  segments,
  totalAllocated,
  totalSpent,
  selectedId = null,
  onSelectSegment,
  onLayout,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const mutedTextColor = isLight ? colors.textMuted : '#909090';
  const visualFractions = useMemo(() => getDonutVisualFractions(segments), [segments]);
  const trackColor = isLight ? colors.border : colors.scopeTrack;
  const hubColor = colors.cardBackground;
  const hasSelection = Boolean(selectedId);

  return (
    <DashboardCard
      padding={PAGE_PADDING_HORIZONTAL}
      innerStyle={styles.cardInner}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <DashboardSectionLabel>Répartition</DashboardSectionLabel>
          <Text style={[styles.title, { color: colors.text }]}>Par catégorie</Text>
          <Text style={[styles.subtitle, { color: mutedTextColor }]}>
            {`${formatMoney(totalAllocated)} alloué · ${formatMoney(totalSpent)} dépensé`}
          </Text>
        </View>
        <View style={[styles.countBadge, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.countBadgeText, { color: mutedTextColor }]}>{segments.length}</Text>
        </View>
      </View>

      <View onLayout={onLayout} style={styles.chartBlock}>
        <View style={styles.chartHalo}>
          <Svg width={CHART_SIZE} height={CHART_SIZE} style={styles.chartSvg}>
            <Defs>
              <Filter id="budgetSegGlow" x="-30%" y="-30%" width="160%" height="160%">
                <FeDropShadow dx={0} dy={0} stdDeviation={4} floodColor="#3adf8a" floodOpacity={0.53} />
              </Filter>
            </Defs>

            <Circle
              cx={CHART_SIZE / 2}
              cy={CHART_SIZE / 2}
              r={RADIUS}
              stroke={trackColor}
              strokeWidth={STROKE + 2}
              fill="none"
            />
            <Circle
              cx={CHART_SIZE / 2}
              cy={CHART_SIZE / 2}
              r={RADIUS - 28}
              stroke={colors.border}
              strokeWidth={1}
              fill="none"
              opacity={0.55}
            />

            {segments.map((seg, idx) => {
              const visualFrac = visualFractions[idx] ?? 0;
              if (visualFrac <= 0) return null;
              const start =
                visualFractions.slice(0, idx).reduce((sum, frac) => sum + frac, 0) * CIRCUMFERENCE;
              const dash = Math.max(0, visualFrac * CIRCUMFERENCE - SEGMENT_GAP);
              const selected = selectedId === seg.id;
              const dimmed = hasSelection && !selected;

              return (
                <DonutSegment
                  key={seg.id}
                  index={idx}
                  dash={dash}
                  startOffset={start + SEGMENT_GAP / 2}
                  baseOpacity={segmentOpacity(idx)}
                  dimmed={dimmed}
                  onPress={() => onSelectSegment?.(seg.id)}
                />
              );
            })}
          </Svg>

          <View
            pointerEvents="none"
            style={[
              styles.hub,
              {
                backgroundColor: hubColor,
                borderColor: colors.border,
                shadowColor: isLight ? '#0f172a' : '#000000',
              },
            ]}
          >
            <Text style={[styles.hubLabel, { color: mutedTextColor }]}>Alloué</Text>
            <Text
              style={[styles.hubAmount, { color: colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {formatMoney(totalAllocated)}
            </Text>
            <Text style={[styles.hubMeta, { color: MONO_GREEN }]}>
              {`${formatMoney(totalSpent)} dépensé`}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.legend}>
        {segments.map((seg, idx) => {
          const pct = Math.round(seg.fraction * 100);
          const selected = selectedId === seg.id;
          const toneOpacity = segmentOpacity(idx);
          return (
            <Pressable
              key={`legend-${seg.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${seg.name}, ${pct} pour cent`}
              onPress={() => {
                tapHaptic();
                onSelectSegment?.(seg.id);
              }}
              style={({ pressed }) => [
                styles.legendItem,
                {
                  backgroundColor: selected ? colors.surfaceElevated : 'transparent',
                  borderColor: selected ? colorWithAlpha(MONO_GREEN, isLight ? 0.35 : 0.45) : 'transparent',
                },
                pressed && styles.legendPressed,
              ]}
            >
              <View style={[styles.legendDot, { backgroundColor: MONO_GREEN, opacity: toneOpacity }]} />
              <Text style={[styles.legendName, { color: colors.text }]} {...rowTitleTextProps}>
                {seg.name}
              </Text>
              <Text style={[styles.legendPct, { color: MONO_GREEN, opacity: toneOpacity }]}>{`${pct} %`}</Text>
            </Pressable>
          );
        })}
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  cardInner: { gap: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: { ...interExtraBoldText, fontSize: typography.body, letterSpacing: -0.3 },
  subtitle: { ...interMediumText, fontSize: typography.caption, lineHeight: 20 },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  countBadgeText: { ...interBoldText, fontSize: typography.micro },
  chartBlock: { alignItems: 'center', paddingVertical: spacing.sm },
  chartHalo: {
    width: CHART_SIZE,
    height: CHART_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartSvg: { position: 'absolute' },
  hub: {
    width: CHART_SIZE - STROKE * 2 - 18,
    height: CHART_SIZE - STROKE * 2 - 18,
    borderRadius: (CHART_SIZE - STROKE * 2 - 18) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  hubLabel: {
    ...interBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.65,
    textTransform: 'uppercase',
  },
  hubAmount: {
    ...interExtraBoldText,
    fontSize: 30,
    letterSpacing: -0.9,
    marginTop: 4,
    textAlign: 'center',
  },
  hubMeta: {
    ...interBoldText,
    fontSize: typography.micro,
    marginTop: 5,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    maxWidth: '100%',
  },
  legendPressed: { opacity: 0.78 },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  legendName: {
    ...interMediumText,
    fontSize: typography.micro,
    fontWeight: '700',
    flexShrink: 1,
    maxWidth: 120,
  },
  legendPct: {
    ...interBoldText,
    fontSize: typography.micro,
    flexShrink: 0,
  },
});

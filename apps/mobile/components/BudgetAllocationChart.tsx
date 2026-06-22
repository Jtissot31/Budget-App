import { memo, useEffect, useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedProps,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, FeDropShadow, Filter, G, Line, Text as SvgText } from 'react-native-svg';
import {
  interBoldText,
  interExtraBoldText,
  interMediumText,
  spacing,
  typography,
} from '@/constants/theme';
import { getDonutVisualFractions, type BudgetChartSegment } from '@/lib/budgetChart';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const DONUT_SIZE = 248;
const STROKE = 18;
const RADIUS = (DONUT_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SEGMENT_GAP = 3;
const LABEL_MARGIN = 52;
const SVG_SIZE = DONUT_SIZE + LABEL_MARGIN * 2;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;
const LEADER_INNER = RADIUS + STROKE / 2 + 2;
const LEADER_OUTER = LEADER_INNER + 14;
const LABEL_RADIUS = LEADER_OUTER + 10;
const MIN_LABEL_SWEEP_DEG = 14;
const MAX_LABEL_CHARS = 11;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

function segmentOpacity(index: number) {
  if (index === 0) return 1;
  if (index === 1) return 0.55;
  if (index === 2) return 0.25;
  return Math.max(0.1, 0.25 - (index - 2) * 0.04);
}

function formatMoney(value: number) {
  return formatDisplayMoneyAbsolute(Math.max(0, value));
}

function polarToXY(r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad),
  };
}

function truncateLabel(name: string, maxLen = MAX_LABEL_CHARS) {
  const trimmed = name.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

type DonutSegmentProps = {
  index: number;
  dash: number;
  startOffset: number;
  baseOpacity: number;
  dimmed: boolean;
  accentColor: string;
  segmentId: string;
  onSelectSegment?: (id: string) => void;
};

const DonutSegment = memo(function DonutSegment({
  index,
  dash,
  startOffset,
  baseOpacity,
  dimmed,
  accentColor,
  segmentId,
  onSelectSegment,
}: DonutSegmentProps) {
  const draw = useSharedValue(1);

  useEffect(() => {
    draw.value = 1;
  }, [dash, draw, index]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: `${draw.value * dash} ${CIRCUMFERENCE - draw.value * dash}`,
  }));

  const opacity = dimmed ? baseOpacity * 0.38 : baseOpacity;

  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      cx={CX}
      cy={CY}
      r={RADIUS}
      stroke={accentColor}
      strokeWidth={STROKE}
      fill="none"
      strokeOpacity={opacity}
      strokeLinecap="butt"
      strokeDashoffset={-startOffset}
      rotation={-90}
      origin={`${CX}, ${CY}`}
      filter={index === 0 && Platform.OS !== 'android' ? 'url(#budgetSegGlow)' : undefined}
      onPress={
        onSelectSegment
          ? () => {
              tapHaptic();
              onSelectSegment(segmentId);
            }
          : undefined
      }
    />
  );
});

type SegmentLabel = {
  id: string;
  name: string;
  midAngleDeg: number;
  sweepDeg: number;
  baseOpacity: number;
};

type Props = {
  segments: BudgetChartSegment[];
  totalAllocated: number;
  totalSpent: number;
  selectedId?: string | null;
  onSelectSegment?: (id: string) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

export const BudgetAllocationChart = memo(function BudgetAllocationChart({
  segments,
  totalAllocated,
  totalSpent,
  selectedId = null,
  onSelectSegment,
  onLayout,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const mutedTextColor = isLight ? colors.textMuted : '#909090';
  const accentColor = colors.accentGreen;
  const visualFractions = useMemo(() => getDonutVisualFractions(segments), [segments]);

  const segmentArcs = useMemo(() => {
    let running = 0;
    return segments
      .map((seg, idx) => {
        const visualFrac = visualFractions[idx] ?? 0;
        if (visualFrac <= 0) return null;
        const startOffset = running * CIRCUMFERENCE + SEGMENT_GAP / 2;
        const sweepDeg = visualFrac * 360;
        const startDeg = running * 360 - 90;
        const midAngleDeg = startDeg + sweepDeg / 2;
        running += visualFrac;
        const dash = Math.max(0, visualFrac * CIRCUMFERENCE - SEGMENT_GAP);
        return {
          id: seg.id,
          name: seg.name,
          index: idx,
          dash,
          startOffset,
          midAngleDeg,
          sweepDeg,
          baseOpacity: segmentOpacity(idx),
        };
      })
      .filter((arc): arc is NonNullable<typeof arc> => arc != null);
  }, [segments, visualFractions]);

  const segmentLabels: SegmentLabel[] = useMemo(
    () =>
      segmentArcs.map((arc) => ({
        id: arc.id,
        name: arc.name,
        midAngleDeg: arc.midAngleDeg,
        sweepDeg: arc.sweepDeg,
        baseOpacity: arc.baseOpacity,
      })),
    [segmentArcs],
  );

  const trackColor = isLight ? colors.border : colors.scopeTrack;
  const hubColor = colors.containerBackground;
  const hasSelection = Boolean(selectedId);

  const rotation = useSharedValue(0);
  const startTouchAngle = useSharedValue(0);
  const savedRotation = useSharedValue(0);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(10)
        .onBegin((event) => {
          const angle = Math.atan2(event.y - CY, event.x - CX);
          startTouchAngle.value = angle;
          savedRotation.value = rotation.value;
        })
        .onUpdate((event) => {
          const angle = Math.atan2(event.y - CY, event.x - CX);
          let delta = angle - startTouchAngle.value;
          if (delta > Math.PI) delta -= 2 * Math.PI;
          if (delta < -Math.PI) delta += 2 * Math.PI;
          rotation.value = savedRotation.value + (delta * 180) / Math.PI;
        }),
    [rotation, savedRotation, startTouchAngle],
  );

  const animatedGroupProps = useAnimatedProps(() => ({
    rotation: rotation.value,
    origin: `${CX}, ${CY}`,
  }));

  return (
    <View onLayout={onLayout} style={styles.chartBlock}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.chartHalo}>
          <Svg width={SVG_SIZE} height={SVG_SIZE} style={styles.chartSvg}>
            <Defs>
              <Filter id="budgetSegGlow" x="-30%" y="-30%" width="160%" height="160%">
                <FeDropShadow dx={0} dy={0} stdDeviation={4} floodColor={accentColor} floodOpacity={0.53} />
              </Filter>
            </Defs>

            <Circle
              cx={CX}
              cy={CY}
              r={RADIUS}
              stroke={trackColor}
              strokeWidth={STROKE + 2}
              fill="none"
            />
            <Circle
              cx={CX}
              cy={CY}
              r={RADIUS - 28}
              stroke={colors.border}
              strokeWidth={1}
              fill="none"
              opacity={0.55}
            />

            <AnimatedG animatedProps={animatedGroupProps}>
              {segmentArcs.map((arc) => {
                const selected = selectedId === arc.id;
                const dimmed = hasSelection && !selected;

                return (
                  <DonutSegment
                    key={arc.id}
                    index={arc.index}
                    dash={arc.dash}
                    startOffset={arc.startOffset}
                    baseOpacity={arc.baseOpacity}
                    dimmed={dimmed}
                    accentColor={accentColor}
                    segmentId={arc.id}
                    onSelectSegment={onSelectSegment}
                  />
                );
              })}

              {segmentLabels.map((label) => {
                if (label.sweepDeg < MIN_LABEL_SWEEP_DEG) return null;

                const selected = selectedId === label.id;
                const dimmed = hasSelection && !selected;
                const labelOpacity = dimmed ? label.baseOpacity * 0.42 : label.baseOpacity;
                const inner = polarToXY(LEADER_INNER, label.midAngleDeg);
                const outer = polarToXY(LEADER_OUTER, label.midAngleDeg);
                const anchor = polarToXY(LABEL_RADIUS, label.midAngleDeg);
                const onRight = Math.cos((label.midAngleDeg * Math.PI) / 180) >= 0;
                const textX = anchor.x + (onRight ? 4 : -4);
                const textAnchor = onRight ? 'start' : 'end';
                const lineColor = selected ? accentColor : mutedTextColor;
                const textColor = selected ? colors.text : mutedTextColor;

                return (
                  <G key={`label-${label.id}`}>
                    <Line
                      x1={inner.x}
                      y1={inner.y}
                      x2={outer.x}
                      y2={outer.y}
                      stroke={lineColor}
                      strokeWidth={selected ? 1.25 : 1}
                      strokeOpacity={labelOpacity}
                    />
                    <SvgText
                      x={textX}
                      y={anchor.y}
                      fill={textColor}
                      fontSize={typography.micro}
                      fontWeight={selected ? '700' : '500'}
                      textAnchor={textAnchor}
                      alignmentBaseline="middle"
                      opacity={labelOpacity}
                    >
                      {truncateLabel(label.name)}
                    </SvgText>
                  </G>
                );
              })}
            </AnimatedG>
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
            <Text style={[styles.hubMeta, { color: accentColor }]}>
              {`${formatMoney(totalSpent)} dépensé`}
            </Text>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  chartBlock: { alignItems: 'center', paddingVertical: spacing.sm },
  chartHalo: {
    width: SVG_SIZE,
    height: SVG_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartSvg: { position: 'absolute' },
  hub: {
    width: DONUT_SIZE - STROKE * 2 - 18,
    height: DONUT_SIZE - STROKE * 2 - 18,
    borderRadius: (DONUT_SIZE - STROKE * 2 - 18) / 2,
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
});

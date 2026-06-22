import { memo, useCallback, useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useSharedValue,
  withDecay,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, FeDropShadow, Filter, G, Line, Text as SvgText } from 'react-native-svg';
import {
  interBoldText,
  interExtraBoldText,
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
const LABEL_MARGIN = 58;
const SVG_SIZE = DONUT_SIZE + LABEL_MARGIN * 2;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;
const LEADER_INNER = RADIUS + STROKE / 2 + 2;
const LEADER_OUTER = LEADER_INNER + 12;
const LABEL_RADIUS = LEADER_OUTER + 6;
const MIN_LABEL_SWEEP_DEG = 14;
const MAX_LABEL_CHARS = 10;
const ROTATION_MIN_DISTANCE = 6;
// Lower = the donut turns slower relative to the finger (less sensitive).
const ROTATION_SENSITIVITY = 0.6;
// Ignore rotation when the finger is this close to the center, where the
// angle is unstable and tiny moves would otherwise spin the donut wildly.
const ROTATION_DEAD_ZONE = 28;
const ROTATION_DECAY = 0.99;
const ROTATION_MAX_VELOCITY = 240;
const ROTATION_MIN_DECAY_VELOCITY = 18;
const RING_INNER = RADIUS - STROKE / 2 - 4;
const RING_OUTER = RADIUS + STROKE / 2 + 28;

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);

type RotatingLabelProps = {
  rotation: SharedValue<number>;
  x: number;
  y: number;
  fill: string;
  fontWeight: '500' | '700';
  opacity: number;
  text: string;
};

/**
 * Rendered inside the rotating group so its anchor point follows the donut,
 * but counter-rotates around its own anchor so the text stays upright/readable.
 */
const RotatingLabel = memo(function RotatingLabel({
  rotation,
  x,
  y,
  fill,
  fontWeight,
  opacity,
  text,
}: RotatingLabelProps) {
  const animatedProps = useAnimatedProps(() => ({
    transform: `rotate(${-rotation.value}, ${x}, ${y})`,
  }));

  return (
    <AnimatedSvgText
      animatedProps={animatedProps}
      x={x}
      y={y}
      fill={fill}
      fontSize={typography.micro}
      fontWeight={fontWeight}
      textAnchor="middle"
      alignmentBaseline="middle"
      opacity={opacity}
    >
      {text}
    </AnimatedSvgText>
  );
});

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

const TWELVE_OCLOCK_OFFSET = CIRCUMFERENCE / 4;

type DonutSegmentProps = {
  index: number;
  dash: number;
  startOffset: number;
  baseOpacity: number;
  dimmed: boolean;
  accentColor: string;
};

const DonutSegment = memo(function DonutSegment({
  index,
  dash,
  startOffset,
  baseOpacity,
  dimmed,
  accentColor,
}: DonutSegmentProps) {
  const opacity = dimmed ? baseOpacity * 0.38 : baseOpacity;

  return (
    <Circle
      cx={CX}
      cy={CY}
      r={RADIUS}
      stroke={accentColor}
      strokeWidth={STROKE}
      fill="none"
      strokeOpacity={opacity}
      strokeLinecap="butt"
      strokeDasharray={[dash, CIRCUMFERENCE - dash]}
      strokeDashoffset={-(startOffset + TWELVE_OCLOCK_OFFSET)}
      filter={index === 0 && Platform.OS !== 'android' ? 'url(#budgetSegGlow)' : undefined}
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
  /** Locks parent scroll (e.g. FlatList) while the chart is being dragged. */
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
};

export const BudgetAllocationChart = memo(function BudgetAllocationChart({
  segments,
  totalAllocated,
  totalSpent,
  selectedId = null,
  onSelectSegment,
  onLayout,
  onInteractionStart,
  onInteractionEnd,
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
  const prevTouchAngle = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const notifyInteractionStart = useCallback(() => {
    onInteractionStart?.();
  }, [onInteractionStart]);

  const notifyInteractionEnd = useCallback(() => {
    onInteractionEnd?.();
  }, [onInteractionEnd]);

  const handleSegmentTap = useCallback(
    (x: number, y: number, currentRotation: number) => {
      if (!onSelectSegment) return;

      const dx = x - CX;
      const dy = y - CY;
      const dist = Math.hypot(dx, dy);
      if (dist < RING_INNER || dist > RING_OUTER) return;

      let touchAngle = (Math.atan2(dy, dx) * 180) / Math.PI - currentRotation;
      touchAngle = ((touchAngle % 360) + 360) % 360;

      for (const arc of segmentArcs) {
        let start = arc.midAngleDeg - arc.sweepDeg / 2;
        let end = arc.midAngleDeg + arc.sweepDeg / 2;
        start = ((start % 360) + 360) % 360;
        end = ((end % 360) + 360) % 360;

        const inRange =
          start <= end
            ? touchAngle >= start && touchAngle <= end
            : touchAngle >= start || touchAngle <= end;

        if (inRange) {
          tapHaptic();
          onSelectSegment(arc.id);
          return;
        }
      }
    },
    [onSelectSegment, segmentArcs],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(ROTATION_MIN_DISTANCE)
        .onBegin(() => {
          isDragging.value = true;
          if (onInteractionStart) {
            runOnJS(notifyInteractionStart)();
          }
        })
        .onStart((event) => {
          cancelAnimation(rotation);
          prevTouchAngle.value = Math.atan2(event.y - CY, event.x - CX);
        })
        .onUpdate((event) => {
          const dx = event.x - CX;
          const dy = event.y - CY;
          const angle = Math.atan2(dy, dx);
          let delta = angle - prevTouchAngle.value;
          prevTouchAngle.value = angle;
          if (delta > Math.PI) delta -= 2 * Math.PI;
          if (delta < -Math.PI) delta += 2 * Math.PI;
          // Near the center the angle is unstable, so skip rotation there while
          // still tracking the angle to avoid a jump when the finger moves out.
          if (Math.hypot(dx, dy) < ROTATION_DEAD_ZONE) return;
          rotation.value += ((delta * 180) / Math.PI) * ROTATION_SENSITIVITY;
        })
        .onEnd((event) => {
          const dx = event.x - CX;
          const dy = event.y - CY;
          const radiusSq = dx * dx + dy * dy;
          if (radiusSq >= ROTATION_DEAD_ZONE * ROTATION_DEAD_ZONE) {
            let angularVelocityDeg =
              ((dx * event.velocityY - dy * event.velocityX) / radiusSq) *
              (180 / Math.PI) *
              ROTATION_SENSITIVITY;
            angularVelocityDeg = Math.max(
              -ROTATION_MAX_VELOCITY,
              Math.min(ROTATION_MAX_VELOCITY, angularVelocityDeg),
            );
            if (Math.abs(angularVelocityDeg) >= ROTATION_MIN_DECAY_VELOCITY) {
              rotation.value = withDecay({
                velocity: angularVelocityDeg,
                deceleration: ROTATION_DECAY,
              });
            }
          }

          isDragging.value = false;
          if (onInteractionEnd) {
            runOnJS(notifyInteractionEnd)();
          }
        })
        .onFinalize(() => {
          if (isDragging.value) {
            isDragging.value = false;
            if (onInteractionEnd) {
              runOnJS(notifyInteractionEnd)();
            }
          }
        }),
    [
      isDragging,
      notifyInteractionEnd,
      notifyInteractionStart,
      onInteractionEnd,
      onInteractionStart,
      prevTouchAngle,
      rotation,
    ],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .onEnd((event) => {
          if (!onSelectSegment) return;
          runOnJS(handleSegmentTap)(event.x, event.y, rotation.value);
        }),
    [handleSegmentTap, onSelectSegment, rotation],
  );

  const chartGesture = useMemo(
    () => Gesture.Exclusive(panGesture, tapGesture),
    [panGesture, tapGesture],
  );

  const animatedGroupProps = useAnimatedProps(() => ({
    transform: `rotate(${rotation.value}, ${CX}, ${CY})`,
  }));

  const segmentLabelNodes = segmentLabels.map((label) => {
    if (label.sweepDeg < MIN_LABEL_SWEEP_DEG) return null;

    const selected = selectedId === label.id;
    const dimmed = hasSelection && !selected;
    const labelOpacity = dimmed ? label.baseOpacity * 0.42 : label.baseOpacity;
    const inner = polarToXY(LEADER_INNER, label.midAngleDeg);
    const outer = polarToXY(LEADER_OUTER, label.midAngleDeg);
    const anchor = polarToXY(LABEL_RADIUS, label.midAngleDeg);
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
        <RotatingLabel
          rotation={rotation}
          x={anchor.x}
          y={anchor.y}
          fill={textColor}
          fontWeight={selected ? '700' : '500'}
          opacity={labelOpacity}
          text={truncateLabel(label.name)}
        />
      </G>
    );
  });

  return (
    <View onLayout={onLayout} style={styles.chartBlock}>
      <GestureDetector gesture={chartGesture}>
        <View style={styles.chartHalo} collapsable={false}>
          <Svg
            width={SVG_SIZE}
            height={SVG_SIZE}
            style={styles.chartSvg}
            pointerEvents="none"
          >
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
                  />
                );
              })}

              {segmentLabelNodes}
            </AnimatedG>
          </Svg>

          <View style={styles.touchOverlay} collapsable={false} />

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
    overflow: 'visible',
  },
  chartSvg: { position: 'absolute' },
  chartSvgLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  touchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
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

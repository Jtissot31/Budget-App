import { memo, useCallback, useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, FeDropShadow, Filter, Line } from 'react-native-svg';
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
const LABEL_MARGIN = 92;
const SVG_SIZE = DONUT_SIZE + LABEL_MARGIN * 2;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;
const LEADER_INNER = RADIUS + STROKE / 2 + 4;
const LABEL_RADIUS = LEADER_INNER + 14;
const LABEL_RADIUS_STAGGER = 32;
const LABEL_CHAR_WIDTH = 6.5;
const MAX_LABEL_CHARS = 9;
const ROTATION_MIN_DISTANCE = 4;
const ROTATION_SCROLL_VERTICAL_THRESHOLD = 14;
// Lower = the donut turns slower relative to the finger (less sensitive).
const ROTATION_SENSITIVITY = 0.9;
// Ignore rotation when the finger is this close to the center, where the
// angle is unstable and tiny moves would otherwise spin the donut wildly.
const ROTATION_DEAD_ZONE = 28;
const ROTATION_DECAY = 0.99;
const ROTATION_MAX_VELOCITY = 240;
const ROTATION_MIN_DECAY_VELOCITY = 18;
const RING_INNER = RADIUS - STROKE / 2 - 4;
const RING_OUTER = RADIUS + STROKE / 2 + 58;

function segmentOpacity(index: number) {
  if (index === 0) return 1;
  if (index === 1) return 0.55;
  if (index === 2) return 0.25;
  return Math.max(0.1, 0.25 - (index - 2) * 0.04);
}

/** Labels stay readable even on small / lower-ranked segments. */
function labelOpacity(index: number) {
  return Math.max(0.58, segmentOpacity(index));
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
  const primary = name.split('/')[0]?.trim() ?? name.trim();
  if (primary.length <= maxLen) return primary;
  return `${primary.slice(0, maxLen - 1)}…`;
}

function estimateTextHalfWidth(name: string) {
  return (truncateLabel(name).length * LABEL_CHAR_WIDTH) / 2;
}

function angleWithinSegment(angleDeg: number, startDeg: number, endDeg: number) {
  const angle = normalizeAngleDeg(angleDeg);
  const start = normalizeAngleDeg(startDeg);
  const end = normalizeAngleDeg(endDeg);

  if (start <= end) {
    return angle >= start && angle <= end;
  }
  return angle >= start || angle <= end;
}

function clampAngleToSegment(angleDeg: number, startDeg: number, endDeg: number) {
  const angle = normalizeAngleDeg(angleDeg);
  const start = normalizeAngleDeg(startDeg);
  const end = normalizeAngleDeg(endDeg);

  if (angleWithinSegment(angle, start, end)) return angle;

  const distToStart = Math.min(circularAngleGap(angle, start), circularAngleGap(start, angle));
  const distToEnd = Math.min(circularAngleGap(angle, end), circularAngleGap(end, angle));
  return distToStart <= distToEnd ? start : end;
}

function normalizeAngleDeg(angleDeg: number) {
  return ((angleDeg % 360) + 360) % 360;
}

function circularAngleGap(fromDeg: number, toDeg: number) {
  return normalizeAngleDeg(toDeg - fromDeg);
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

type AnimatedSegmentLabelRuntimeProps = {
  rotation: SharedValue<number>;
  text: string;
  color: string;
  opacity: number;
  selected: boolean;
};

/** Factory bakes midAngleDeg into the worklet closure — fixes Android label clustering. */
function createSegmentLabelComponent(
  bakedMidAngleDeg: number,
  bakedLabelRadius: number,
  bakedTextHalfWidth: number,
) {
  const bakedTextHalfHeight = typography.micro / 2;

  return memo(function SegmentLabelInstance({
    rotation,
    text,
    color,
    opacity,
    selected,
  }: AnimatedSegmentLabelRuntimeProps) {
    const positionStyle = useAnimatedStyle(() => {
      'worklet';
      const rad = ((bakedMidAngleDeg + rotation.value) * Math.PI) / 180;
      const x = bakedLabelRadius * Math.cos(rad);
      const y = bakedLabelRadius * Math.sin(rad);
      return {
        position: 'absolute',
        left: CX + x - bakedTextHalfWidth,
        top: CY + y - bakedTextHalfHeight,
      };
    });

    const rotateStyle = useAnimatedStyle(() => {
      'worklet';
      return {
        transform: [{ rotate: `${-rotation.value}deg` }],
      };
    });

    return (
      <Animated.View style={[styles.labelAnchor, positionStyle, { opacity }]} pointerEvents="none">
        <Animated.View style={rotateStyle}>
          <Text
            style={[
              styles.labelText,
              selected ? interBoldText : interMediumText,
              { color, fontSize: typography.micro },
            ]}
            numberOfLines={1}
          >
            {text}
          </Text>
        </Animated.View>
      </Animated.View>
    );
  });
}

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

type SegmentLabelInput = {
  id: string;
  name: string;
  midAngleDeg: number;
  startDeg: number;
  endDeg: number;
  labelOpacity: number;
};

type SegmentLabel = SegmentLabelInput & {
  labelAngleDeg: number;
  /** Text center radius — one per segment at its midAngleDeg. */
  labelRadius: number;
  /** Leader line stops at the inner edge of the label text. */
  lineEndRadius: number;
};

function layoutSegmentLabels(labels: SegmentLabelInput[]): SegmentLabel[] {
  if (labels.length === 0) return [];

  const sorted = [...labels].sort(
    (a, b) => normalizeAngleDeg(a.midAngleDeg) - normalizeAngleDeg(b.midAngleDeg),
  );

  return sorted.map((label, index) => {
    const prev = sorted[(index - 1 + sorted.length) % sorted.length]!;
    const next = sorted[(index + 1) % sorted.length]!;
    const gapPrev = circularAngleGap(prev.midAngleDeg, label.midAngleDeg);
    const gapNext = circularAngleGap(label.midAngleDeg, next.midAngleDeg);
    const minGap = Math.min(gapPrev, gapNext);
    const tier =
      minGap < 16 ? 1 + (index % 6) : minGap < 26 ? 1 + (index % 4) : index % 2 === 1 ? 1 : 0;
    const labelRadius = LABEL_RADIUS + tier * LABEL_RADIUS_STAGGER;
    const textHalfWidth = estimateTextHalfWidth(label.name);

    return {
      ...label,
      labelAngleDeg: clampAngleToSegment(label.midAngleDeg, label.startDeg, label.endDeg),
      labelRadius,
      lineEndRadius: labelRadius - textHalfWidth,
    };
  });
}

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
    return segments.map((seg, idx) => {
      const rawFrac = visualFractions[idx] ?? 0;
      const visualFrac = rawFrac > 0 ? rawFrac : 1 / Math.max(segments.length, 1);
      const startOffset = running * CIRCUMFERENCE + SEGMENT_GAP / 2;
      const sweepDeg = visualFrac * 360;
      const startDeg = running * 360 - 90;
      const endDeg = startDeg + sweepDeg;
      const midAngleDeg = startDeg + sweepDeg / 2;
      running += visualFrac;
      const dash = Math.max(0, visualFrac * CIRCUMFERENCE - SEGMENT_GAP);
      // Each segment gets a unique midAngleDeg (e.g. seg0 ~0°, small segs ~100°–264°).
      return {
        id: seg.id,
        name: seg.name,
        index: idx,
        dash,
        startOffset,
        startDeg,
        endDeg,
        midAngleDeg,
        sweepDeg,
        segmentOpacity: segmentOpacity(idx),
        labelOpacity: labelOpacity(idx),
      };
    });
  }, [segments, visualFractions]);

  const segmentLabels = useMemo(
    () =>
      layoutSegmentLabels(
        segmentArcs.map((arc) => ({
          id: arc.id,
          name: arc.name,
          midAngleDeg: arc.midAngleDeg,
          startDeg: arc.startDeg,
          endDeg: arc.endDeg,
          labelOpacity: arc.labelOpacity,
        })),
      ),
    [segmentArcs],
  );

  const segmentLabelRenderers = useMemo(() => {
    if (__DEV__) {
      console.log(
        '[DonutLabels] midAngleDeg:',
        segmentLabels.map((l) => `${l.name}=${l.midAngleDeg.toFixed(1)}°`).join(', '),
      );
    }
    return segmentLabels.map((label) => ({
      id: label.id,
      Component: createSegmentLabelComponent(
        label.labelAngleDeg,
        label.labelRadius,
        estimateTextHalfWidth(label.name),
      ),
      label,
    }));
  }, [segmentLabels]);

  const trackColor = isLight ? colors.border : colors.scopeTrack;
  const hubColor = colors.containerBackground;
  const hasSelection = Boolean(selectedId);

  const rotation = useSharedValue(0);
  const prevTouchAngle = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const rotationActivated = useSharedValue(false);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);

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
        .manualActivation(true)
        .onTouchesDown((event) => {
          const touch = event.allTouches[0];
          if (!touch) return;
          touchStartX.value = touch.x;
          touchStartY.value = touch.y;
          rotationActivated.value = false;
        })
        .onTouchesMove((event, state) => {
          const touch = event.allTouches[0];
          if (!touch) return;

          const dx = touch.x - touchStartX.value;
          const dy = touch.y - touchStartY.value;
          const travel = Math.hypot(dx, dy);
          if (travel < ROTATION_MIN_DISTANCE) return;

          const rx = touch.x - CX;
          const ry = touch.y - CY;
          const radialLen = Math.hypot(rx, ry);
          if (radialLen < RING_INNER || radialLen > RING_OUTER) {
            state.fail();
            return;
          }

          const nx = rx / radialLen;
          const ny = ry / radialLen;
          const tx = -ny;
          const ty = nx;
          const tangential = Math.abs(dx * tx + dy * ty);
          const vertical = Math.abs(dy);

          if (vertical > tangential * 2.2 && vertical > ROTATION_SCROLL_VERTICAL_THRESHOLD) {
            state.fail();
            return;
          }

          state.activate();
        })
        .onStart((event) => {
          rotationActivated.value = true;
          isDragging.value = true;
          cancelAnimation(rotation);
          prevTouchAngle.value = Math.atan2(event.y - CY, event.x - CX);
          if (onInteractionStart) {
            runOnJS(notifyInteractionStart)();
          }
        })
        .onUpdate((event) => {
          const dx = event.x - CX;
          const dy = event.y - CY;
          const angle = Math.atan2(dy, dx);
          let delta = angle - prevTouchAngle.value;
          prevTouchAngle.value = angle;
          if (delta > Math.PI) delta -= 2 * Math.PI;
          if (delta < -Math.PI) delta += 2 * Math.PI;
          if (Math.hypot(dx, dy) < ROTATION_DEAD_ZONE) return;
          rotation.value += ((delta * 180) / Math.PI) * ROTATION_SENSITIVITY;
        })
        .onEnd((event) => {
          if (!rotationActivated.value) return;

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

          rotationActivated.value = false;
          isDragging.value = false;
          if (onInteractionEnd) {
            runOnJS(notifyInteractionEnd)();
          }
        })
        .onFinalize(() => {
          if (rotationActivated.value) {
            rotationActivated.value = false;
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
      rotationActivated,
      touchStartX,
      touchStartY,
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

  const rotatingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const leaderLineNodes = segmentLabels.map((label) => {
    const selected = selectedId === label.id;
    const dimmed = hasSelection && !selected;
    const opacity = dimmed ? label.labelOpacity * 0.42 : label.labelOpacity;
    const inner = polarToXY(LEADER_INNER, label.labelAngleDeg);
    const lineEnd = polarToXY(label.lineEndRadius, label.labelAngleDeg);
    const lineColor = selected ? accentColor : mutedTextColor;

    return (
      <Line
        key={`line-${label.id}`}
        x1={inner.x}
        y1={inner.y}
        x2={lineEnd.x}
        y2={lineEnd.y}
        stroke={lineColor}
        strokeWidth={selected ? 1.25 : 1}
        strokeOpacity={opacity}
      />
    );
  });

  return (
    <View onLayout={onLayout} style={styles.chartBlock}>
      <GestureDetector gesture={chartGesture}>
        <View style={styles.chartHalo} collapsable={false}>
          <Animated.View style={[styles.chartSvg, rotatingStyle]} pointerEvents="none">
            <Svg width={SVG_SIZE} height={SVG_SIZE} pointerEvents="none">
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

              {segmentArcs.map((arc) => {
                const selected = selectedId === arc.id;
                const dimmed = hasSelection && !selected;

                return (
                  <DonutSegment
                    key={arc.id}
                    index={arc.index}
                    dash={arc.dash}
                    startOffset={arc.startOffset}
                    baseOpacity={arc.segmentOpacity}
                    dimmed={dimmed}
                    accentColor={accentColor}
                  />
                );
              })}

              {leaderLineNodes}
            </Svg>
          </Animated.View>

          <View style={styles.labelsOverlay} pointerEvents="none" collapsable={false}>
            {segmentLabelRenderers.map(({ id, Component, label }) => {
              const selected = selectedId === label.id;
              const dimmed = hasSelection && !selected;
              const opacity = dimmed ? label.labelOpacity * 0.42 : label.labelOpacity;
              const textColor = selected ? colors.text : mutedTextColor;

              return (
                <Component
                  key={`label-${id}`}
                  rotation={rotation}
                  text={truncateLabel(label.name)}
                  color={textColor}
                  opacity={opacity}
                  selected={selected}
                />
              );
            })}
          </View>

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
  chartBlock: { alignItems: 'center', paddingVertical: spacing.sm, overflow: 'visible' },
  chartHalo: {
    width: SVG_SIZE,
    height: SVG_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  chartSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SVG_SIZE,
    height: SVG_SIZE,
  },
  labelsOverlay: {
    ...StyleSheet.absoluteFillObject,
    width: SVG_SIZE,
    height: SVG_SIZE,
    overflow: 'visible',
    zIndex: 1,
  },
  labelAnchor: {
    overflow: 'visible',
  },
  labelText: {
    textAlign: 'center',
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

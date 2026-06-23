import { memo, useCallback, useEffect, useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
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
const ROTATION_MIN_DISTANCE = 4;
const ROTATION_SCROLL_VERTICAL_THRESHOLD = 14;
// Lower = the donut turns slower relative to the finger (less sensitive).
const ROTATION_SENSITIVITY = 0.9;
// Ignore rotation when the finger is this close to the center.
const ROTATION_DEAD_ZONE = 28;
const ROTATION_DECAY = 0.99;
const ROTATION_MAX_VELOCITY = 240;
const ROTATION_MIN_DECAY_VELOCITY = 18;
const RING_INNER = RADIUS - STROKE / 2 - 4;
const RING_OUTER = RADIUS + STROKE / 2 + 58;
const TWELVE_OCLOCK_OFFSET = CIRCUMFERENCE / 4;
const MAX_LABEL_CHARS = 12;

// ─── Option C elbow-line geometry ────────────────────────────────────────────
// Outer edge of the ring stroke.
const OUTER_RADIUS = RADIUS + STROKE / 2; // 124
// Waypoint circle: the elbow of the bent leader line.
const WAYPOINT_RADIUS = OUTER_RADIUS + 20; // 144
// Horizontal label anchors — computed per-frame in allPositions:
//   right: min(CX + OUTER_RADIUS + 80, SVG_SIZE - 8) → 424
//   left:  max(CX - OUTER_RADIUS - 80, 8)            → 12
// Fixed-width text container.
const LABEL_BOX_WIDTH = 52;
// Half of two-line label block (9px name + 8px pct) for vertical centering.
const LABEL_HALF_HEIGHT = 9;
// Minimum vertical gap between labels in the same column.
const MIN_LABEL_GAP = 22;
// Segments with a sweep angle smaller than this receive no label.
const MIN_SWEEP_FOR_LABEL = 8;
// Consecutive segments closer than this get wy nudged apart before anti-collision.
const MIN_CONSECUTIVE_WY_GAP = 16;
const CONSECUTIVE_WY_NUDGE = 20;

// AnimatedLine: Reanimated-wrapped SVG Line — safe on Android because we drive
// numeric x1/y1/x2/y2 props directly (no SVG transform strings).
const AnimatedLine = Animated.createAnimatedComponent(Line);

// ─── Types ───────────────────────────────────────────────────────────────────

type LabelPos = {
  visible: boolean;
  x1: number; // segment mid-point on outer ring edge (start of diagonal leg)
  y1: number;
  wx: number; // waypoint / elbow
  wy: number;
  lx: number; // horizontal label anchor x (end of horizontal leg)
  ly: number; // label anchor y — collision-resolved
  isRight: boolean;
};

type SegmentDataItem = {
  midAngleDeg: number;
  sweepDeg: number;
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function segmentOpacity(index: number) {
  if (index === 0) return 1;
  if (index === 1) return 0.55;
  if (index === 2) return 0.25;
  return Math.max(0.1, 0.25 - (index - 2) * 0.04);
}

function labelOpacity(index: number) {
  return Math.max(0.58, segmentOpacity(index));
}

function formatMoney(value: number) {
  return formatDisplayMoneyAbsolute(Math.max(0, value));
}

function truncateLabel(name: string, maxLen = MAX_LABEL_CHARS) {
  const primary = name.split('/')[0]?.trim() ?? name.trim();
  if (primary.length <= maxLen) return primary;
  return `${primary.slice(0, maxLen - 1)}…`;
}

// ─── DonutSegment (ring arc) — unchanged ─────────────────────────────────────

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

// ─── Option C factories ───────────────────────────────────────────────────────

/**
 * Factory — creates an animated elbow-line pair (diagonal + horizontal) for one
 * segment.  Two separate useAnimatedProps calls at the top level of the
 * component satisfy React's rules of hooks while remaining inside a
 * react-native-svg <Svg> context.
 *
 * Android safety: all animated props are numeric (x1, y1, x2, y2,
 * strokeOpacity) — no SVG transform strings.
 */
function createOptionCElbowLine(bakedIndex: number) {
  return memo(function OptionCElbowLine({
    allPositions,
    stroke,
    opacity,
  }: {
    allPositions: Readonly<SharedValue<LabelPos[]>>;
    stroke: string;
    opacity: number;
  }) {
    const diagonalProps = useAnimatedProps(
      () => {
        'worklet';
        const pos = allPositions.value[bakedIndex];
        if (!pos?.visible) {
          return { x1: -999, y1: -999, x2: -999, y2: -999, strokeOpacity: 0 };
        }
        return {
          x1: pos.x1,
          y1: pos.y1,
          x2: pos.wx,
          y2: pos.wy,
          strokeOpacity: opacity * 0.7,
        };
      },
      [opacity],
    );

    const horizontalProps = useAnimatedProps(
      () => {
        'worklet';
        const pos = allPositions.value[bakedIndex];
        if (!pos?.visible) {
          return { x1: -999, y1: -999, x2: -999, y2: -999, strokeOpacity: 0 };
        }
        return {
          x1: pos.wx,
          y1: pos.wy,
          x2: pos.lx,
          y2: pos.ly,
          strokeOpacity: opacity * 0.7,
        };
      },
      [opacity],
    );

    return (
      <>
        <AnimatedLine animatedProps={diagonalProps} stroke={stroke} strokeWidth={1} />
        <AnimatedLine animatedProps={horizontalProps} stroke={stroke} strokeWidth={1} />
      </>
    );
  });
}

/**
 * Factory — creates an animated label view for one segment.
 *
 * bakedIsRight: determined at render time (rotation = 0).  Fixes text-align so
 * labels stay readable; if the donut is spun far enough that the segment
 * crosses the centre axis the anchor x still snaps to the correct column while
 * text-align remains stable.
 */
function createOptionCLabel(bakedIndex: number, bakedIsRight: boolean) {
  return memo(function OptionCLabel({
    allPositions,
    text,
    percentage,
    color,
    opacity,
    selected,
  }: {
    allPositions: Readonly<SharedValue<LabelPos[]>>;
    text: string;
    percentage?: string;
    color: string;
    opacity: number;
    selected: boolean;
  }) {
    const posStyle = useAnimatedStyle(() => {
      'worklet';
      const pos = allPositions.value[bakedIndex];
      if (!pos?.visible) {
        return { position: 'absolute', left: -9999, top: -9999 };
      }
      // Right-side labels: container starts at lx (text flows right).
      // Left-side labels: container ends at lx (text flows left inside box).
      const leftEdge = bakedIsRight ? pos.lx : pos.lx - LABEL_BOX_WIDTH;
      return {
        position: 'absolute',
        left: leftEdge,
        top: pos.ly - LABEL_HALF_HEIGHT,
      };
    });

    return (
      <Animated.View style={[posStyle, { opacity }]} pointerEvents="none">
        <Text
          style={[
            styles.optionCLabel,
            selected ? interBoldText : interMediumText,
            {
              color,
              fontSize: 9,
              textAlign: bakedIsRight ? 'left' : 'right',
            },
          ]}
          numberOfLines={1}
        >
          {text}
        </Text>
        {percentage ? (
          <Text
            style={[
              styles.optionCLabelPct,
              selected ? interBoldText : interMediumText,
              {
                color,
                fontSize: 8,
                textAlign: bakedIsRight ? 'left' : 'right',
              },
            ]}
            numberOfLines={1}
          >
            {percentage}
          </Text>
        ) : null}
      </Animated.View>
    );
  });
}

// ─── Main component ──────────────────────────────────────────────────────────

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

  // SharedValue holding static segment geometry.  Updated via useEffect when
  // the segment list changes (e.g. user edits budget categories).
  const segmentsDataSV = useSharedValue<SegmentDataItem[]>(
    segmentArcs.map((arc) => ({ midAngleDeg: arc.midAngleDeg, sweepDeg: arc.sweepDeg })),
  );

  useEffect(() => {
    segmentsDataSV.value = segmentArcs.map((arc) => ({
      midAngleDeg: arc.midAngleDeg,
      sweepDeg: arc.sweepDeg,
    }));
  }, [segmentArcs, segmentsDataSV]);

  const trackColor = isLight ? colors.border : colors.scopeTrack;
  const hubColor = colors.containerBackground;
  const hasSelection = Boolean(selectedId);

  // ─── Shared animation values ─────────────────────────────────────────────
  const rotation = useSharedValue(0);
  const prevTouchAngle = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const rotationActivated = useSharedValue(false);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);

  // ─── All label positions — recomputed every frame in a worklet ────────────
  //
  // Algorithm per frame:
  //   1. For each segment, compute midAngle = (midAngleDeg + rotation) in rad.
  //   2. x1/y1: point on the outer ring edge.
  //   3. wx/wy: waypoint on WAYPOINT_RADIUS circle (the elbow).
  //   4. lx: clamped horizontal anchor left or right of centre.
  //   5. Nudge consecutive close segments (small sweeps) apart.
  //   6. Anti-collision: sort labels in each column by wy, push down until
  //      all vertical gaps are ≥ MIN_LABEL_GAP (refined up to 3 passes).
  //
  // Android safety: all values are numbers — no SVG transform strings.
  const allPositions = useDerivedValue<LabelPos[]>(() => {
    'worklet';
    const segs = segmentsDataSV.value;
    const rot = rotation.value;

    // First pass: raw positions.
    const raw: LabelPos[] = segs.map((seg) => {
      if (seg.sweepDeg < MIN_SWEEP_FOR_LABEL) {
        return { visible: false, x1: 0, y1: 0, wx: 0, wy: 0, lx: 0, ly: 0, isRight: true };
      }
      const midRad = ((seg.midAngleDeg + rot) * Math.PI) / 180;
      const cosA = Math.cos(midRad);
      const sinA = Math.sin(midRad);
      const x1 = CX + OUTER_RADIUS * cosA;
      const y1 = CY + OUTER_RADIUS * sinA;
      const wx = CX + WAYPOINT_RADIUS * cosA;
      const wy = CY + WAYPOINT_RADIUS * sinA;
      const isRight = wx > CX;
      const lx = isRight
        ? Math.min(CX + OUTER_RADIUS + 80, SVG_SIZE - 8)
        : Math.max(CX - OUTER_RADIUS - 80, 8);
      return { visible: true, x1, y1, wx, wy, lx, ly: wy, isRight };
    });

    // Nudge consecutive segments whose waypoints are vertically too close.
    for (let i = 0; i < raw.length - 1; i++) {
      const p1 = raw[i];
      const p2 = raw[i + 1];
      if (!p1?.visible || !p2?.visible) continue;
      if (Math.abs(p1.wy - p2.wy) >= MIN_CONSECUTIVE_WY_GAP) continue;
      const seg1 = segs[i];
      const seg2 = segs[i + 1];
      if (!seg1 || !seg2) continue;
      if (seg1.sweepDeg <= seg2.sweepDeg) {
        p1.wy += Math.sign(p1.wy - CY) * CONSECUTIVE_WY_NUDGE;
        p1.ly = p1.wy;
      } else {
        p2.wy += Math.sign(p2.wy - CY) * CONSECUTIVE_WY_NUDGE;
        p2.ly = p2.wy;
      }
    }

    const resolveColumn = (isRightSide: boolean) => {
      const col: { idx: number; ly: number }[] = [];
      for (let i = 0; i < raw.length; i++) {
        const p = raw[i];
        if (p && p.visible && p.isRight === isRightSide) col.push({ idx: i, ly: p.ly });
      }
      col.sort((a, b) => a.ly - b.ly);
      for (let k = 1; k < col.length; k++) {
        const prev = col[k - 1]!;
        const curr = col[k]!;
        if (curr.ly - prev.ly < MIN_LABEL_GAP) curr.ly = prev.ly + MIN_LABEL_GAP;
      }
      for (let iter = 0; iter < 3; iter++) {
        col.sort((a, b) => a.ly - b.ly);
        let changed = false;
        for (let k = 1; k < col.length; k++) {
          const prev = col[k - 1]!;
          const curr = col[k]!;
          if (curr.ly - prev.ly < MIN_LABEL_GAP) {
            curr.ly = prev.ly + MIN_LABEL_GAP;
            changed = true;
          }
        }
        if (!changed) break;
      }
      for (const item of col) {
        const p = raw[item.idx];
        if (p) p.ly = item.ly;
      }
    };

    resolveColumn(false);
    resolveColumn(true);

    return raw;
  });

  // Factory instances for elbow lines and labels.  Created once per segment
  // layout change.  bakedIsRight is computed at rotation=0 so text-align is
  // stable across typical user rotation ranges.
  const elbowRenderers = useMemo(() => {
    return segmentArcs.map((arc, i) => {
      const midRad = (arc.midAngleDeg * Math.PI) / 180;
      const initialWx = CX + WAYPOINT_RADIUS * Math.cos(midRad);
      const bakedIsRight = initialWx > CX;
      const pct = Math.round((arc.sweepDeg / 360) * 100);
      return {
        key: arc.id,
        segmentId: arc.id,
        name: arc.name,
        percentage: `${pct}%`,
        segLabelOpacity: arc.labelOpacity,
        ElbowLine: createOptionCElbowLine(i),
        ElbowLabel: createOptionCLabel(i, bakedIsRight),
      };
    });
  }, [segmentArcs]);

  // ─── Gesture callbacks ───────────────────────────────────────────────────
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

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <View onLayout={onLayout} style={styles.chartBlock}>
      <GestureDetector gesture={chartGesture}>
        <View style={styles.chartHalo} collapsable={false}>

          {/* ── Rotating ring + segment arcs ── */}
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
            </Svg>
          </Animated.View>

          {/* ── Static SVG overlay — animated elbow lines ──
              NOT inside the rotating view.  Each AnimatedLine updates via
              useAnimatedProps using numeric x1/y1/x2/y2 (no SVG transforms). */}
          <View style={styles.chartSvg} pointerEvents="none">
            <Svg width={SVG_SIZE} height={SVG_SIZE} pointerEvents="none">
              {elbowRenderers.map(({ key, segmentId, ElbowLine, segLabelOpacity }) => {
                const selected = selectedId === segmentId;
                const dimmed = hasSelection && !selected;
                const lineOpacity = dimmed ? segLabelOpacity * 0.42 : segLabelOpacity;
                const lineColor = selected ? accentColor : mutedTextColor;
                return (
                  <ElbowLine
                    key={`eline-${key}`}
                    allPositions={allPositions}
                    stroke={lineColor}
                    opacity={lineOpacity}
                  />
                );
              })}
            </Svg>
          </View>

          {/* ── Labels overlay (RN Views, not SVG) ── */}
          <View style={styles.labelsOverlay} pointerEvents="none" collapsable={false}>
            {elbowRenderers.map(({ key, segmentId, name, percentage, ElbowLabel, segLabelOpacity }) => {
              const selected = selectedId === segmentId;
              const dimmed = hasSelection && !selected;
              const opacity = dimmed ? segLabelOpacity * 0.42 : segLabelOpacity;
              const textColor = selected ? colors.text : mutedTextColor;
              return (
                <ElbowLabel
                  key={`elabel-${key}`}
                  allPositions={allPositions}
                  text={truncateLabel(name)}
                  percentage={percentage}
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
  optionCLabel: {
    width: LABEL_BOX_WIDTH,
    overflow: 'hidden',
  },
  optionCLabelPct: {
    width: LABEL_BOX_WIDTH,
    overflow: 'hidden',
    marginTop: 1,
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

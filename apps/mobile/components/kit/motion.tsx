/**
 * Motion primitives — one consistent feel across the app.
 *
 * - `PressScale`    spring scale-down on press (replaces flat opacity feedback)
 * - `Reveal`        fade + rise on mount, staggered by `index`
 * - `AnimatedBar`   progress fill that grows from 0 when it mounts / changes
 * - `useCountUp`    eases a number toward its target (hero amounts)
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle, type PressableProps } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

/* ───────────────────────── PressScale ───────────────────────── */

type PressScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed (0.97 rows, 0.94 buttons). */
  scaleTo?: number;
  children: ReactNode;
};

export function PressScale({ style, scaleTo = 0.97, children, onPressIn, onPressOut, ...rest }: PressScaleProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, SPRING));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, SPRING));
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

/* ───────────────────────── Reveal ───────────────────────── */

export function Reveal({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      Math.min(index, 8) * 45,
      withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
    );
  }, [index, progress]);
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 10 }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/* ───────────────────────── AnimatedBar ───────────────────────── */

export function AnimatedBar({
  progress,
  color,
  trackColor,
  height = 4,
  delay = 0,
  style,
}: {
  progress: number;
  color: string;
  trackColor: string;
  height?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withDelay(delay, withTiming(clamped, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [clamped, delay, fill]);
  const animated = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View
      style={[
        { height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: trackColor },
        style,
      ]}
    >
      <Animated.View style={[{ height: '100%', borderRadius: height / 2, backgroundColor: color }, animated]} />
    </View>
  );
}

/* ───────────────────────── useCountUp ───────────────────────── */

/** Eases from the previous value to `target` over `duration` ms (JS-driven, one number). */
export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      setValue(next);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      fromRef.current = target;
    };
  }, [duration, target]);

  return value;
}

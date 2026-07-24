import type { ViewStyle } from 'react-native';
import { Easing } from 'react-native-reanimated';

/**
 * Shared micro-motion tokens — press feedback + page/sheet enter.
 * Keep durations in the 150–280ms band; no bounce spam.
 */
export const MOTION = {
  /** Pressable opacity when depressed (Onyx / cards). */
  pressOpacity: 0.82,
  /** Soft press for list rows / tab slots. */
  pressOpacitySoft: 0.88,
  /** Primary CTA / FAB press opacity. */
  pressOpacityStrong: 0.78,
  /** Card / row press scale. */
  pressScale: 0.975,
  /** Compact control / icon-tab press scale. */
  pressScaleCompact: 0.97,
  /** Page content enter. */
  pageEnterMs: 220,
  pageEnterTranslateY: 8,
  /** Sheet open / snap band. */
  sheetOpenMs: 260,
  /** Generic ease-out for Reanimated timings. */
  easeOut: Easing.out(Easing.cubic),
} as const;

type PressMotionOptions = {
  /** @default MOTION.pressScale */
  scale?: number;
  /** @default MOTION.pressOpacity */
  opacity?: number;
};

/**
 * Style applied when a Pressable is pressed — scale + opacity.
 * Prefer this (or Onyx / glass aliases) over ad-hoc `opacity: 0.7`.
 */
export function pressableMotionStyle(
  pressed: boolean,
  options?: PressMotionOptions,
): ViewStyle | undefined {
  if (!pressed) return undefined;
  return {
    opacity: options?.opacity ?? MOTION.pressOpacity,
    transform: [{ scale: options?.scale ?? MOTION.pressScale }],
  };
}

/** Softer press for dense list rows (transactions, agenda, settings). */
export function pressableRowMotionStyle(pressed: boolean): ViewStyle | undefined {
  return pressableMotionStyle(pressed, {
    opacity: MOTION.pressOpacitySoft,
    scale: MOTION.pressScale,
  });
}

/** Compact press for tab icons / small chrome controls. */
export function pressableCompactMotionStyle(pressed: boolean): ViewStyle | undefined {
  return pressableMotionStyle(pressed, {
    opacity: MOTION.pressOpacityStrong,
    scale: MOTION.pressScaleCompact,
  });
}

/** Moti / Reanimated timing config for page content enter. */
export const pageEnterTransition = {
  type: 'timing' as const,
  duration: MOTION.pageEnterMs,
};

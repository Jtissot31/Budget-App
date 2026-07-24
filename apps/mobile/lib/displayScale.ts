import { useWindowDimensions } from 'react-native';

/**
 * Display / accessibility scale helpers.
 *
 * Samsung devices (S25 Ultra) often combine a wide logical viewport with elevated
 * system font scale / display size. Uncapped scaling blows past fixed card columns
 * and chart labels — cap multipliers centrally, then shrink/ellipsis in dense UIs.
 */

/** Global Text / TextInput accessibility scale ceiling (app-wide default). */
export const APP_MAX_FONT_SIZE_MULTIPLIER = 1.25;

/**
 * Tighter ceiling for money amounts, table cells, and chart metrics that sit in
 * fixed or flex-shrink columns.
 */
export const MONEY_MAX_FONT_SIZE_MULTIPLIER = 1.15;

/** Narrow chat / card content width where dense widgets should compact. */
export const NARROW_CONTENT_WIDTH = 360;

/** Soft “dense layout” threshold for fontScale (system accessibility). */
export const DENSE_FONT_SCALE = 1.1;

export type DisplayScale = {
  width: number;
  height: number;
  fontScale: number;
  /** fontScale capped to {@link APP_MAX_FONT_SIZE_MULTIPLIER}. */
  cappedFontScale: number;
  /** Logical width below {@link NARROW_CONTENT_WIDTH}. */
  isNarrow: boolean;
  /** Narrow width and/or elevated system font scale. */
  isDense: boolean;
};

/**
 * Window metrics for responsive compact layouts (charts, debt tables, heroes).
 * Prefer this over ad-hoc `useWindowDimensions` when deciding shrink/ellipsis.
 */
export function useDisplayScale(): DisplayScale {
  const { width, height, fontScale } = useWindowDimensions();
  const cappedFontScale = Math.min(fontScale, APP_MAX_FONT_SIZE_MULTIPLIER);
  const isNarrow = width < NARROW_CONTENT_WIDTH;
  const isDense = isNarrow || fontScale >= DENSE_FONT_SCALE;
  return { width, height, fontScale, cappedFontScale, isNarrow, isDense };
}

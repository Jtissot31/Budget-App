import type { ViewStyle } from 'react-native';
import type { AppColors } from '@/constants/theme';

/** Green + button and speed-dial menus on Transactions (Historique / Agenda). */
export const SHOW_TRANSACTIONS_TAB_FABS = true;

/** Transactions Historique FAB — solid green style before blur experiment. */
// Revert: use TRANSACTIONS_FAB_STYLE_ORIGINAL + TRANSACTIONS_FAB_GLOW_ORIGINAL on the Pressable;
// set backgroundColor and shadowColor to colors.primary at the call site.

export const TRANSACTIONS_FAB_ICON_COLOR_ORIGINAL = '#000000';

/** Solid FAB diameter — green + and Agenda manage delete share this chrome. */
export const TRANSACTIONS_FAB_SIZE = 54;

/** Vertical breathing room between two stacked FABs. */
export const TRANSACTIONS_FAB_STACK_GAP = 12;

/**
 * Height the stacked voice FAB adds above the primary + — list bottom padding must clear it.
 * Both FABs share {@link TRANSACTIONS_FAB_SIZE}: same diameter, radius, halo and elevation.
 */
export const TRANSACTIONS_FAB_STACK_HEIGHT = TRANSACTIONS_FAB_SIZE + TRANSACTIONS_FAB_STACK_GAP;

export const TRANSACTIONS_FAB_GLOW_ORIGINAL: Pick<
  ViewStyle,
  'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
> = {
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.35,
  shadowRadius: 16,
  elevation: 12,
};

export const TRANSACTIONS_FAB_STYLE_ORIGINAL: ViewStyle = {
  width: TRANSACTIONS_FAB_SIZE,
  height: TRANSACTIONS_FAB_SIZE,
  borderRadius: TRANSACTIONS_FAB_SIZE / 2,
  alignItems: 'center',
  justifyContent: 'center',
  ...TRANSACTIONS_FAB_GLOW_ORIGINAL,
};

/** Solid accent FAB fill + matching colored elevation/halo (green + / danger trash / voice). */
export function transactionsSolidFabStyle(fillColor: string): ViewStyle {
  return {
    ...TRANSACTIONS_FAB_STYLE_ORIGINAL,
    backgroundColor: fillColor,
    shadowColor: fillColor,
  };
}

/**
 * Soft colored bloom behind solid FABs — keeps lift visible on Android where
 * `shadowColor` often collapses to a flat grey (or nothing in inspectors).
 */
export function transactionsSolidFabHaloStyle(fillColor: string): ViewStyle {
  return {
    position: 'absolute',
    width: TRANSACTIONS_FAB_SIZE,
    height: TRANSACTIONS_FAB_SIZE,
    borderRadius: TRANSACTIONS_FAB_SIZE / 2,
    backgroundColor: fillColor,
    opacity: 0.28,
    transform: [{ scale: 1.2 }],
  };
}

/**
 * Glass FAB chrome — blur via `TabBarDynamicBlur` / `GlassFab`.
 */
export const TRANSACTIONS_FAB_BLUR_BORDER = 'rgba(255, 255, 255, 0.28)';

export const TRANSACTIONS_FAB_GLOW_BLUR: Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
> = {
  shadowColor: '#22C55E',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.35,
  shadowRadius: 12,
  /** iOS only — Android must stay 0 so SemBlur samples content. */
  elevation: 8,
};

export const TRANSACTIONS_FAB_STYLE_BLUR: ViewStyle = {
  ...TRANSACTIONS_FAB_STYLE_ORIGINAL,
  backgroundColor: 'transparent',
  borderWidth: 1,
  borderColor: TRANSACTIONS_FAB_BLUR_BORDER,
  ...TRANSACTIONS_FAB_GLOW_BLUR,
};

/**
 * + / cross glyph on glass FABs — theme text (dark → white, light → black).
 * Prefer this over the legacy constant.
 */
export function transactionsFabGlyphColor(colors: AppColors): string {
  return colors.text;
}

/** @deprecated Use {@link transactionsFabGlyphColor} with `useAppTheme().colors`. */
export const TRANSACTIONS_FAB_ICON_COLOR_BLUR = '#000000';

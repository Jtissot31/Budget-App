import { StyleSheet, type ViewStyle } from 'react-native';
import type { AppColors } from '@/constants/theme';

/** Scroll chevron FABs (`accounts` / `budgets`). */
export const FLOATING_SCROLL_SIZE = 44;
export const FLOATING_SCROLL_RADIUS = FLOATING_SCROLL_SIZE / 2;
export const FLOATING_SCROLL_ICON_SIZE = 21;

/** Primary FABs (tab bar stack, recurring payments, standalone `Fab`). */
export const FLOATING_FAB_SIZE = 56;
export const FLOATING_FAB_RADIUS = FLOATING_FAB_SIZE / 2;
/** Keeps ~same icon-to-button ratio as scroll buttons (21 / 44). */
export const FLOATING_FAB_ICON_SIZE = Math.round((FLOATING_SCROLL_ICON_SIZE * FLOATING_FAB_SIZE) / FLOATING_SCROLL_SIZE);

/** Scale bespoke FAB interiors (e.g. AI scan graphic) from scroll baseline to FAB diameter. */
export const FLOATING_FAB_VISUAL_SCALE = FLOATING_FAB_SIZE / FLOATING_SCROLL_SIZE;

const floatingScrollGlassLayout: ViewStyle = {
  width: FLOATING_SCROLL_SIZE,
  height: FLOATING_SCROLL_SIZE,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: FLOATING_SCROLL_RADIUS,
  borderWidth: StyleSheet.hairlineWidth,
};

const floatingFabGlassLayout: ViewStyle = {
  width: FLOATING_FAB_SIZE,
  height: FLOATING_FAB_SIZE,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: FLOATING_FAB_RADIUS,
  borderWidth: StyleSheet.hairlineWidth,
};

export function floatingGlassScrollSurface(colors: AppColors, isLight: boolean): ViewStyle {
  return {
    ...floatingScrollGlassLayout,
    backgroundColor: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 18, 18, 0.92)',
    borderColor: colors.borderStrong,
  };
}

export function floatingGlassFabSurface(colors: AppColors, isLight: boolean): ViewStyle {
  return {
    ...floatingFabGlassLayout,
    backgroundColor: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 18, 18, 0.92)',
    borderColor: colors.borderStrong,
  };
}

export const floatingGlassButtonPressed = { opacity: 0.78 } as const;

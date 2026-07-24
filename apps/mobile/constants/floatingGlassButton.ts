import { type ViewStyle } from 'react-native';

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

/**
 * Distance above the safe-area bottom edge for absolute-positioned FABs in
 * full-screen contexts (e.g. modals without a tab bar). Equivalent thumb-reach
 * zone as the add-transaction FAB in the tab-bar stack.
 */
export const FLOATING_FAB_BOTTOM_OFFSET = 24;



/** Scale bespoke FAB interiors (e.g. AI scan graphic) from scroll baseline to FAB diameter. */

export const FLOATING_FAB_VISUAL_SCALE = FLOATING_FAB_SIZE / FLOATING_SCROLL_SIZE;



const floatingScrollGlassLayout: ViewStyle = {

  width: FLOATING_SCROLL_SIZE,

  height: FLOATING_SCROLL_SIZE,

  alignItems: 'center',

  justifyContent: 'center',

  borderRadius: FLOATING_SCROLL_RADIUS,

  borderWidth: 1,

};



const floatingFabGlassLayout: ViewStyle = {

  width: FLOATING_FAB_SIZE,

  height: FLOATING_FAB_SIZE,

  alignItems: 'center',

  justifyContent: 'center',

  borderRadius: FLOATING_FAB_RADIUS,

  borderWidth: 1,

};



export function floatingGlassScrollSurface(colors: AppColors, isLight: boolean): ViewStyle {

  return {

    ...floatingScrollGlassLayout,

    backgroundColor: isLight ? colors.surfaceSolid : colors.input,

    borderColor: colors.border,

  };

}



export function floatingGlassFabSurface(colors: AppColors, isLight: boolean): ViewStyle {

  return {

    ...floatingFabGlassLayout,

    backgroundColor: isLight ? colors.surfaceSolid : colors.input,

    borderColor: colors.border,

  };

}



/** FAB / glass chrome press — opacity + compact scale (see motionKit). */
export const floatingGlassButtonPressed = {
  opacity: 0.78,
  transform: [{ scale: 0.97 }],
} as const;


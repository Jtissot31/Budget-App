/**
 * FloatingTabBar layout tokens — no React Native imports (safe for node tests).
 *
 * Active tab well is a rounded square (not a circle) — ~radius.md (12px).
 */
export const TAB_ACTIVE_WELL_SIZE = 44;

/** Moderate corner radius — rounded rect, not size/2 (which would be a circle). */
export const TAB_ACTIVE_WELL_BORDER_RADIUS = 12;

/** Shell applied to the focused tab icon well (native TabButton + web). */
export const FLOATING_TAB_ACTIVE_WELL_SHELL = {
  width: TAB_ACTIVE_WELL_SIZE,
  height: TAB_ACTIVE_WELL_SIZE,
  borderRadius: TAB_ACTIVE_WELL_BORDER_RADIUS,
  overflow: 'hidden' as const,
  alignSelf: 'center' as const,
} as const;

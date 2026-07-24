import type { ViewStyle } from 'react-native';

/** Green + button and speed-dial menus on Transactions (Historique / Agenda). */
export const SHOW_TRANSACTIONS_TAB_FABS = true;

/** Transactions Historique FAB — solid green style before blur experiment. */
// Revert: use TRANSACTIONS_FAB_STYLE_ORIGINAL + TRANSACTIONS_FAB_GLOW_ORIGINAL on the Pressable;
// set backgroundColor and shadowColor to colors.primary at the call site.

export const TRANSACTIONS_FAB_ICON_COLOR_ORIGINAL = '#000000';

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
  width: 54,
  height: 54,
  borderRadius: 27,
  alignItems: 'center',
  justifyContent: 'center',
  ...TRANSACTIONS_FAB_GLOW_ORIGINAL,
};

/** Blur + subtle green glow — Transactions Historique FAB only. */
export const TRANSACTIONS_FAB_BLUR_INTENSITY = 68;
export const TRANSACTIONS_FAB_BLUR_TINT = 'dark' as const;
export const TRANSACTIONS_FAB_BLUR_OVERLAY = 'rgba(10, 10, 10, 0.38)';
export const TRANSACTIONS_FAB_BLUR_BORDER = 'rgba(255, 255, 255, 0.12)';

export const TRANSACTIONS_FAB_GLOW_BLUR: Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
> = {
  shadowColor: '#4ADE80',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.35,
  shadowRadius: 12,
  elevation: 8,
};

export const TRANSACTIONS_FAB_STYLE_BLUR: ViewStyle = {
  ...TRANSACTIONS_FAB_STYLE_ORIGINAL,
  backgroundColor: 'transparent',
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: TRANSACTIONS_FAB_BLUR_BORDER,
  ...TRANSACTIONS_FAB_GLOW_BLUR,
};

export const TRANSACTIONS_FAB_ICON_COLOR_BLUR = '#FFFFFF';

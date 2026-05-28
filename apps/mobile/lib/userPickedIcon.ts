import type { AppColors } from '@/constants/theme';
import { darkColors, radius } from '@/constants/theme';
import type { ViewStyle } from 'react-native';

/** Charcoal icon well — same as dark theme surface (#101014). */
export const USER_PICKED_ICON_WELL_BG_DARK = darkColors.surfaceSolid;

/** Light theme icon well background (user-picked glyphs). */
export const USER_PICKED_ICON_WELL_BG_LIGHT = '#F2F3F4';

/** Light theme well for remote logos (bank favicons with white backing). */
export const USER_PICKED_ICON_LOGO_WELL_BG_LIGHT = '#FFFFFF';

/** @deprecated Prefer {@link resolveUserPickedIconWellBackground}. */
export const USER_PICKED_ICON_WELL_BG = USER_PICKED_ICON_WELL_BG_DARK;

/** Logo glyph inset inside the rounded-square frame (contain + padding). */
export const USER_PICKED_ICON_LOGO_INSET_RATIO = 0.68;

/** Off-white glyph when no user color is set (light theme). */
export const USER_PICKED_ICON_GLYPH_LIGHT_DEFAULT = '#E7E9EE';

export function resolveUserPickedIconWellBackground(isLight: boolean): string {
  return isLight ? USER_PICKED_ICON_WELL_BG_LIGHT : USER_PICKED_ICON_WELL_BG_DARK;
}

/** Logo frames: white in light (matches favicon backing), charcoal in dark. */
export function resolveLogoIconWellBackground(isLight: boolean): string {
  return isLight ? USER_PICKED_ICON_LOGO_WELL_BG_LIGHT : USER_PICKED_ICON_WELL_BG_DARK;
}

export function userPickedIconCornerRadius(size: number): number {
  return Math.min(radius.lg, size / 2);
}

export function userPickedIconLogoSize(containerSize: number): number {
  return containerSize * USER_PICKED_ICON_LOGO_INSET_RATIO;
}

export function normalizeUserIconColor(value?: string | null): string | null {
  if (!value?.trim()) return null;
  return value.startsWith('#') ? value : null;
}

export function resolveUserPickedIconGlyphColor(
  color: string | null | undefined,
  isLight: boolean,
  colors: AppColors,
): string {
  const normalized = normalizeUserIconColor(color);
  if (normalized) return normalized;
  return isLight ? USER_PICKED_ICON_GLYPH_LIGHT_DEFAULT : colors.textSecondary;
}

function iconWellStyleBase(size: number, backgroundColor: string): ViewStyle {
  return {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: userPickedIconCornerRadius(size),
    backgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };
}

export function userPickedIconWellStyle(size: number, isLight: boolean): ViewStyle {
  return iconWellStyleBase(size, resolveUserPickedIconWellBackground(isLight));
}

export function logoIconWellStyle(size: number, isLight: boolean): ViewStyle {
  return iconWellStyleBase(size, resolveLogoIconWellBackground(isLight));
}

export function userPickedIconGlyphSize(size: number, iconSize?: number): number {
  return iconSize ?? Math.max(16, size * 0.46);
}

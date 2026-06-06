import { dashboardPalette } from '@/constants/theme';

/** Design tokens aligned with dashboard dark palette — no box shadows */
export const darkGhost = {
  void: dashboardPalette.bg,
  obsidian: dashboardPalette.card,
  obsidianSoft: dashboardPalette.iconBox,
  mint: dashboardPalette.green,
  kingdom: dashboardPalette.green,
  blaze: dashboardPalette.red,
  text: dashboardPalette.text,
  muted: dashboardPalette.subtext,
  mutedSoft: dashboardPalette.subtext,
  hairline: dashboardPalette.border,
} as const;

export const lightGhost = {
  void: '#FFFFFF',
  obsidian: '#FFFFFF',
  obsidianSoft: '#F6F8FA',
  mint: '#00A854',
  kingdom: '#00A854',
  blaze: '#CF222E',
  text: '#0D1117',
  muted: '#4B5563',
  mutedSoft: '#6B7280',
  hairline: '#D0D7DE',
} as const;

export type GhostTokens = typeof darkGhost;

export const ghostThemes = {
  dark: darkGhost,
  light: lightGhost,
} as const;

export const ghost = darkGhost;

/** Shadows removed per design system — borders only */
export const darkGhostCardShadow = {} as const;

export const lightGhostCardShadow = {} as const;

export const ghostCardShadow = darkGhostCardShadow;

export const SCREEN_TOP_GUTTER = 24;

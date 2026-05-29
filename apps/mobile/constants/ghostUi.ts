/** Design tokens aligned with GitHub-dark theme — no box shadows */
export const darkGhost = {
  void: '#0D1117',
  obsidian: '#161B22',
  obsidianSoft: '#1C2128',
  mint: '#00E676',
  kingdom: '#00E676',
  blaze: '#F85149',
  text: '#FFFFFF',
  muted: '#8B949E',
  mutedSoft: '#484F58',
  hairline: '#21262D',
} as const;

export const lightGhost = {
  void: '#FFFFFF',
  obsidian: '#FFFFFF',
  obsidianSoft: '#F6F8FA',
  mint: '#00A854',
  kingdom: '#00A854',
  blaze: '#CF222E',
  text: '#0D1117',
  muted: '#57606A',
  mutedSoft: '#8C959F',
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

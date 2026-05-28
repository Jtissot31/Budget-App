/** Design tokens — UI « Ghost » iOS (équivalent au brief NativeWind / Tailwind). */
export const darkGhost = {
  void: '#000000',
  obsidian: '#101014',
  obsidianSoft: '#17181D',
  mint: '#00F5A0',
  kingdom: '#9B8CFF',
  blaze: '#FF6B3D',
  text: '#ffffff',
  muted: '#9aa3af',
  mutedSoft: '#dce3ea',
  hairline: 'rgba(255,255,255,0.08)',
} as const;

export const lightGhost = {
  void: '#F7F8FA',
  obsidian: '#FFFFFF',
  obsidianSoft: '#EEF2F7',
  mint: '#00A870',
  kingdom: '#6D5DF6',
  blaze: '#D94A2F',
  text: '#0F172A',
  muted: '#64748B',
  mutedSoft: '#334155',
  hairline: 'rgba(15,23,42,0.08)',
} as const;

export type GhostTokens = typeof darkGhost;

export const ghostThemes = {
  dark: darkGhost,
  light: lightGhost,
} as const;

export const ghost = darkGhost;

export const darkGhostCardShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.32,
  shadowRadius: 20,
  elevation: 10,
} as const;

export const lightGhostCardShadow = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.08,
  shadowRadius: 18,
  elevation: 8,
} as const;

export const ghostCardShadow = darkGhostCardShadow;

export const SCREEN_TOP_GUTTER = 24;

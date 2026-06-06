import { Platform } from 'react-native';
import {
  fontFamilies,
  interBoldText,
  interExtraBoldText,
  interMediumText,
  interRegularText,
  interSemiboldText,
} from './interFonts';

export {
  fontFamilies,
  interBoldText,
  interExtraBoldText,
  interMediumText,
  interRegularText,
  interSemiboldText,
} from './interFonts';

/** Light app canvas — single smooth diagonal warm-grey gradient */
export const appBackgroundGradientLight = {
  colors: ['#FAFAFA', '#F2F2F2', '#ECECEC', '#E4E4E4'] as const,
  locations: [0, 0.38, 0.72, 1] as const,
  start: { x: 0, y: 0 },
  end: { x: 0.28, y: 1 },
} as const;

/** Neutral charcoal app canvas — solid, no blue tint (not pitch black) */
export const DARK_CANVAS = '#0a0a0a';

/** Screen-level charcoal canvas — same as DARK_CANVAS */
export const CANVAS_CHARCOAL = DARK_CANVAS;

/**
 * Standard container fill for cards, list rows, sheets (dark #111111).
 * Icon wells only: use `iconBox` / `surfaceElevated`.
 */
export const CONTAINER_SURFACE = '#111111';

/** Dashboard dark palette — single source of truth for app-wide dark surfaces */
export const dashboardPalette = {
  bg: DARK_CANVAS,
  card: CONTAINER_SURFACE,
  iconBox: '#181818',
  /** Portfolio scope segmented control track — distinct from card surfaces */
  scopeTrack: '#1C2128',
  /** Active pill on scope track — slightly elevated from track */
  scopeActive: '#21262D',
  border: '#1c1c1c',
  green: '#00e664',
  red: '#ff5555',
  text: '#ffffff',
  subtext: '#666666',
  warning: '#e6a000',
} as const;

/** Dark theme tokens — derived from dashboard palette */
export const darkColors = {
  background: dashboardPalette.bg,
  /** Solid page canvas — matches AppBackgroundGradient dark fill */
  screenCanvas: dashboardPalette.bg,
  surface: dashboardPalette.card,
  surfaceSolid: dashboardPalette.card,
  cardBackground: dashboardPalette.card,
  glassSolid: dashboardPalette.card,
  surfaceElevated: dashboardPalette.iconBox,
  input: dashboardPalette.iconBox,
  border: dashboardPalette.border,
  borderStrong: dashboardPalette.border,
  cardBorder: dashboardPalette.border,
  text: dashboardPalette.text,
  textSecondary: dashboardPalette.subtext,
  textMuted: dashboardPalette.subtext,
  textDisabled: dashboardPalette.subtext,
  primary: dashboardPalette.green,
  primaryAlt: dashboardPalette.green,
  success: dashboardPalette.green,
  successMuted: 'rgba(0, 230, 100, 0.12)',
  danger: dashboardPalette.red,
  dangerMuted: 'rgba(255, 85, 85, 0.13)',
  warning: dashboardPalette.warning,
  warningMuted: 'rgba(230, 160, 0, 0.14)',
  purple: '#B48CFF',
  purpleMuted: 'rgba(180, 140, 255, 0.13)',
  /** Neutral chip/well tint — iconBox family (no blue chrome) */
  cyanMuted: 'rgba(24, 24, 24, 0.92)',
  /** Selection tint — scopeActive family (no blue chrome) */
  blueMuted: 'rgba(33, 38, 45, 0.85)',
  /** Solid pill on charcoal canvas — no white rgba (Android dither grain) */
  navPill: DARK_CANVAS,
  /** Solid card fill on charcoal canvas — no white rgba tint */
  glassBackground: dashboardPalette.card,
  glassBorder: dashboardPalette.border,
  /** @deprecated Use glassBorder */
  glassBorderTop: dashboardPalette.border,
  /** @deprecated Use glassBorder */
  glassBorderBottom: dashboardPalette.border,
  glassBlurIntensity: 0,
  scopeTrack: dashboardPalette.scopeTrack,
  scopeActive: dashboardPalette.scopeActive,
} as const;

export const lightColors = {
  background: '#FFFFFF',
  screenCanvas: 'transparent',
  surface: '#F6F8FA',
  surfaceSolid: '#FFFFFF',
  cardBackground: '#FFFFFF',
  glassSolid: '#FFFFFF',
  surfaceElevated: '#F6F8FA',
  input: '#F6F8FA',
  border: '#D0D7DE',
  borderStrong: '#AFB8C1',
  cardBorder: '#D0D7DE',
  text: '#0D1117',
  textSecondary: '#4B5563',
  textMuted: '#52525B',
  textDisabled: '#6B7280',
  primary: '#00A854',
  primaryAlt: '#00A854',
  success: '#00A854',
  successMuted: 'rgba(0, 168, 84, 0.12)',
  danger: '#CF222E',
  dangerMuted: 'rgba(207, 34, 46, 0.12)',
  warning: '#C96F1A',
  warningMuted: 'rgba(201, 111, 26, 0.12)',
  purple: '#6D5DF6',
  purpleMuted: 'rgba(109, 93, 246, 0.12)',
  cyanMuted: 'rgba(246, 248, 250, 1)',
  blueMuted: 'rgba(0, 168, 84, 0.14)',
  navPill: 'rgba(255, 255, 255, 0.82)',
  /** Tinted glass fill over light gradient — no blur */
  glassBackground: 'rgba(255, 255, 255, 0.45)',
  glassBorder: 'rgba(255, 255, 255, 0.06)',
  /** @deprecated Use glassBorder */
  glassBorderTop: 'rgba(255, 255, 255, 0.06)',
  /** @deprecated Use glassBorder */
  glassBorderBottom: 'rgba(255, 255, 255, 0.06)',
  glassBlurIntensity: 0,
  scopeTrack: 'rgba(10, 10, 10, 0.06)',
  scopeActive: 'rgba(0, 168, 84, 0.14)',
} as const;

export type AppColors = typeof darkColors;
export type ThemePreference = 'dark' | 'light';

export const themeColors: Record<ThemePreference, AppColors> = {
  dark: darkColors,
  light: lightColors,
};

export const colors = darkColors;

/** Spacing scale: 4, 8, 12, 16, 24, 32 only */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Global horizontal page padding */
export const PAGE_PADDING_HORIZONTAL = spacing.lg;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  /** Standard card corner radius (dashboard) */
  card: 18,
  /** @deprecated Cards use radius.card (18px) */
  xl: 18,
  /** @deprecated Cards use radius.card (18px) */
  xxl: 18,
  pill: 999,
} as const;

/** Standard progress bar track height */
export const PROGRESS_BAR_TRACK_HEIGHT = 8;

export const typography = {
  fontFamily: fontFamilies.regular,
  fontFamilyMedium: fontFamilies.medium,
  fontFamilySemibold: fontFamilies.semibold,
  fontFamilyBold: fontFamilies.bold,
  fontFamilyHeavy: fontFamilies.extrabold,
  screenTitle: 22,
  title: 22,
  body: 16,
  caption: 14,
  meta: 13,
  micro: 12,
  dashboardGreeting: 18,
  heroStat: 24,
  heroAmount: 24,
  displayAmount: 38,
} as const;

/** Space between stacked blocks inside a Portefeuille tab section */
export const PORTFOLIO_SECTION_GAP = spacing.lg;

/** Space before the next subsection title (end of cards → next header) */
export const PORTFOLIO_SECTION_BREAK = spacing.xxl;

/** Small uppercase labels */
export const labelText = {
  ...interMediumText,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.6,
};

/** @deprecated Use interBoldText */
export const manropeBoldText = interBoldText;

/** @deprecated Use interExtraBoldText */
export const manropeExtraBoldText = interExtraBoldText;

export const FLOATING_TABBAR_ANDROID_BOTTOM_EXTRA = spacing.sm;

/** Bottom inset for tab icons — clears Android system nav without stacking extra offset. */
export function getFloatingTabBarBottomInset(safeBottom: number): number {
  if (Platform.OS === 'android') {
    if (safeBottom > 0) return safeBottom;
    return spacing.lg;
  }
  return Math.max(safeBottom, spacing.sm);
}

const FLOATING_NAV_BASE_PADDING = 112;

export const FLOATING_NAV_CONTENT_PADDING =
  FLOATING_NAV_BASE_PADDING +
  (Platform.OS === 'android' ? FLOATING_TABBAR_ANDROID_BOTTOM_EXTRA : 0);

export const PAGE_TITLE_CONTENT_GAP = spacing.xl;

/** Chart accent colors aligned with design system */
export const chartTokens = {
  line: '#00E676',
  lineLight: '#00A854',
  fillTop: 'rgba(0, 230, 118, 0.4)',
  fillTopLight: 'rgba(0, 168, 84, 0.35)',
  fillBottom: 'rgba(0, 230, 118, 0)',
  negative: '#F85149',
  negativeLight: '#CF222E',
  periodActiveBg: 'rgba(0, 230, 118, 0.2)',
  periodActiveBgLight: 'rgba(0, 168, 84, 0.14)',
} as const;

/** Portefeuille light-theme palette */
export const portfolioLight = {
  background: '#FFFFFF',
  text: '#0D1117',
  chartFill: '#F6F8FA',
  chartCurve: chartTokens.lineLight,
  card: '#FFFFFF',
  deltaBg: 'rgba(0, 168, 84, 0.15)',
  deltaBorder: 'rgba(0, 168, 84, 0.28)',
  scopeTrack: 'rgba(10, 10, 10, 0.06)',
  scopeActive: 'rgba(0, 168, 84, 0.14)',
  iconButton: '#F6F8FA',
  border: '#D0D7DE',
} as const;

/** Portefeuille dark-theme palette */
export const portfolioDark = {
  background: dashboardPalette.bg,
  card: dashboardPalette.card,
  text: dashboardPalette.text,
  textMuted: dashboardPalette.subtext,
  textTertiary: dashboardPalette.subtext,
  chartCurve: chartTokens.line,
  chartFillTop: chartTokens.fillTop,
  chartFillBottom: chartTokens.fillBottom,
  periodActiveBg: chartTokens.periodActiveBg,
  scopeTrack: dashboardPalette.scopeTrack,
  scopeActive: dashboardPalette.scopeActive,
  iconButton: dashboardPalette.iconBox,
  border: dashboardPalette.border,
} as const;

export {
  typographyKit,
  PAGE_TITLE_STYLE,
  SECTION_TITLE_STYLE,
} from './typographyKit';

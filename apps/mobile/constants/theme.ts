import { Platform } from 'react-native';

/** Light app canvas — single smooth diagonal warm-grey gradient */
export const appBackgroundGradientLight = {
  colors: ['#FAFAFA', '#F2F2F2', '#ECECEC', '#E4E4E4'] as const,
  locations: [0, 0.38, 0.72, 1] as const,
  start: { x: 0, y: 0 },
  end: { x: 0.28, y: 1 },
} as const;

/** Neutral charcoal app canvas — solid, no blue tint (not pitch black) */
export const DARK_CANVAS = '#0A0A0A';

/** Screen-level charcoal canvas — same as DARK_CANVAS */
export const CANVAS_CHARCOAL = DARK_CANVAS;

/** GitHub-dark design tokens — single source of truth */
export const darkColors = {
  background: DARK_CANVAS,
  /** Transparent screen root — gradient painted by AppBackgroundGradient */
  screenCanvas: 'transparent',
  surface: '#161B22',
  surfaceSolid: '#161B22',
  surfaceElevated: '#1C2128',
  input: '#1C2128',
  border: '#21262D',
  borderStrong: '#30363D',
  cardBorder: '#21262D',
  text: '#FFFFFF',
  textSecondary: '#8B949E',
  textMuted: '#8B949E',
  textDisabled: '#484F58',
  primary: '#00E676',
  primaryAlt: '#00E676',
  success: '#00E676',
  successMuted: 'rgba(0, 230, 118, 0.12)',
  danger: '#F85149',
  dangerMuted: 'rgba(248, 81, 73, 0.13)',
  warning: '#FFB15C',
  warningMuted: 'rgba(255, 177, 92, 0.14)',
  purple: '#B48CFF',
  purpleMuted: 'rgba(180, 140, 255, 0.13)',
  cyanMuted: 'rgba(56, 189, 248, 0.13)',
  blueMuted: 'rgba(96, 165, 250, 0.13)',
  /** Solid pill on charcoal canvas — no white rgba (Android dither grain) */
  navPill: DARK_CANVAS,
  /** Solid card fill on charcoal canvas — no white rgba tint */
  glassBackground: '#161B22',
  glassBorder: '#21262D',
  /** @deprecated Use glassBorder */
  glassBorderTop: '#21262D',
  /** @deprecated Use glassBorder */
  glassBorderBottom: '#21262D',
  glassBlurIntensity: 0,
} as const;

export const lightColors = {
  background: '#FFFFFF',
  screenCanvas: 'transparent',
  surface: '#F6F8FA',
  surfaceSolid: '#FFFFFF',
  surfaceElevated: '#F6F8FA',
  input: '#F6F8FA',
  border: '#D0D7DE',
  borderStrong: '#AFB8C1',
  cardBorder: '#D0D7DE',
  text: '#0D1117',
  textSecondary: '#57606A',
  textMuted: '#57606A',
  textDisabled: '#8C959F',
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
  cyanMuted: 'rgba(2, 132, 199, 0.12)',
  blueMuted: 'rgba(37, 99, 235, 0.12)',
  navPill: 'rgba(255, 255, 255, 0.82)',
  /** Tinted glass fill over light gradient — no blur */
  glassBackground: 'rgba(255, 255, 255, 0.45)',
  glassBorder: 'rgba(255, 255, 255, 0.06)',
  /** @deprecated Use glassBorder */
  glassBorderTop: 'rgba(255, 255, 255, 0.06)',
  /** @deprecated Use glassBorder */
  glassBorderBottom: 'rgba(255, 255, 255, 0.06)',
  glassBlurIntensity: 0,
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
  /** @deprecated Cards use radius.md (12px) */
  xl: 12,
  /** @deprecated Cards use radius.md (12px) */
  xxl: 12,
  pill: 999,
} as const;

/** Standard progress bar track height */
export const PROGRESS_BAR_TRACK_HEIGHT = 8;

export const fontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  /** @deprecated Use fontFamilies.regular */
  rounded: Platform.select({
    ios: 'Inter_400Regular',
    android: 'Inter_400Regular',
    default: 'Inter_400Regular',
  }),
  /** @deprecated Use fontFamilies.bold */
  roundedHeavy: Platform.select({
    ios: 'Inter_700Bold',
    android: 'Inter_700Bold',
    default: 'Inter_700Bold',
  }),
} as const;

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

/** Inter presets — fontWeight: 'normal' so named font files render correctly */
export const interRegularText = {
  fontFamily: fontFamilies.regular,
  fontWeight: 'normal' as const,
};

export const interMediumText = {
  fontFamily: fontFamilies.medium,
  fontWeight: 'normal' as const,
};

export const interSemiboldText = {
  fontFamily: fontFamilies.semibold,
  fontWeight: 'normal' as const,
};

export const interBoldText = {
  fontFamily: fontFamilies.bold,
  fontWeight: 'normal' as const,
};

export const interExtraBoldText = {
  fontFamily: fontFamilies.extrabold,
  fontWeight: 'normal' as const,
};

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

const FLOATING_NAV_BASE_PADDING = 112;

export const FLOATING_NAV_CONTENT_PADDING =
  FLOATING_NAV_BASE_PADDING +
  (Platform.OS === 'android' ? FLOATING_TABBAR_ANDROID_BOTTOM_EXTRA : 0);

export const PAGE_TITLE_CONTENT_GAP = spacing.xl;

export const PORTFOLIO_SECTION_GAP = spacing.lg;

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
  scopeTrack: 'rgba(15, 23, 42, 0.06)',
  scopeActive: 'rgba(0, 168, 84, 0.14)',
  iconButton: '#F6F8FA',
  border: '#D0D7DE',
} as const;

/** Portefeuille dark-theme palette */
export const portfolioDark = {
  background: DARK_CANVAS,
  card: '#161B22',
  text: '#FFFFFF',
  textMuted: '#8B949E',
  textTertiary: '#484F58',
  chartCurve: chartTokens.line,
  chartFillTop: chartTokens.fillTop,
  chartFillBottom: chartTokens.fillBottom,
  periodActiveBg: chartTokens.periodActiveBg,
  scopeTrack: '#1C2128',
  scopeActive: '#21262D',
  iconButton: '#1C2128',
  border: '#21262D',
} as const;

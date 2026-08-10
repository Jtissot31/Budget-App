/**
 * Fyn / BudgetTracker — design tokens from Budget Proto (Figma).
 * Source: `C:/Users/emime/Downloads/Budget Proto`
 *   - `src/app/App.tsx` (DARK / LIGHT / GREEN / RED / …)
 *   - `src/styles/theme.css` (shadcn CSS variables, brand primary/accent)
 * Keep in sync with `theme.ts` + `planFinanceKit.ts`.
 *
 * Import from app code: `import { COLORS, SPACING, … } from '@/constants/design-tokens'`
 */

/** Nested palettes (theme / plan / chat). Budget Proto dark. */
const dark = {
  canvas: '#070709',
  background: '#070709',
  screenCanvas: '#070709',
  /** Glass card — Figma DARK.CARD */
  containerBackground: 'rgba(255, 255, 255, 0.055)',
  containerBorder: 'rgba(255, 255, 255, 0.1)',
  surface: 'rgba(255, 255, 255, 0.055)',
  surfaceSolid: 'rgba(255, 255, 255, 0.055)',
  cardBackground: 'rgba(255, 255, 255, 0.055)',
  iconBox: 'rgba(255, 255, 255, 0.08)',
  input: 'rgba(255, 255, 255, 0.06)',
  surfaceElevated: 'rgba(255, 255, 255, 0.08)',
  codeBg: '#0F0F14',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  border: 'rgba(255, 255, 255, 0.1)',
  borderStrong: 'rgba(255, 255, 255, 0.1)',
  text: '#FFFFFF',
  textSecondary: '#C8C8D8',
  textMuted: '#6E6E80',
  textDisabled: '#6E6E80',
  /** Success / CTA / Disponible — Figma GREEN */
  primary: '#22C55E',
  primaryAlt: '#22C55E',
  success: '#22C55E',
  successMuted: 'rgba(34, 197, 94, 0.12)',
  accentGreen: '#22C55E',
  dashboardValueGreen: '#22C55E',
  goalProgressFill: '#22C55E',
  danger: '#F87171',
  dangerMuted: 'rgba(248, 113, 113, 0.13)',
  dashboardValueRed: '#F87171',
  warning: '#FBBF24',
  warningMuted: 'rgba(251, 191, 36, 0.14)',
  purple: '#C084FC',
  purpleMuted: 'rgba(192, 132, 252, 0.13)',
  /** theme.css --primary (brand violet) — secondary brand, not money green */
  brandPrimary: '#7C5CFC',
  brandAccent: '#00D4A0',
  blue: '#60A5FA',
  teal: '#2DD4BF',
  toggleTrackOff: 'rgba(255, 255, 255, 0.15)',
  toggleTrackOn: 'rgba(34, 197, 94, 0.32)',
  toggleThumb: '#F4F4F5',
  toggleBorder: 'rgba(255, 255, 255, 0.08)',
  navPill: '#070709',
  glassBackground: 'rgba(255, 255, 255, 0.055)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  segmentedTabTrack: 'rgba(255, 255, 255, 0.05)',
  segmentedTabActivePill: 'rgba(255, 255, 255, 0.1)',
  segmentedTabActiveText: '#FFFFFF',
  segmentedTabInactiveText: '#6E6E80',
  scopeTrack: 'rgba(255, 255, 255, 0.05)',
  scopeActive: 'rgba(255, 255, 255, 0.1)',
  /** Dark text on green CTAs */
  textOnAccent: '#070709',
} as const;

export const COLORS = {
  dark,
  light: {
    background: '#F2F2F7',
    screenCanvas: 'transparent',
    containerBackground: 'rgba(255, 255, 255, 0.82)',
    containerBorder: 'rgba(0, 0, 0, 0.09)',
    surface: 'rgba(255, 255, 255, 0.82)',
    surfaceElevated: 'rgba(255, 255, 255, 0.95)',
    input: 'rgba(255, 255, 255, 0.95)',
    accentGreen: '#22C55E',
    primary: '#22C55E',
    success: '#22C55E',
    danger: '#F87171',
    warning: '#FBBF24',
    text: '#0A0A0F',
    textSecondary: '#3C3C4A',
    textMuted: '#8E8E9A',
    border: 'rgba(0, 0, 0, 0.09)',
  },
  /** Parallel plan-finance kit */
  planFinance: {
    background: '#070709',
    surface: 'rgba(255, 255, 255, 0.055)',
    surfaceElevated: 'rgba(255, 255, 255, 0.08)',
    input: 'rgba(255, 255, 255, 0.06)',
    accent: '#22C55E',
    danger: '#F87171',
    warning: '#FBBF24',
    border: 'rgba(255, 255, 255, 0.1)',
    text: '#FFFFFF',
    textMuted: 'rgba(200, 200, 216, 0.7)',
    textOnAccent: '#070709',
  },
  /** AI chat dark */
  aiChatDark: {
    background: '#070709',
    surface: 'rgba(255, 255, 255, 0.08)',
    primary: '#22C55E',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.45)',
    border: 'rgba(255,255,255,0.1)',
    userBubble: '#22C55E',
    userBubbleText: '#070709',
    onAccent: '#070709',
    aiBubble: 'rgba(255, 255, 255, 0.08)',
    sendMuted: 'rgba(255,255,255,0.35)',
  },
  chart: {
    line: '#22C55E',
    lineLight: '#16A34A',
    fillTop: 'rgba(34, 197, 94, 0.4)',
    negative: '#F87171',
    stockPositive: '#22C55E',
    stockNegative: '#F87171',
    brand: '#7C5CFC',
    accent: '#00D4A0',
    amber: '#FFB340',
    blue: '#4A9EFF',
  },
  budgetCategory: {
    iconWellBg: 'rgba(255, 255, 255, 0.08)',
    iconGlyph: 'rgba(255,255,255,0.85)',
  },
  knownSpecDiffs: {
    claimedBackground: '#080808',
    actualBackground: '#070709',
    claimedSurface: 'rgba(255,255,255,0.06)',
    actualSurface: 'rgba(255,255,255,0.055)',
    claimedGreen: '#00D4A0',
    actualAccentGreen: '#22C55E',
    actualPrimaryGreen: '#22C55E',
    brandPrimary: '#7C5CFC',
  },

  /**
   * Dark-first flat aliases for fyn-ui (maps library specs → real tokens).
   */
  green: dark.accentGreen,
  amber: dark.warning,
  red: dark.danger,
  surface: dark.surface,
  border: dark.border,
  text: dark.text,
  textMuted: dark.textMuted,
  textOnGreen: dark.textOnAccent,
  inputBackground: dark.input,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  pagePaddingHorizontal: 16,
  portfolioSectionGap: 16,
  portfolioSectionBreak: 32,
  onyxListGap: 8,
  onyxRowPadding: 12,
  onyxCardPadding: 20,
  planCardGap: 14,
  planSectionGap: 32,
  planBlockGap: 16,
  planFieldGap: 20,
  chipPaddingHorizontal: 12,
  tagPaddingHorizontal: 8,
  tagPaddingVertical: 3,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  /** Budget Proto card family (~18px) */
  card: 18,
  xl: 18,
  xxl: 22,
  pill: 999,
  /** Onyx / plan finance card + button — aligned to proto cards */
  onyx: 18,
  planSmall: 10,
  planButton: 16,
  planIconButton: 20,
  budgetCategoryIconWell: 10,
  tag: 8,
} as const;

export const BORDER = {
  width: 1,
} as const;

export const ICON = {
  listChevron: 20,
} as const;

export const TYPOGRAPHY = {
  families: {
    uiRegular: 'PlusJakartaSans_400Regular',
    uiMedium: 'PlusJakartaSans_500Medium',
    uiSemibold: 'PlusJakartaSans_600SemiBold',
    uiBold: 'PlusJakartaSans_700Bold',
    uiExtraBold: 'PlusJakartaSans_800ExtraBold',
    money: 'Inter_800ExtraBold',
    articlesRegular: 'DMMono_400Regular',
    articlesMedium: 'DMMono_500Medium',
  },
  sizes: {
    micro: 12,
    meta: 13,
    caption: 14,
    body: 16,
    dashboardGreeting: 18,
    sectionTitle: 20,
    screenTitle: 22,
    title: 22,
    heroStat: 24,
    heroAmount: 24,
    pageTitle: 32,
    displayAmount: 38,
    tag: 10,
  },
  moneyTiers: {
    row: 14,
    card: 16,
    stat: 24,
    hero: 28,
    detailHero: 36,
    netWorth: 42,
  },
  kit: {
    pageTitle: { fontSize: 32, letterSpacing: -0.8, weight: 'extrabold' as const },
    sectionTitle: { fontSize: 20, letterSpacing: -0.4, lineHeight: 24, weight: 'extrabold' as const },
    eyebrow: { fontSize: 13, letterSpacing: 0.6, transform: 'uppercase' as const, weight: 'medium' as const },
  },
  /** Style presets for fyn-ui (spread into Text styles) */
  body: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
  },
  caption: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
  },
  h2: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 20,
    letterSpacing: -0.4,
  },
} as const;

export const COMPONENTS = {
  onyxContainer: {
    borderRadius: 18,
    borderWidth: 'hairline' as const,
    pressedOpacity: 0.82,
    pressedScale: 0.975,
    fillToken: 'colors.containerBackground',
    borderToken: 'colors.containerBorder',
    halo: true,
    padding: {
      row: 12,
      compactTile: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 14 },
      card: 20,
    },
    listGap: 8,
    component: 'components/OnyxContainer.tsx',
    aliasOf: 'components/plans/PlanFinanceContainer.tsx',
  },
  containerSurface: {
    borderWidth: 1,
    typicalRadius: 18,
    helper: 'containerSurfaceStyle(isLight)',
    halo: false,
  },
  primarySaveButton: {
    backgroundToken: 'colors.primary',
    backgroundDark: '#22C55E',
    textToken: 'colors.background',
    borderRadius: 10,
    paddingVertical: 16,
    pressedOpacity: 0.72,
    disabledOpacity: 0.45,
    component: 'components/PrimarySaveButton.tsx',
  },
  planFinancePrimaryButton: {
    background: '#22C55E',
    borderRadius: 16,
    minHeight: 48,
    helper: 'planFinancePrimaryButtonStyle()',
  },
  floatingTabBar: {
    blurIntensityIos: 32,
    blurIntensityAndroid: 22,
    darkTint: 'rgba(14, 14, 20, 0.96)',
    borderDark: 'rgba(255, 255, 255, 0.10)',
    fabAccentToken: 'colors.accentGreen',
    tabIconSize: 21,
    component: 'components/FloatingTabBar.tsx',
  },
  segmentedControl: {
    trackDark: 'rgba(255, 255, 255, 0.05)',
    activePillDark: 'rgba(255, 255, 255, 0.1)',
    component: 'components/ThemeSegmentedControl.tsx',
    spring: { damping: 19, stiffness: 295, mass: 0.6 },
  },
  premiumSwitch: {
    trackOffDark: 'rgba(255, 255, 255, 0.15)',
    trackOnDark: 'rgba(34, 197, 94, 0.32)',
    thumb: '#F4F4F5',
  },
  chips: {
    borderWidth: 1.5,
    paddingHorizontal: 12,
    typeTransactionMinWidth: 108,
  },
  iconWell: {
    standard: 34,
    merchantLogo: 48,
    budgetCategory: 36,
  },
  progressBar: {
    trackHeight: 8,
    /** BudgetRow / BudgetCategoryRow thin track */
    thinHeight: 3,
  },
  radioGroup: {
    optionMinWidth: 70,
  },
  button: {
    pressedOpacity: 0.8,
    disabledOpacity: 0.5,
  },
  protected: {
    transactionDetailSheet: 'components/TransactionDetailSheet.tsx',
  },
} as const;

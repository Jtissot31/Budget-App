/**
 * Fyn / BudgetTracker — design tokens extracted from live code.
 * Sources: apps/mobile/constants/theme.ts, planFinanceKit.ts, typographyKit.ts,
 * plusJakartaFonts.ts, interFonts.ts
 * Do not invent values — keep in sync with those files when they change.
 *
 * Import from app code: `import { COLORS, SPACING, … } from '@/constants/design-tokens'`
 */

/** Nested palettes (theme / plan / chat). */
const dark = {
  canvas: '#0a0a0a',
  background: '#0a0a0a',
  screenCanvas: '#0a0a0a',
  containerBackground: '#111111',
  containerBorder: '#1c1c1c',
  surface: '#111111',
  surfaceSolid: '#111111',
  cardBackground: '#111111',
  iconBox: '#181818',
  input: '#181818',
  surfaceElevated: '#1F1F23',
  codeBg: '#161618',
  borderSubtle: 'rgba(255, 255, 255, 0.07)',
  border: '#1c1c1c',
  borderStrong: '#1c1c1c',
  text: '#ffffff',
  textSecondary: '#666666',
  textMuted: '#666666',
  textDisabled: '#666666',
  /** Primary CTA / success semantic (dashboard green) — NOT accentGreen */
  primary: '#00e664',
  primaryAlt: '#00e664',
  success: '#00e664',
  successMuted: 'rgba(0, 230, 100, 0.12)',
  /** Disponible / goals / plan accent */
  accentGreen: '#4ADE80',
  dashboardValueGreen: '#4ADE80',
  goalProgressFill: '#4ADE80',
  danger: '#ff5555',
  dangerMuted: 'rgba(255, 85, 85, 0.13)',
  dashboardValueRed: '#FF6B6B',
  warning: '#e6a000',
  warningMuted: 'rgba(230, 160, 0, 0.14)',
  purple: '#B48CFF',
  purpleMuted: 'rgba(180, 140, 255, 0.13)',
  toggleTrackOff: '#28282E',
  toggleTrackOn: 'rgba(74, 222, 128, 0.32)',
  toggleThumb: '#F4F4F5',
  toggleBorder: 'rgba(255, 255, 255, 0.08)',
  navPill: '#0a0a0a',
  glassBackground: '#111111',
  glassBorder: '#1c1c1c',
  segmentedTabTrack: '#1C1C1C',
  segmentedTabActivePill: '#2C2C2C',
  segmentedTabActiveText: '#FFFFFF',
  segmentedTabInactiveText: '#6B6B6B',
  scopeTrack: '#1C1C1C',
  scopeActive: '#2C2C2C',
  /** Dark text on green CTAs (planFinance.textOnAccent) */
  textOnAccent: '#0a0a0a',
} as const;

export const COLORS = {
  dark,
  light: {
    background: '#F0F0F0',
    screenCanvas: 'transparent',
    containerBackground: '#FFFFFF',
    containerBorder: '#C0C0C8',
    surface: '#FFFFFF',
    surfaceElevated: '#E8E8ED',
    input: '#E8E8ED',
    accentGreen: '#4ADE80',
    primary: '#00A854',
    success: '#00A854',
    danger: '#CF222E',
    warning: '#C96F1A',
    text: '#0D1117',
    textSecondary: '#4B5563',
    textMuted: '#52525B',
    border: '#C0C0C8',
  },
  /** Parallel plan-finance kit (helpers / buttons — shell still uses theme container*) */
  planFinance: {
    background: '#0a0a0a',
    surface: '#111111',
    surfaceElevated: '#2E2E34',
    input: '#1A1A1D',
    accent: '#4ADE80',
    danger: '#C96560',
    warning: '#C9974A',
    border: 'rgba(255, 255, 255, 0.12)',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.55)',
    textOnAccent: '#0a0a0a',
  },
  /** AI chat dark — diverges from main canvas */
  aiChatDark: {
    background: '#0E0E10',
    surface: '#1F1F23',
    primary: '#4ADE80',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.45)',
    border: 'rgba(255,255,255,0.12)',
    userBubble: '#4ADE80',
    userBubbleText: '#0A0A0A',
    onAccent: '#0A0A0A',
    aiBubble: '#28282E',
    sendMuted: 'rgba(255,255,255,0.35)',
  },
  chart: {
    line: '#00E676',
    lineLight: '#00A854',
    fillTop: 'rgba(0, 230, 118, 0.4)',
    negative: '#F85149',
    stockPositive: '#34C759',
    stockNegative: '#E9967A',
  },
  budgetCategory: {
    iconWellBg: '#28282E',
    iconGlyph: 'rgba(255,255,255,0.85)',
  },
  knownSpecDiffs: {
    claimedBackground: '#0E0E10',
    actualBackground: '#0a0a0a',
    claimedSurface: '#28282E',
    actualSurface: '#111111',
    claimedGreen: '#4ADE80',
    actualAccentGreen: '#4ADE80',
    actualPrimaryGreen: '#00e664',
  },

  /**
   * Dark-first flat aliases for fyn-ui (maps library specs → real tokens).
   * Prefer nested `COLORS.dark.*` when theme-aware; use these for static library styles.
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
  /** containerSurfaceStyle / SurfaceCard family */
  card: 18,
  xl: 18,
  xxl: 18,
  pill: 999,
  /** Onyx / plan finance card + button */
  onyx: 13,
  planSmall: 8,
  planButton: 13,
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
    borderRadius: 13,
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
    backgroundDark: '#00e664',
    textToken: 'colors.background',
    borderRadius: 8,
    paddingVertical: 16,
    pressedOpacity: 0.72,
    disabledOpacity: 0.45,
    component: 'components/PrimarySaveButton.tsx',
  },
  planFinancePrimaryButton: {
    background: '#4ADE80',
    borderRadius: 13,
    minHeight: 48,
    helper: 'planFinancePrimaryButtonStyle()',
  },
  floatingTabBar: {
    blurIntensityIos: 32,
    blurIntensityAndroid: 22,
    darkTint: 'rgba(22, 22, 22, 0.94)',
    borderDark: 'rgba(255, 255, 255, 0.10)',
    fabAccentToken: 'colors.accentGreen',
    tabIconSize: 21,
    component: 'components/FloatingTabBar.tsx',
  },
  segmentedControl: {
    trackDark: '#1C1C1C',
    activePillDark: '#2C2C2C',
    component: 'components/ThemeSegmentedControl.tsx',
    spring: { damping: 19, stiffness: 295, mass: 0.6 },
  },
  premiumSwitch: {
    trackOffDark: '#28282E',
    trackOnDark: 'rgba(74, 222, 128, 0.32)',
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

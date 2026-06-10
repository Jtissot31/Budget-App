import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { typographyKit } from './typographyKit';
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
  colors: ['#EFEFEF', '#E8E8E8', '#E0E0E0', '#D8D8D8'] as const,
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

/**
 * Standard container outline — matches dashboard « Fonds insuffisants » alert shell (`aStyles.card`).
 * Use with {@link CONTAINER_SURFACE} / `containerBackground` and `borderWidth: 1`.
 */
export const CONTAINER_BORDER = '#1c1c1c';

/** Light-theme container outline (same as `lightDashboardPalette.border`). */
export const CONTAINER_BORDER_LIGHT = '#C0C0C8';

/** Segmented tab bar — Transactions / Portefeuille scope tabs (dark) */
export const segmentedTabBarDark = {
  track: '#1C1C1C',
  activePill: '#2C2C2C',
  activeText: '#FFFFFF',
  inactiveText: '#6B6B6B',
} as const;

/** Segmented tab bar — light theme (unchanged from prior light work) */
export const segmentedTabBarLight = {
  track: 'rgba(10, 10, 10, 0.06)',
  activePill: 'rgba(0, 168, 84, 0.14)',
  activeText: '#0D1117',
  inactiveText: '#52525B',
} as const;

/** Dashboard dark palette — single source of truth for app-wide dark surfaces */
export const dashboardPalette = {
  bg: DARK_CANVAS,
  card: CONTAINER_SURFACE,
  iconBox: '#181818',
  /** Portfolio scope segmented control track — distinct from card surfaces */
  scopeTrack: segmentedTabBarDark.track,
  /** Active pill on scope track — slightly elevated from track */
  scopeActive: segmentedTabBarDark.activePill,
  border: CONTAINER_BORDER,
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
  /** Standard card/container fill — low-fund alert shell */
  containerBackground: dashboardPalette.card,
  /** Standard card/container outline — low-fund alert shell */
  containerBorder: dashboardPalette.border,
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
  segmentedTabTrack: segmentedTabBarDark.track,
  segmentedTabActivePill: segmentedTabBarDark.activePill,
  segmentedTabActiveText: segmentedTabBarDark.activeText,
  segmentedTabInactiveText: segmentedTabBarDark.inactiveText,
} as const;

export const lightColors = {
  background: '#F0F0F0',
  screenCanvas: 'transparent',
  surface: '#FFFFFF',
  surfaceSolid: '#FFFFFF',
  /** Standard card/container fill — low-fund alert shell */
  containerBackground: '#FFFFFF',
  /** Standard card/container outline — low-fund alert shell */
  containerBorder: CONTAINER_BORDER_LIGHT,
  cardBackground: '#FFFFFF',
  glassSolid: '#FFFFFF',
  surfaceElevated: '#E8E8ED',
  input: '#E8E8ED',
  border: CONTAINER_BORDER_LIGHT,
  borderStrong: '#9090A0',
  cardBorder: CONTAINER_BORDER_LIGHT,
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
  glassBorder: CONTAINER_BORDER_LIGHT,
  /** @deprecated Use glassBorder */
  glassBorderTop: 'rgba(255, 255, 255, 0.06)',
  /** @deprecated Use glassBorder */
  glassBorderBottom: 'rgba(255, 255, 255, 0.06)',
  glassBlurIntensity: 0,
  scopeTrack: segmentedTabBarLight.track,
  scopeActive: segmentedTabBarLight.activePill,
  segmentedTabTrack: segmentedTabBarLight.track,
  segmentedTabActivePill: segmentedTabBarLight.activePill,
  segmentedTabActiveText: segmentedTabBarLight.activeText,
  segmentedTabInactiveText: segmentedTabBarLight.inactiveText,
} as const;

export type AppColors = typeof darkColors;
export type ThemePreference = 'dark' | 'light';

export const themeColors: Record<ThemePreference, AppColors> = {
  dark: darkColors,
  light: lightColors,
};

export const colors = darkColors;

/** Dashboard palette for the active theme (Comptes / alertes / styles statiques dashboard). */
export function dashboardPaletteForTheme(isLight: boolean) {
  return isLight ? lightDashboardPalette : dashboardPalette;
}

/**
 * Standard container shell colors — matches dashboard « Fonds insuffisants » alert (`aStyles.card`).
 * Prefer {@link containerSurfaceStyle} when you also need `borderWidth: 1`.
 */
export function containerSurfaceColors(isLight: boolean) {
  const palette = dashboardPaletteForTheme(isLight);
  return {
    backgroundColor: palette.card,
    borderColor: palette.border,
  } as const;
}

/**
 * Standard container View style — fill + 1px outline from the low-fund alert reference.
 * Shapes (borderRadius, padding, layout) stay with the caller.
 */
export function containerSurfaceStyle(isLight: boolean): Pick<ViewStyle, 'backgroundColor' | 'borderColor' | 'borderWidth'> {
  const { backgroundColor, borderColor } = containerSurfaceColors(isLight);
  return {
    backgroundColor,
    borderColor,
    borderWidth: 1,
  };
}

/** Dashboard palette shape derived from light tokens. */
export const lightDashboardPalette = {
  bg: lightColors.background,
  card: lightColors.cardBackground,
  iconBox: lightColors.surfaceElevated,
  scopeTrack: lightColors.scopeTrack,
  scopeActive: lightColors.scopeActive,
  border: lightColors.border,
  green: lightColors.primary,
  red: lightColors.danger,
  text: lightColors.text,
  subtext: lightColors.textSecondary,
  warning: lightColors.warning,
} as const;

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

/**
 * Chip / pill / tab text layout rules (app-wide):
 * - Never break a word mid-character: use `numberOfLines` + `ellipsizeMode="tail"`, or allow wrap at word boundaries.
 * - Single-line chip labels need `CHIP_PADDING_HORIZONTAL` + `minWidth` so the label fits; use `chipLabelTextProps` from `lib/textLayout`.
 * - Selected state must NOT change `borderWidth` without compensating padding — always use {@link CHIP_BORDER_WIDTH} on every chip state.
 * - Prefer changing `borderColor` / background on selection; avoid outline width jumps that shrink the inner content box.
 *
 * Helpers: {@link chipShellBorderStyle}, {@link chipMinPaddingStyle}, {@link chipSelectableShellStyle},
 * `lib/textLayout.ts` (`chipLabelTextProps`, `noMidWordClipTextProps`, `singleLineLabelStyle`).
 */
export const CHIP_BORDER_WIDTH = 1.5;

/** Minimum horizontal padding inside selectable chips (type pills, category chips, etc.). */
export const CHIP_PADDING_HORIZONTAL = spacing.md;

/** Min inner width for transaction type pills — fits « Transfert » at caption size with chip padding + border. */
export const TYPE_TRANSACTION_CHIP_MIN_WIDTH = 108;

/** Constant border width for chip shells — selected and unselected share the same inner box. */
export function chipShellBorderStyle(borderColor: string): Pick<ViewStyle, 'borderWidth' | 'borderColor'> {
  return {
    borderWidth: CHIP_BORDER_WIDTH,
    borderColor,
  };
}

/** Padding baseline for chips that must fit a single-line French label. */
export function chipMinPaddingStyle(): Pick<ViewStyle, 'paddingHorizontal'> {
  return {
    paddingHorizontal: CHIP_PADDING_HORIZONTAL,
  };
}

/** Shell style for selectable chips — constant border width in every state (selected included). */
export function chipSelectableShellStyle(borderColor: string): Pick<ViewStyle, 'borderWidth' | 'borderColor' | 'paddingHorizontal'> {
  return {
    ...chipShellBorderStyle(borderColor),
    ...chipMinPaddingStyle(),
  };
}

/**
 * Low-emphasis destructive label — use on « Supprimer » trigger affordances (not ConfirmDeleteModal).
 * Prefer with {@link subtleDeleteButtonStyle} for the pressable shell.
 */
export function destructiveTextActionStyle(isLight: boolean): TextStyle {
  const palette = dashboardPaletteForTheme(isLight);
  return {
    ...typographyKit.metaMedium,
    color: palette.red,
  };
}

/**
 * Subtle delete trigger — muted outline or text-link row, danger tint without loud full-width red.
 * Confirmation stays in ConfirmDeleteModal.
 */
export function subtleDeleteButtonStyle(
  isLight: boolean,
  options?: { alignSelf?: ViewStyle['alignSelf'] },
): ViewStyle {
  const palette = dashboardPaletteForTheme(isLight);
  return {
    alignSelf: options?.alignSelf ?? 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isLight ? 'rgba(207, 34, 46, 0.22)' : 'rgba(255, 85, 85, 0.22)',
    backgroundColor: isLight ? 'rgba(207, 34, 46, 0.05)' : 'rgba(255, 85, 85, 0.07)',
  };
}

/** Danger icon tint for subtle delete triggers — matches {@link destructiveTextActionStyle}. */
export function destructiveIconColor(isLight: boolean): string {
  return dashboardPaletteForTheme(isLight).red;
}

/** Hairline border for non-chip controls (inputs, suggestion pills) — not for selectable chips. */
export const CONTROL_HAIRLINE_BORDER_WIDTH = StyleSheet.hairlineWidth;

/** Standard progress bar track height */
export const PROGRESS_BAR_TRACK_HEIGHT = 8;

/**
 * Standard icon well size (px) for cards, lists, dashboard rows, transaction avatars, etc.
 * Matches dashboard « Prochain paiement » house icon well (34×34).
 * Use with LogoIconFrame, IconFrame, userPickedIconWellStyle, UserPickedIconBadge in list/card context.
 * Do NOT use for FAB buttons (FloatingTabBar) or tiny legend/calendar markers (12–16px).
 */
export const ICON_WELL_SIZE = 34;

/**
 * Standard merchant / bank-account logo well size (px).
 * Use for MerchantLogo, merchant directory rows, transaction rows (TransactionRow = 48),
 * recurring-payment rows, account-card identity logos, and any context that shows a
 * brand favicon / institution logo inline.
 */
export const MERCHANT_LOGO_SIZE = 48;

/**
 * Full-bleed custom SVG glyph inside a standard well (e.g. DashboardHouseIcon).
 * For Ionicons inside wells, use {@link userPickedIconGlyphSize}(ICON_WELL_SIZE) (~16px).
 */
export const ICON_GLYPH_SIZE = ICON_WELL_SIZE;

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

const GOAL_VISUAL_SLOT_COUNT = 6;

/**
 * Map hash slots to non-adjacent palette indices so similar hashes still get contrasting tones.
 */
const GOAL_SLOT_PERMUTATION = [0, 4, 2, 5, 1, 3] as const;

/**
 * High-contrast solid greens for progress bars, badges, and legend dots (pale → deep).
 */
export const goalGreenPalette = {
  dark: ['#00E676', '#3ADF8A', '#7AF5B4', '#00BA56', '#008F47', '#005C30'],
  light: ['#00A854', '#34D399', '#10B981', '#059669', '#047857', '#065F46'],
} as const;

/** Overview chart: one base green + budget-style opacity ladder per goal. */
const GOAL_CHART_OPACITY_LADDER = [1, 0.72, 0.48, 0.85, 0.58, 0.35] as const;

/** Overview chart: alternate stroke patterns when lines overlap. */
export const GOAL_CHART_DASH_PATTERNS: readonly (string | undefined)[] = [
  undefined,
  '10 6',
  '5 5',
  '12 5 3 5',
  '8 8',
  '3 5',
];

export function goalGreenPaletteIndex(goalId: string, paletteLength: number): number {
  let hash = 0;
  for (let i = 0; i < goalId.length; i++) {
    hash = (hash * 31 + goalId.charCodeAt(i)) >>> 0;
  }
  return hash % paletteLength;
}

function getGoalMappedSlot(goalId: string): number {
  const raw = goalGreenPaletteIndex(goalId, GOAL_VISUAL_SLOT_COUNT);
  return GOAL_SLOT_PERMUTATION[raw]!;
}

/** Mono green base for overview lines (same family as chartTokens / budget donut). */
export function getGoalChartBaseGreen(isLight: boolean): string {
  return isLight ? chartTokens.lineLight : chartTokens.line;
}

/** Solid shade for progress bars, icon badges, legend dots. */
export function getGoalGreenShade(goalId: string, isLight: boolean): string {
  const palette = isLight ? goalGreenPalette.light : goalGreenPalette.dark;
  return palette[getGoalMappedSlot(goalId)]!;
}

/** Per-goal stroke opacity for overview chart (budget segmentOpacity pattern, stronger spread). */
export function getGoalChartOpacity(goalId: string): number {
  return GOAL_CHART_OPACITY_LADDER[getGoalMappedSlot(goalId)]!;
}

/** Per-goal dash pattern for overview chart lines — always solid. */
export function getGoalChartDashPattern(_goalId: string): undefined {
  return undefined;
}

/** Palette index from goal id (stable across list reorder). */
export function getGoalGreenPaletteIndex(goalId: string): number {
  return getGoalMappedSlot(goalId);
}

/** Portefeuille light-theme palette */
export const portfolioLight = {
  background: '#F0F0F0',
  text: '#0D1117',
  chartFill: '#F6F8FA',
  chartCurve: chartTokens.lineLight,
  card: '#FFFFFF',
  deltaBg: 'rgba(0, 168, 84, 0.15)',
  deltaBorder: 'rgba(0, 168, 84, 0.28)',
  scopeTrack: segmentedTabBarLight.track,
  scopeActive: segmentedTabBarLight.activePill,
  iconButton: '#E8E8ED',
  border: '#C0C0C8',
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

/**
 * Page détail compte (`app/account-detail.tsx`) — ordre vertical des blocs :
 *
 * 1. **Hero actions** (haut droite) — liens texte « Modifier · Supprimer »
 *    ({@link accountDetailHeroActionsStyle}, {@link destructiveTextActionStyle} pour Supprimer)
 * 2. **BankAccountCard** — carte hero dans `ghostCardShadow` (composant séparé, ne pas dupliquer)
 * 3. **Ligne stats relevé** — 3 colonnes selon le type de compte :
 *    - Chèque : Revenus · Net ce mois (prominent) · Dépenses ({@link ACCOUNT_DETAIL_STATEMENT_COLUMNS})
 *    - Crédit : Solde dû · Disponible · % utilisé
 *    - Épargne : Épargné · Objectif · Atteint
 * 4. **DetailRows secondaires** — paires label/valeur avec hairline entre lignes (limite, échéance, objectif…)
 * 5. **En-tête collapsible** paiements récurrents ({@link accountDetailRecurringHeaderStyle})
 * 6. **Historique transactions** — barre recherche + filtres SegmentedTabs + groupes {@link TransactionRow}
 *
 * Règles couleur des valeurs stats :
 * - **Compte chèque** : seul « Net ce mois » est coloré (vert si ≥ 0, rouge sinon) ;
 *   « Revenus » et « Dépenses » restent en `colors.text` avec préfixe +/−.
 * - **Crédit** : « Solde dû » en `colors.danger` avec montant signé − ;
 *   « Disponible » en `colors.text` ; « % utilisé » via {@link utilizationPercentColor}
 *   (`lib/creditLimitUtilization.ts` : &lt;50 % vert, 50–79 % orange, ≥80 % rouge).
 * - **Carte crédit (BankAccountCard)** : affiche solde dû + disponible uniquement — pas de % sur la carte.
 */
export const ACCOUNT_DETAIL_STATEMENT_COLUMNS = {
  rowGap: spacing.sm,
  rowPaddingTop: spacing.xs,
  colGap: 4,
  colFlex: 1,
  prominentColFlex: 1.15,
  statValueSize: 28,
  statValueProminentSize: 32,
  statValueLetterSpacing: -0.5,
  statValueProminentLetterSpacing: -0.6,
  statLabelSize: 9,
  statLabelLetterSpacing: 0.4,
} as const;

/** Row of top-right hero text actions (« Modifier · Supprimer »). */
export function accountDetailHeroActionsStyle(): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  };
}

/** Pressable padding for a hero text action link. */
export function accountDetailHeroActionLinkStyle(): ViewStyle {
  return {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  };
}

/** Muted label for hero actions such as « Modifier ». */
export function accountDetailHeroActionMutedTextStyle(isLight: boolean): TextStyle {
  const theme = isLight ? lightColors : darkColors;
  return {
    ...interMediumText,
    fontSize: typography.meta,
    color: theme.textMuted,
  };
}

/** Separator dot between hero actions (« · »). */
export function accountDetailHeroActionSeparatorStyle(isLight: boolean): TextStyle {
  const palette = dashboardPaletteForTheme(isLight);
  return {
    ...interMediumText,
    fontSize: typography.meta,
    color: palette.border,
  };
}

/** Hero block wrapping actions + BankAccountCard. */
export function accountDetailHeroBlockStyle(): ViewStyle {
  return {
    gap: spacing.sm,
  };
}

/** 3-column statement stats row (Revenus · Net ce mois · Dépenses, etc.). */
export function accountDetailStatementStatsRowStyle(): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ACCOUNT_DETAIL_STATEMENT_COLUMNS.rowGap,
    paddingTop: ACCOUNT_DETAIL_STATEMENT_COLUMNS.rowPaddingTop,
  };
}

/** Single column in the statement stats row. */
export function accountDetailStatementStatColStyle(options?: {
  align?: 'left' | 'center' | 'right';
  prominent?: boolean;
}): ViewStyle {
  const align = options?.align ?? 'center';
  return {
    flex: options?.prominent ? ACCOUNT_DETAIL_STATEMENT_COLUMNS.prominentColFlex : ACCOUNT_DETAIL_STATEMENT_COLUMNS.colFlex,
    alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
    gap: ACCOUNT_DETAIL_STATEMENT_COLUMNS.colGap,
    minWidth: 0,
  };
}

/** Tabular hero stat value — 28px default, 32px when `prominent` (ex. « Net ce mois »). */
export function accountDetailStatementStatValueStyle(prominent?: boolean): TextStyle {
  return {
    ...interExtraBoldText,
    fontSize: prominent
      ? ACCOUNT_DETAIL_STATEMENT_COLUMNS.statValueProminentSize
      : ACCOUNT_DETAIL_STATEMENT_COLUMNS.statValueSize,
    fontVariant: ['tabular-nums'],
    letterSpacing: prominent
      ? ACCOUNT_DETAIL_STATEMENT_COLUMNS.statValueProminentLetterSpacing
      : ACCOUNT_DETAIL_STATEMENT_COLUMNS.statValueLetterSpacing,
    textAlign: 'center',
  };
}

/** Muted label under a statement stat (ex. « Revenus », « Net ce mois »). */
export function accountDetailStatementStatLabelStyle(): TextStyle {
  return {
    ...interMediumText,
    fontSize: ACCOUNT_DETAIL_STATEMENT_COLUMNS.statLabelSize,
    letterSpacing: ACCOUNT_DETAIL_STATEMENT_COLUMNS.statLabelLetterSpacing,
    textAlign: 'center',
  };
}

/** Hairline divider between account-detail blocks (stats → detail rows → recurring → history). */
export function accountDetailSectionDividerStyle(isLight: boolean): ViewStyle {
  const palette = dashboardPaletteForTheme(isLight);
  return {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.border,
  };
}

/**
 * Page détail marchand (`app/merchant-detail.tsx`) — réutilise le kit détail compte :
 *
 * 1. **Hero actions** — lien « Modifier » ({@link accountDetailHeroActionsStyle})
 * 2. **Identité marchand** — logo 48px ({@link MERCHANT_LOGO_SIZE}) + nom + catégorie dominante
 * 3. **Ligne stats** — Total dépensé · Transactions · Panier moyen
 *    ({@link accountDetailStatementStatsRowStyle})
 * 4. **Bibliothèque de reçus** — en-tête {@link accountDetailRecurringHeaderStyle} + aperçu horizontal
 * 5. **Historique** — recherche + filtres SegmentedTabs + groupes {@link TransactionRow}
 */

/**
 * Page détail contact (`app/contact-detail.tsx`) — kit détail compte adapté aux transferts :
 *
 * 1. **Barre supérieure** — retour + nom du contact centré
 * 2. **Identité contact** — avatar 48px + nom + badge « Employeur » si applicable
 *    ({@link accountDetailHeroBlockStyle})
 * 3. **Ligne stats transfert** — Reçu (+) · Net (prominent, vert/rouge) · Envoyé (−)
 *    ({@link accountDetailStatementStatsRowStyle}) ; net = total reçu − total envoyé
 * 4. **DetailRows secondaires** — Opérations, Période (hairline entre lignes)
 * 5. **Toggle employeur** — rangée ouverte avec Switch (si contact enregistré), sans GlassContainer
 * 6. **Historique** — recherche + filtres SegmentedTabs (Tous · Envoyés · Reçus) + groupes {@link TransactionRow}
 *
 * Règles couleur des valeurs stats :
 * - « Reçu » et « Envoyé » restent en `colors.text` avec préfixe +/− ;
 * - seul « Net » est coloré (vert si ≥ 0, rouge sinon).
 */

/** Bordered collapsible header for « Paiements récurrents de ce compte ». */
export function accountDetailRecurringHeaderStyle(isLight: boolean): ViewStyle {
  const palette = dashboardPaletteForTheme(isLight);
  return {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
    borderColor: palette.border,
    backgroundColor: palette.card,
  };
}

export {
  typographyKit,
  PAGE_TITLE_STYLE,
  SECTION_TITLE_STYLE,
} from './typographyKit';

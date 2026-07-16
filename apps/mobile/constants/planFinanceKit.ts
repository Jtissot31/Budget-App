import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import {
  CONTAINER_BORDER,
  CONTAINER_SURFACE,
  DARK_CANVAS,
  interMediumText,
  interSemiboldText,
  spacing,
  typography,
} from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';

/**
 * Theme kit — Plans financiers (hub, explorer, modèles, création).
 * Source unique des couleurs et mesures — ne pas hardcoder ailleurs.
 * Canvas matches app-wide pitch black ({@link DARK_CANVAS}).
 */
export const planFinanceKit = {
  colors: {
    background: DARK_CANVAS,
    surface: '#111111',
    surfaceElevated: '#2E2E34',
    input: '#1A1A1D',
    accent: '#4ADE80',
    danger: '#C96560',
    warning: '#C9974A',
    border: 'rgba(255, 255, 255, 0.12)',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.55)',
    textOnAccent: DARK_CANVAS,
  },
  radius: {
    card: 13,
    small: 8,
    button: 13,
    iconButton: 20,
  },
  layout: {
    cardPadding: 20,
    cardGap: 14,
    sectionGap: 24,
    fieldGap: 20,
    headerFieldGap: 24,
  },
} as const;

/** @deprecated Utiliser {@link planFinanceKit.colors} */
export const PLAN_HUB = {
  background: planFinanceKit.colors.background,
  surface: planFinanceKit.colors.surface,
  accent: planFinanceKit.colors.accent,
  danger: planFinanceKit.colors.danger,
  warning: planFinanceKit.colors.warning,
  border: planFinanceKit.colors.border,
  radiusCard: planFinanceKit.radius.card,
  radiusSmall: planFinanceKit.radius.small,
} as const;

export const PLAN_CARD_PADDING = planFinanceKit.layout.cardPadding;
export const PLAN_CARD_LIST_GAP = planFinanceKit.layout.cardGap;

/**
 * **Onyx container** — canonical card shell (plan financier / patrimoine / detail cards).
 *
 * Component: {@link OnyxContainer} (`components/OnyxContainer.tsx`) —
 * alias of {@link PlanFinanceContainer}.
 * Fill + outline from `useAppTheme().colors` (`containerBackground`, `containerBorder`).
 * Prefer the component for halo gradients; use these helpers for style-only surfaces.
 *
 * When the user asks to “appliquer onyx container”, use these tokens + `OnyxContainer`.
 */
export const ONYX_CONTAINER = {
  borderRadius: planFinanceKit.radius.card,
  borderWidth: 'hairline' as const,
  pressedOpacity: 0.82,
  padding: {
    /** Full-width list row (icon + copy + amount) — 12px all sides */
    row: spacing.md,
    /** 2-column compact stock tile — horizontal/top 12px, bottom 14px */
    compactTile: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md + 2,
    },
    /** Full card interior (detail sections, plan cards) — 20px */
    card: planFinanceKit.layout.cardPadding,
  },
  listGap: spacing.sm,
} as const;

/** @deprecated Use {@link ONYX_CONTAINER} — same tokens. */
export const PLAN_FINANCE_CONTAINER = ONYX_CONTAINER;

export type PlanFinanceContainerColors = {
  containerBackground: string;
  containerBorder: string;
};

/** Shell ViewStyle — Onyx fill, hairline outline, 13px radius, clip halo children. */
export function planFinanceContainerShellStyle(
  colors: PlanFinanceContainerColors,
): Pick<ViewStyle, 'backgroundColor' | 'borderColor' | 'borderRadius' | 'borderWidth' | 'overflow'> {
  return {
    backgroundColor: colors.containerBackground,
    borderColor: colors.containerBorder,
    borderRadius: ONYX_CONTAINER.borderRadius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  };
}

/** @see planFinanceContainerShellStyle */
export const onyxContainerShellStyle = planFinanceContainerShellStyle;

/** Press feedback on the outer `Pressable` wrapping an Onyx container — opacity 0.82. */
export function planFinanceContainerPressedStyle(): Pick<ViewStyle, 'opacity'> {
  return { opacity: ONYX_CONTAINER.pressedOpacity };
}

/** @see planFinanceContainerPressedStyle */
export const onyxContainerPressedStyle = planFinanceContainerPressedStyle;

/** Interior padding for full-width row tiles (icon + copy + amount). */
export function planFinanceContainerRowLayoutStyle(): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.md,
    padding: ONYX_CONTAINER.padding.row,
  };
}

/** @see planFinanceContainerRowLayoutStyle */
export const onyxContainerRowLayoutStyle = planFinanceContainerRowLayoutStyle;

/** Interior padding for 2-column compact stock / wealth grid tiles. */
export function planFinanceContainerCompactTilePaddingStyle(): Pick<
  ViewStyle,
  'paddingHorizontal' | 'paddingTop' | 'paddingBottom'
> {
  return ONYX_CONTAINER.padding.compactTile;
}

/** @see planFinanceContainerCompactTilePaddingStyle */
export const onyxContainerCompactTilePaddingStyle = planFinanceContainerCompactTilePaddingStyle;

/** Subtle charcoal halo inside plan finance cards — discrete top-left lift + soft wash. */
export const planFinanceCardHalo = {
  dark: {
    corner: ['rgba(200, 200, 208, 0.035)', 'rgba(140, 140, 148, 0.012)', 'transparent'] as const,
    cornerLocations: [0, 0.42, 0.78] as const,
    wash: ['rgba(180, 180, 188, 0.018)', 'transparent'] as const,
    washLocations: [0, 0.62] as const,
  },
  light: {
    corner: ['rgba(24, 24, 28, 0.05)', 'rgba(24, 24, 28, 0.015)', 'transparent'] as const,
    cornerLocations: [0, 0.42, 0.78] as const,
    wash: ['rgba(24, 24, 28, 0.025)', 'transparent'] as const,
    washLocations: [0, 0.62] as const,
  },
} as const;

/**
 * Style-only card shell aligned with {@link PlanFinanceContainer}
 * (same fill / outline / radius). Prefer the component when halo is desired.
 */
export function planFinanceCardStyle(
  colors: PlanFinanceContainerColors = {
    containerBackground: CONTAINER_SURFACE,
    containerBorder: CONTAINER_BORDER,
  },
): ViewStyle {
  return {
    ...planFinanceContainerShellStyle(colors),
    padding: planFinanceKit.layout.cardPadding,
  };
}

/** @deprecated Prefer {@link PlanFinanceContainer} — kept for style-only call sites. */
export function planFinanceCatalogCardStyle(
  colors?: PlanFinanceContainerColors,
): ViewStyle {
  return planFinanceCardStyle(colors);
}

/** @deprecated Même apparence que {@link planFinanceCardStyle} — plus de bordure pointillée verte. */
export function planFinanceSuggestedCardStyle(
  colors?: PlanFinanceContainerColors,
): ViewStyle {
  return planFinanceCardStyle(colors);
}

export function planFinanceCardIconColor(): string {
  return planFinanceKit.colors.textMuted;
}

export function planFinanceInputStyle(): ViewStyle {
  return {
    minHeight: 48,
    borderRadius: planFinanceKit.radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: planFinanceKit.colors.border,
    paddingHorizontal: spacing.md,
    backgroundColor: planFinanceKit.colors.input,
  };
}

export function planFinanceIconButtonStyle(): ViewStyle {
  return {
    width: 40,
    height: 40,
    borderRadius: planFinanceKit.radius.iconButton,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: planFinanceKit.colors.border,
    backgroundColor: planFinanceKit.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  };
}

export function planFinanceEyebrowStyle(): TextStyle {
  return {
    ...typographyKit.eyebrow,
    color: planFinanceKit.colors.textMuted,
  };
}

export function planFinancePrimaryButtonStyle(): ViewStyle {
  return {
    minHeight: 48,
    borderRadius: planFinanceKit.radius.button,
    backgroundColor: planFinanceKit.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  };
}

export function planFinanceSecondaryButtonStyle(): ViewStyle {
  return {
    minHeight: 48,
    borderRadius: planFinanceKit.radius.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: planFinanceKit.colors.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  };
}

export const planFinanceFonts = {
  screenTitle: typographyKit.pageTitle,
  sectionTitle: {
    ...interSemiboldText,
    fontSize: typography.body,
    lineHeight: 22,
    color: planFinanceKit.colors.text,
  },
  /** Card primary title — ~iOS Body / Material bodyLarge */
  cardTitle: {
    ...interSemiboldText,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
    color: planFinanceKit.colors.text,
  },
  /** Secondary meta line — ~iOS Footnote */
  cardMeta: {
    ...interMediumText,
    fontSize: 13,
    lineHeight: 18,
    color: planFinanceKit.colors.textMuted,
  },
  cardHint: {
    ...interMediumText,
    fontSize: typography.caption,
    lineHeight: 20,
    color: planFinanceKit.colors.textMuted,
  },
  sectionCaps: {
    ...interSemiboldText,
    fontSize: typography.micro,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: planFinanceKit.colors.accent,
  },
  body: {
    ...interMediumText,
    fontSize: typography.body,
    lineHeight: 22,
    color: planFinanceKit.colors.text,
  },
  heroTitle: {
    ...interSemiboldText,
    fontSize: 26,
    letterSpacing: -0.4,
    lineHeight: 32,
    color: planFinanceKit.colors.text,
  },
} as const;

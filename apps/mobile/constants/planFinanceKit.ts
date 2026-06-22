import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { interMediumText, interSemiboldText, spacing, typography } from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';

/**
 * Theme kit — Plans financiers (hub, explorer, modèles, création).
 * Source unique des couleurs et mesures — ne pas hardcoder ailleurs.
 */
export const planFinanceKit = {
  colors: {
    background: '#0E0E10',
    surface: '#111111',
    surfaceElevated: '#2E2E34',
    input: '#1A1A1D',
    accent: '#4ADE80',
    danger: '#C96560',
    warning: '#C9974A',
    border: 'rgba(255, 255, 255, 0.12)',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.55)',
    textOnAccent: '#0E0E10',
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

export function planFinanceCardStyle(): ViewStyle {
  return {
    backgroundColor: planFinanceKit.colors.surface,
    borderRadius: planFinanceKit.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: planFinanceKit.colors.border,
    padding: planFinanceKit.layout.cardPadding,
  };
}

export function planFinanceCatalogCardStyle(): ViewStyle {
  return planFinanceCardStyle();
}

export function planFinanceSuggestedCardStyle(): ViewStyle {
  return {
    ...planFinanceCardStyle(),
    borderStyle: 'dashed',
    borderColor: 'rgba(74, 222, 128, 0.38)',
  };
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
    fontSize: typography.caption,
    color: planFinanceKit.colors.text,
  },
  cardTitle: {
    ...interSemiboldText,
    fontSize: 13,
    lineHeight: 18,
    color: planFinanceKit.colors.text,
  },
  cardMeta: {
    ...interMediumText,
    fontSize: 11,
    lineHeight: 15,
    color: planFinanceKit.colors.textMuted,
  },
  cardHint: {
    ...interMediumText,
    fontSize: typography.meta,
    lineHeight: 20,
    color: planFinanceKit.colors.textMuted,
  },
  sectionCaps: {
    ...interSemiboldText,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase' as const,
    color: planFinanceKit.colors.accent,
  },
  body: {
    ...interMediumText,
    fontSize: 14,
    lineHeight: 21,
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

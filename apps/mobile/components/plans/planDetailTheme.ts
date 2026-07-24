import { StyleSheet } from 'react-native';
import {
  interMediumText,
  interRegularText,
  interSemiboldText,
  spacing,
} from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

/**
 * Typography + layout constants for plan detail.
 * Colors come from {@link usePlanDetailTheme} (useAppTheme), not hardcoded hex.
 */
export const planDetailFonts = {
  heroAmount: [interSemiboldText, { fontSize: 26, letterSpacing: -0.4, lineHeight: 32 }] as const,
  heroMeta: [interRegularText, { fontSize: 13, lineHeight: 19 }] as const,
  sectionCaps: [interSemiboldText, { fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase' as const }] as const,
  body: [interRegularText, { fontSize: 14, lineHeight: 21 }] as const,
  bodyMedium: [interMediumText, { fontSize: 14, lineHeight: 21 }] as const,
  stepLabel: [interSemiboldText, { fontSize: 14, lineHeight: 20 }] as const,
  stepMeta: [interRegularText, { fontSize: 12, lineHeight: 17 }] as const,
  detailLabel: [interRegularText, { fontSize: 13, lineHeight: 18 }] as const,
  detailValue: [interMediumText, { fontSize: 13, lineHeight: 18 }] as const,
};

export const PLAN_DETAIL_LAYOUT = {
  radiusCard: 13,
  radiusSmall: 8,
  sectionGap: spacing.xxl,
  cardPadding: spacing.lg,
} as const;

/** @deprecated Prefer {@link usePlanDetailTheme} — kept for StyleSheet static refs. */
export const PLAN_DETAIL = {
  background: '#050505',
  surface: '#1C1C1E',
  accent: '#4ADE80',
  accentMuted: 'rgba(74, 222, 128, 0.15)',
  text: '#F4F4F5',
  textMuted: '#A1A1AA',
  border: 'rgba(255, 255, 255, 0.12)',
  ...PLAN_DETAIL_LAYOUT,
} as const;

export function usePlanDetailTheme() {
  const { colors } = useAppTheme();
  return {
    background: colors.screenCanvas || colors.background,
    surface: colors.containerBackground,
    accent: colors.primary || colors.accentGreen,
    accentMuted: colors.successMuted,
    text: colors.text,
    textMuted: colors.textMuted,
    border: colors.containerBorder,
    ...PLAN_DETAIL_LAYOUT,
  };
}

export function planDetailCardStyleFromTheme(theme: ReturnType<typeof usePlanDetailTheme>) {
  return {
    backgroundColor: theme.surface,
    borderRadius: theme.radiusCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    padding: theme.cardPadding,
  };
}

/** @deprecated Prefer {@link planDetailCardStyleFromTheme}. */
export const planDetailCardStyle = StyleSheet.create({
  card: {
    backgroundColor: PLAN_DETAIL.surface,
    borderRadius: PLAN_DETAIL.radiusCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PLAN_DETAIL.border,
    padding: PLAN_DETAIL.cardPadding,
  },
});

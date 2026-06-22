import { StyleSheet } from 'react-native';
import { interMediumText, interRegularText, interSemiboldText, spacing } from '@/constants/theme';

/** Palette dédiée écran détail plan (Wealthsimple-inspired). */
export const PLAN_DETAIL = {
  background: '#0E0E10',
  surface: '#111111',
  accent: '#4ADE80',
  accentMuted: 'rgba(74, 222, 128, 0.15)',
  text: '#F4F4F5',
  textMuted: '#A1A1AA',
  border: 'rgba(255, 255, 255, 0.12)',
  radiusCard: 13,
  radiusSmall: 8,
  sectionGap: spacing.xxl,
  cardPadding: spacing.lg,
} as const;

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

export const planDetailCardStyle = StyleSheet.create({
  card: {
    backgroundColor: PLAN_DETAIL.surface,
    borderRadius: PLAN_DETAIL.radiusCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PLAN_DETAIL.border,
    padding: PLAN_DETAIL.cardPadding,
  },
});

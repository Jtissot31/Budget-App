import { useMemo } from 'react';
import type { TextStyle } from 'react-native';
import { MONEY_AMOUNT_FONT } from '@/constants/interFonts';
import { planFinanceKit } from '@/constants/planFinanceKit';
import {
  CONTAINER_BORDER,
  CONTAINER_SURFACE,
  DASHBOARD_VALUE_GREEN,
  DASHBOARD_VALUE_RED,
  chartTokens,
  darkColors,
  moneyAmountTypography,
  spacing,
} from '@/constants/theme';
import {
  APP_MAX_FONT_SIZE_MULTIPLIER,
  MONEY_MAX_FONT_SIZE_MULTIPLIER,
  NARROW_CONTENT_WIDTH,
} from '@/lib/displayScale';
import {
  heroAmountTextProps,
  keyStatPhraseTextProps,
  scaleSafeLabelTextProps,
  singleLineAmountProps,
} from '@/lib/textLayout';

export {
  APP_MAX_FONT_SIZE_MULTIPLIER,
  MONEY_MAX_FONT_SIZE_MULTIPLIER,
  NARROW_CONTENT_WIDTH,
  heroAmountTextProps,
  keyStatPhraseTextProps,
  scaleSafeLabelTextProps,
  singleLineAmountProps,
};

/** Premium Onyx card radius — aligned with planFinanceKit / OnyxContainer. */
export const AI_WIDGET_RADIUS = planFinanceKit.radius.card;

/** Fyn chat widgets always render in dark premium style (Onyx palette). */
export const fynWidgetTokens = {
  background: planFinanceKit.colors.background,
  surface: CONTAINER_SURFACE,
  border: CONTAINER_BORDER,
  green: DASHBOARD_VALUE_GREEN,
  red: DASHBOARD_VALUE_RED,
  /** Muted expense / deficit bar fill — softer than dashboard red text. */
  expense: planFinanceKit.colors.danger,
  expenseMuted: darkColors.dangerMuted,
  successMuted: darkColors.successMuted,
  warningMuted: darkColors.warningMuted,
  dangerMuted: darkColors.dangerMuted,
  text: planFinanceKit.colors.text,
  textMuted: planFinanceKit.colors.textMuted,
  track: planFinanceKit.colors.input,
  warning: planFinanceKit.colors.warning,
  info: chartTokens.line,
  accent: planFinanceKit.colors.accent,
  padding: spacing.lg,
} as const;

/** Consistent multi-series palette for bar / allocation charts. */
export const FYN_CHART_SERIES = [
  chartTokens.line,
  '#5B8DEF',
  '#F5A623',
  '#E85D75',
  '#9B59B6',
  '#1ABC9C',
  '#7AF5B4',
  '#8E8E93',
] as const;

export function fynChartSeriesColor(index: number): string {
  return FYN_CHART_SERIES[index % FYN_CHART_SERIES.length] ?? chartTokens.line;
}

export type AIWidgetColors = typeof fynWidgetTokens;

export function useAIWidgetColors(): AIWidgetColors {
  return useMemo(() => fynWidgetTokens, []);
}

/** Widget font families — Plus Jakarta Sans UI + Inter money amounts (matches transaction list). */
export const aiWidgetFonts = {
  title: 'PlusJakartaSans_800ExtraBold',
  label: 'PlusJakartaSans_500Medium',
  labelRegular: 'PlusJakartaSans_400Regular',
  /** Inter 800 ExtraBold — same face as transaction row amounts. */
  amount: MONEY_AMOUNT_FONT,
  /** @deprecated Use {@link aiWidgetAmountTypography} or {@link aiWidgetFonts.amount}. */
  mono: MONEY_AMOUNT_FONT,
} as const;

export type AIWidgetAmountSize = 'caption' | 'row' | 'card' | 'badge' | 'value';

const aiWidgetAmountSizes: Record<
  AIWidgetAmountSize,
  { fontSize: number; lineHeight?: number; letterSpacing?: number }
> = {
  caption: { fontSize: 12 },
  row: { fontSize: 15 },
  card: { fontSize: 16, letterSpacing: -0.3 },
  badge: { fontSize: 18 },
  value: { fontSize: 22, letterSpacing: -0.5 },
};

/** Canonical money typography for Fyn chat widgets — Inter 800, matches Historique transactions. */
export function aiWidgetAmountTypography(size: AIWidgetAmountSize = 'card'): TextStyle {
  const preset = aiWidgetAmountSizes[size];
  return moneyAmountTypography({
    tier: size === 'value' ? 'stat' : 'row',
    fontSize: preset.fontSize,
    lineHeight: preset.lineHeight,
    letterSpacing: preset.letterSpacing,
  });
}

/**
 * Static widget type styles. `value` is built without calling {@link moneyAmountTypography}
 * at module load (avoids TDZ if this file loads during theme init).
 */
export const aiWidgetTypography = {
  eyebrow: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  value: {
    fontFamily: MONEY_AMOUNT_FONT,
    fontWeight: 'normal' as const,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
    fontSize: 22,
    letterSpacing: -0.5,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
  },
  /** Supporting insight copy — between eyebrow and chart data. */
  insight: {
    fontSize: 13,
    lineHeight: 18,
  },
  legend: {
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
    minWidth: 0,
  },
} as const;

/** Shared Text props for widget money cells (tables, metrics, heroes). */
export const aiWidgetAmountTextProps = singleLineAmountProps;

/** Shared Text props for widget hero surplus / balance amounts. */
export const aiWidgetHeroAmountTextProps = heroAmountTextProps;

/** Shared Text props for widget labels in flex rows. */
export const aiWidgetLabelTextProps = scaleSafeLabelTextProps;

/** Key progress / goal phrases — wrap + shrink, never mid-phrase ellipsis. */
export const aiWidgetKeyStatTextProps = keyStatPhraseTextProps;

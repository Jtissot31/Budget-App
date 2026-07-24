import type { TextStyle } from 'react-native';

import { MONEY_AMOUNT_FONT } from '@/constants/interFonts';
import { typographyKit } from '@/constants/typographyKit';
import {
  APP_MAX_FONT_SIZE_MULTIPLIER,
  MONEY_MAX_FONT_SIZE_MULTIPLIER,
} from '@/lib/displayScale';

export {
  APP_MAX_FONT_SIZE_MULTIPLIER,
  MONEY_MAX_FONT_SIZE_MULTIPLIER,
} from '@/lib/displayScale';

/**
 * Build money TextStyle from typographyKit presets without importing `@/constants/theme`.
 * Avoids circular init / TDZ when this module loads during theme evaluation.
 */
function moneyFromPreset(
  preset: {
    fontVariant: TextStyle['fontVariant'];
    fontSize: number;
    letterSpacing?: number;
    lineHeight?: number;
    textAlign?: TextStyle['textAlign'];
  },
  overrides?: {
    fontSize?: number;
    lineHeight?: number;
    letterSpacing?: number;
    textAlign?: TextStyle['textAlign'];
  },
): TextStyle {
  return {
    fontFamily: MONEY_AMOUNT_FONT,
    fontWeight: 'normal' as const,
    fontVariant: preset.fontVariant,
    fontSize: overrides?.fontSize ?? preset.fontSize,
    lineHeight: overrides?.lineHeight ?? ('lineHeight' in preset ? preset.lineHeight : undefined),
    letterSpacing: overrides?.letterSpacing ?? preset.letterSpacing,
    ...(preset.textAlign ? { textAlign: preset.textAlign } : null),
    ...(overrides?.textAlign != null ? { textAlign: overrides.textAlign } : null),
  };
}

/**
 * Text display rules (chips, tabs, pills):
 * - Never break/cut a word in the middle — `numberOfLines` + `ellipsizeMode="tail"` at end of line only, or wrap at word boundaries.
 * - Single-line chip labels: chip needs min padding + minWidth; `adjustsFontSizeToFit` + `minimumFontScale` only as last resort.
 * - Selected chip state must keep the same inner content box — see `CHIP_BORDER_WIDTH` in `constants/theme.ts`.
 */

/** Default minimum scale when auto-shrinking single-line chip/tab labels (last resort). */
export const CHIP_LABEL_MIN_FONT_SCALE = 0.82;

/** Props for single-line chip / tab / pill labels — tail ellipsis only, never mid-word break. */
export function chipLabelTextProps(options?: { minScale?: number }) {
  const minScale = options?.minScale ?? CHIP_LABEL_MIN_FONT_SCALE;
  return noMidWordClipTextProps({ minScale, singleLine: true });
}

/**
 * Reusable text props so labels never clip mid-character.
 * - Single-line pills/chips: `adjustsFontSizeToFit` + `minimumFontScale` (last resort before tail ellipsis).
 * - Multi-line: `numberOfLines` + `ellipsizeMode="tail"` (word boundary when possible).
 */
export function noMidWordClipTextProps(options?: {
  minScale?: number;
  singleLine?: boolean;
  maxLines?: number;
}) {
  const minScale = options?.minScale ?? CHIP_LABEL_MIN_FONT_SCALE;
  const singleLine = options?.singleLine ?? true;
  if (singleLine) {
    return {
      numberOfLines: 1 as const,
      ellipsizeMode: 'tail' as const,
      adjustsFontSizeToFit: true,
      minimumFontScale: minScale,
    };
  }
  return {
    numberOfLines: options?.maxLines ?? 2,
    ellipsizeMode: 'tail' as const,
  };
}

/** Text style for labels inside flex rows that must shrink without forcing parent overflow. */
export const singleLineLabelStyle: Pick<TextStyle, 'flexShrink' | 'minWidth'> = {
  flexShrink: 1,
  minWidth: 0,
};

/**
 * Numeric & list layout helpers — money amounts use Inter 800 via {@link moneyFromPreset}.
 * (Do not import `moneyAmountTypography` from theme here — circular TDZ risk.)
 */
export const portfolioNumericText = moneyFromPreset(typographyKit.rowAmount);

export const chartMetricAmount = moneyFromPreset(typographyKit.cardMetric);

export const dashboardPaymentAmount = moneyFromPreset(typographyKit.heroStat);

export const heroStatAmount = moneyFromPreset(typographyKit.heroStat);

export const detailHeroAmount = moneyFromPreset(typographyKit.detailHero);

/** Secondary hero amount (e.g. budget limit beside spent) — one tier below hero. */
export const detailHeroSecondaryAmount = moneyFromPreset(typographyKit.rowAmount);

/** Detail sheet row label (Limite mensuelle, Type, Date…). */
export const detailRowLabelText = typographyKit.metaMedium;

/** Detail sheet row value — money (14px ExtraBold tabular). */
export const detailRowValueMoney = moneyFromPreset(typographyKit.rowAmount);

/** Detail sheet row value — text (dates, categories, %). */
export const detailRowValueText = typographyKit.metaMedium;

/** Select / picker values (Compte, Catégorie) — smaller, wraps to 2 lines. */
export const detailRowSelectValueText = typographyKit.metaMedium;

export const percentStat = typographyKit.percent;

export const netWorthHeroAmount = moneyFromPreset(typographyKit.netWorthHero);

/** Max width for right-column amounts in row layouts */
export const ROW_VALUE_MAX_WIDTH = '40%' as const;

/** Detail section row label — truncates before the value column grows */
export const detailRowLabelSlot = {
  flexShrink: 0,
  alignSelf: 'flex-start' as const,
} as const;

/** @deprecated Use detailRowLabelSlot on a wrapper View */
export const detailRowLabel = detailRowLabelSlot;

/** Detail section row value slot — fills remaining row width */
export const detailRowValueSlot = {
  flex: 1,
  flexShrink: 1,
  minWidth: 0,
  flexDirection: 'row' as const,
  alignItems: 'flex-start' as const,
  justifyContent: 'flex-end' as const,
} as const;

/** Alias for callers preferring "container" naming */
export const detailRowValueContainer = detailRowValueSlot;

/** EditableField container inside a detail row value column */
export const detailRowEditableContainer = {
  flex: 1,
  minWidth: 0,
  alignSelf: 'stretch' as const,
} as const;

/** Text props for detail row values (account names, categories, dates) */
export const detailRowValueTextProps = {
  numberOfLines: 1 as const,
  ellipsizeMode: 'tail' as const,
};

/** Select / picker values in detail rows — two lines before tail ellipsis */
export const detailRowSelectValueTextProps = {
  numberOfLines: 2 as const,
  ellipsizeMode: 'tail' as const,
};

/** Minimum scale when auto-shrinking single-line numeric labels */
export const SINGLE_LINE_MIN_FONT_SCALE = 0.75;

/** Hero / net-worth amounts that may shrink further inside cards. */
export const HERO_AMOUNT_MIN_FONT_SCALE = 0.65;

/** Flex container for left-column text that should wrap */
export const flexText = {
  flex: 1,
  minWidth: 0,
  flexShrink: 1,
} as const;

/** Right column wrapper for amounts / fixed labels */
export const rowValueContainer = {
  flexShrink: 0,
  maxWidth: ROW_VALUE_MAX_WIDTH,
  alignItems: 'flex-end' as const,
} as const;

/** Row title / merchant / category label typography */
export const rowLabel = {
  ...flexText,
  ...typographyKit.rowTitle,
} as const;

/** List row title — Historique, Portefeuille lists */
export const listRowTitle = {
  ...rowLabel,
} as const;

/**
 * Standard list amount (14px Inter tabular).
 * Use with rowValueContainer + singleLineAmountProps on the Text.
 */
export const rowValue = moneyFromPreset(typographyKit.rowAmount);

/** Day-group subtotal in transaction lists */
export const listDayTotal = moneyFromPreset(typographyKit.rowAmount);

/** Props for amounts that must stay on one line (list rows, card metrics). */
export const singleLineAmountProps = {
  numberOfLines: 1 as const,
  adjustsFontSizeToFit: true,
  minimumFontScale: SINGLE_LINE_MIN_FONT_SCALE,
  ellipsizeMode: 'tail' as const,
  maxFontSizeMultiplier: MONEY_MAX_FONT_SIZE_MULTIPLIER,
};

/**
 * Props for large hero / surplus amounts inside constrained card widths.
 * Prefer this over bare `adjustsFontSizeToFit` on netWorth / stat tiers.
 */
export const heroAmountTextProps = {
  numberOfLines: 1 as const,
  adjustsFontSizeToFit: true,
  minimumFontScale: HERO_AMOUNT_MIN_FONT_SCALE,
  ellipsizeMode: 'tail' as const,
  maxFontSizeMultiplier: MONEY_MAX_FONT_SIZE_MULTIPLIER,
};

/**
 * Props for secondary labels in flex rows (legends, category names, debt names).
 * Ellipsis only — no mid-word clip; accessibility scale still capped globally.
 */
export const scaleSafeLabelTextProps = {
  numberOfLines: 1 as const,
  ellipsizeMode: 'tail' as const,
  maxFontSizeMultiplier: APP_MAX_FONT_SIZE_MULTIPLIER,
};

/**
 * Key stat phrases (e.g. « 70 % de l'objectif ») — full wrap, never mid-phrase ellipsis.
 * Do not set `numberOfLines={1}` / `ellipsizeMode` on these.
 */
export const keyStatPhraseTextProps = {
  maxFontSizeMultiplier: APP_MAX_FONT_SIZE_MULTIPLIER,
};

/** Props for titles that may wrap to two lines */
export const rowTitleTextProps = {
  numberOfLines: 2 as const,
  ellipsizeMode: 'tail' as const,
};

/** Single-line list row titles — tail ellipsis only, no font scaling. */
export const singleLineRowTitleTextProps = {
  numberOfLines: 1 as const,
  ellipsizeMode: 'tail' as const,
};

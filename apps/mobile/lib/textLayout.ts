import type { TextStyle } from 'react-native';

import { moneyAmountTypography } from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';

/**
 * Text display rules (chips, tabs, pills):
 * - Never break/cut a word in the middle â€” `numberOfLines` + `ellipsizeMode="tail"` at end of line only, or wrap at word boundaries.
 * - Single-line chip labels: chip needs min padding + minWidth; `adjustsFontSizeToFit` + `minimumFontScale` only as last resort.
 * - Selected chip state must keep the same inner content box â€” see `CHIP_BORDER_WIDTH` in `constants/theme.ts`.
 */

/** Default minimum scale when auto-shrinking single-line chip/tab labels (last resort). */
export const CHIP_LABEL_MIN_FONT_SCALE = 0.82;

/** Props for single-line chip / tab / pill labels â€” tail ellipsis only, never mid-word break. */
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
 * Numeric & list layout helpers â€” built on `typographyKit` (Portefeuille reference).
 */
export const portfolioNumericText = {
  ...typographyKit.cardMetric,
  fontSize: typographyKit.rowAmount.fontSize,
  letterSpacing: typographyKit.rowAmount.letterSpacing,
} as const;

export const chartMetricAmount = typographyKit.cardMetric;

export const dashboardPaymentAmount = typographyKit.paymentAmount;

export const heroStatAmount = typographyKit.heroStat;

export const detailHeroAmount = typographyKit.detailHero;

/** Secondary hero amount (e.g. budget limit beside spent) â€” one tier below hero. */
export const detailHeroSecondaryAmount = moneyAmountTypography({ tier: 'row' });

/** Detail sheet row label (Limite mensuelle, Type, Dateâ€¦). */
export const detailRowLabelText = typographyKit.metaMedium;

/** Detail sheet row value â€” money (14px ExtraBold tabular). */
export const detailRowValueMoney = moneyAmountTypography({ tier: 'row' });

/** Detail sheet row value â€” text (dates, categories, %). */
export const detailRowValueText = typographyKit.metaMedium;

/** Select / picker values (Compte, Catégorie) — smaller, wraps to 2 lines. */
export const detailRowSelectValueText = typographyKit.metaMedium;

export const percentStat = typographyKit.percent;

export const netWorthHeroAmount = typographyKit.netWorthHero;

/** Max width for right-column amounts in row layouts */
export const ROW_VALUE_MAX_WIDTH = '40%' as const;

/** Detail section row label â€” truncates before the value column grows */
export const detailRowLabelSlot = {
  flexShrink: 0,
  alignSelf: 'flex-start' as const,
} as const;

/** @deprecated Use detailRowLabelSlot on a wrapper View */
export const detailRowLabel = detailRowLabelSlot;

/** Detail section row value slot â€” fills remaining row width */
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

/** Select / picker values in detail rows â€” two lines before tail ellipsis */
export const detailRowSelectValueTextProps = {
  numberOfLines: 2 as const,
  ellipsizeMode: 'tail' as const,
};

/** Minimum scale when auto-shrinking single-line numeric labels */
export const SINGLE_LINE_MIN_FONT_SCALE = 0.85;

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

/** List row title â€” Historique, Portefeuille lists */
export const listRowTitle = {
  ...rowLabel,
} as const;

/**
 * Standard list amount (14px ExtraBold tabular).
 * Use with rowValueContainer + singleLineAmountProps on the Text.
 */
export const rowValue = {
  ...typographyKit.rowAmount,
} as const;

/** Day-group subtotal in transaction lists */
export const listDayTotal = {
  ...rowValue,
  flexShrink: 0,
} as const;

/** Props for amounts that must stay on one line */
export const singleLineAmountProps = {
  numberOfLines: 1 as const,
  adjustsFontSizeToFit: true,
  minimumFontScale: SINGLE_LINE_MIN_FONT_SCALE,
  ellipsizeMode: 'tail' as const,
};

/** Props for titles that may wrap to two lines */
export const rowTitleTextProps = {
  numberOfLines: 2 as const,
  ellipsizeMode: 'tail' as const,
};

/** Single-line list row titles â€” tail ellipsis only, no font scaling. */
export const singleLineRowTitleTextProps = {
  numberOfLines: 1 as const,
  ellipsizeMode: 'tail' as const,
};

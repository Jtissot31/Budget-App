import { typographyKit } from '@/constants/typographyKit';

/**
 * Numeric & list layout helpers — built on `typographyKit` (Portefeuille reference).
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

export const percentStat = typographyKit.percent;

export const netWorthHeroAmount = typographyKit.netWorthHero;

/** Max width for right-column amounts in row layouts */
export const ROW_VALUE_MAX_WIDTH = '40%' as const;

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

/** List row title — Historique, Portefeuille lists */
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

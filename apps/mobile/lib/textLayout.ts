import { typography } from '@/constants/theme';

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
  fontSize: typography.caption,
  fontWeight: '700' as const,
  lineHeight: typography.caption + 4,
} as const;

/** Row amount typography */
export const rowValue = {
  fontSize: typography.caption,
  fontWeight: '700' as const,
  fontVariant: ['tabular-nums'] as const,
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

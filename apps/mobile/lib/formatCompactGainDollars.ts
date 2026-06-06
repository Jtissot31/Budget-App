import {
  COMPACT_K_THRESHOLD,
  formatDisplayMoney,
  formatDisplayMoneyAbsolute,
  formatSignedDisplayMoney,
  type FormatSignedDisplayMoneyOptions,
} from '@/lib/formatDisplayMoney';

/** @deprecated Use {@link COMPACT_K_THRESHOLD} from `@/lib/formatDisplayMoney`. */
export const COMPACT_GAIN_DOLLARS_THRESHOLD = COMPACT_K_THRESHOLD;

export type FormatCompactGainDollarsOptions = FormatSignedDisplayMoneyOptions;

/**
 * Absolute dollar magnitude with unified display rules.
 * @see formatDisplayMoneyAbsolute
 */
export function formatCompactGainDollarMagnitude(absValue: number): string {
  return formatDisplayMoneyAbsolute(absValue);
}

/** Alias for non–gain/delta contexts (chart magnitudes, legend amounts). */
export const formatCompactMoneyMagnitude = formatCompactGainDollarMagnitude;

/**
 * Formats signed **gain / loss / delta** dollar amounts.
 * Uses Unicode minus (−). For any signed currency, {@link formatCompactCurrency} delegates here.
 */
export function formatCompactGainDollars(
  value: number,
  options?: FormatCompactGainDollarsOptions,
): string {
  return formatSignedDisplayMoney(value, options);
}

export type FormatCompactCurrencyOptions = FormatCompactGainDollarsOptions;

/**
 * Formats any signed currency amount (balances, net worth, chart callouts).
 */
export function formatCompactCurrency(value: number, options?: FormatCompactCurrencyOptions): string {
  return formatSignedDisplayMoney(value, options);
}

/**
 * For UI that renders the amount and a separate muted `$` span on the same baseline row.
 * The main string never includes `$`.
 */
export function formatFrCaMoneyMainAndSeparatedDollarSuffix(value: number): {
  main: string;
  appendSeparatedDollar: boolean;
} {
  return formatDisplayMoney(value);
}

export { COMPACT_K_THRESHOLD, COMPACT_M_THRESHOLD, formatDisplayMoney, formatDisplayMoneyAbsolute, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';

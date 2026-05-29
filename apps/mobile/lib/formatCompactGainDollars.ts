const LOCALE = 'fr-CA';

/** Matches app convention: compact thousands for large **change / gain / loss** dollar amounts only. */
export const COMPACT_GAIN_DOLLARS_THRESHOLD = 10_000;

function roundToNearestTenth(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Absolute dollar magnitude: standard `fr-CA` currency under {@link COMPACT_GAIN_DOLLARS_THRESHOLD},
 * else one-decimal compact thousands with `K$` suffix (e.g. `10K$`, `10,1K$`).
 * Use in charts, legends, and unsigned totals; signed wrappers: {@link formatCompactGainDollars}, {@link formatCompactCurrency}.
 */
export function formatCompactGainDollarMagnitude(absValue: number): string {
  const abs = Math.abs(absValue);
  if (!Number.isFinite(abs)) {
    return `${(0).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
  }
  if (abs < COMPACT_GAIN_DOLLARS_THRESHOLD) {
    return `${abs.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
  }

  const k = roundToNearestTenth(abs / 1000);
  const isWholeTenThousandSteps = Number.isFinite(k) && Math.abs(k - Math.round(k)) < 1e-6;
  const numPart = isWholeTenThousandSteps
    ? Math.round(k).toLocaleString(LOCALE, { maximumFractionDigits: 0 })
    : k.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${numPart}K$`;
}

/** Alias for non–gain/delta contexts (chart magnitudes, legend amounts). */
export const formatCompactMoneyMagnitude = formatCompactGainDollarMagnitude;

export type FormatCompactGainDollarsOptions = {
  /**
   * When true, prefixes strictly positive amounts with '+' (chart caption, pill breakdown).
   * Default false matches `accounts` wealth rows (`formatSignedMoney` — no '+' on gains).
   */
  leadingPlusWhenPositive?: boolean;
};

/**
 * Formats signed **gain / loss / delta** dollar amounts with compact thousands when {@link COMPACT_GAIN_DOLLARS_THRESHOLD} applies.
 * Uses Unicode minus (−). For any signed currency (including balances), {@link formatCompactCurrency} delegates here.
 */
export function formatCompactGainDollars(
  value: number,
  options?: FormatCompactGainDollarsOptions,
): string {
  const leadingPlus = options?.leadingPlusWhenPositive === true && value > 0;
  const sign = value < 0 ? '−' : leadingPlus ? '+' : '';
  return `${sign}${formatCompactGainDollarMagnitude(Math.abs(value))}`;
}

export type FormatCompactCurrencyOptions = FormatCompactGainDollarsOptions;

/**
 * Formats any signed currency amount (balances, net worth, chart callouts) with the same threshold and `fr-CA` rules as gains.
 * Below {@link COMPACT_GAIN_DOLLARS_THRESHOLD} uses two decimal places and a trailing ` $`; compact uses `K$` with no space.
 */
export function formatCompactCurrency(value: number, options?: FormatCompactCurrencyOptions): string {
  return formatCompactGainDollars(value, options);
}

/**
 * For UI that renders the amount and a separate muted `$` span on the same baseline row.
 * The main string never includes `$`; compact values use a `K` suffix (e.g. `12,5K`).
 */
export function formatFrCaMoneyMainAndSeparatedDollarSuffix(value: number): {
  main: string;
  appendSeparatedDollar: boolean;
} {
  const abs = Math.abs(value);
  if (!Number.isFinite(abs)) {
    return {
      main: (0).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      appendSeparatedDollar: true,
    };
  }
  if (abs < COMPACT_GAIN_DOLLARS_THRESHOLD) {
    return {
      main: abs.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      appendSeparatedDollar: true,
    };
  }
  const compact = formatCompactMoneyMagnitude(abs);
  return { main: compact.endsWith('$') ? compact.slice(0, -1) : compact, appendSeparatedDollar: true };
}

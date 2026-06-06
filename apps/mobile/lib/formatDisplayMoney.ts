const LOCALE = 'fr-CA';

/** Full fr-CA amounts below this use space thousands and comma decimals. */
export const COMPACT_K_THRESHOLD = 100_000;

/** Amounts at or above this use one-decimal `M` compact notation. */
export const COMPACT_M_THRESHOLD = 1_000_000;

export type FormatDisplayMoneyParts = {
  main: string;
  appendSeparatedDollar: boolean;
};

function roundToNearestTenth(n: number): number {
  return Math.round(n * 10) / 10;
}

function hasFractionalCents(abs: number): boolean {
  return Math.abs(abs - Math.round(abs)) > 1e-9;
}

function formatFullFrCaAmount(abs: number): string {
  const hasCents = hasFractionalCents(abs);
  return abs.toLocaleString(LOCALE, {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  });
}

function formatCompactKAmount(abs: number): string {
  const k = abs / 1000;
  const isWholeK = Math.abs(k - Math.round(k)) < 1e-6;
  const numPart = isWholeK
    ? Math.round(k).toLocaleString(LOCALE, { maximumFractionDigits: 0 })
    : roundToNearestTenth(k).toLocaleString(LOCALE, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
  return `${numPart}k`;
}

function formatCompactMAmount(abs: number): string {
  const m = abs / COMPACT_M_THRESHOLD;
  const isWholeM = Math.abs(m - Math.round(m)) < 1e-6;
  const numPart = isWholeM
    ? Math.round(m).toLocaleString(LOCALE, { maximumFractionDigits: 0 })
    : roundToNearestTenth(m).toLocaleString(LOCALE, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
  return `${numPart}M`;
}

/**
 * Splits a dollar amount for UI that renders the numeric part and an optional separate `$` span.
 * Under {@link COMPACT_K_THRESHOLD}: full fr-CA (e.g. `1 500,40`, `15 500`).
 * From 100k to 999k: compact `k` (e.g. `100k`, `125,5k`).
 * From 1M: compact `M` (e.g. `5,7M`).
 */
export function formatDisplayMoney(value: number): FormatDisplayMoneyParts {
  const abs = Math.abs(value);
  if (!Number.isFinite(abs)) {
    return { main: formatFullFrCaAmount(0), appendSeparatedDollar: true };
  }

  if (abs < COMPACT_K_THRESHOLD) {
    return { main: formatFullFrCaAmount(abs), appendSeparatedDollar: true };
  }

  if (abs < COMPACT_M_THRESHOLD) {
    return { main: formatCompactKAmount(abs), appendSeparatedDollar: true };
  }

  return { main: formatCompactMAmount(abs), appendSeparatedDollar: true };
}

/** Absolute magnitude with attached `$` suffix (e.g. `15 500$`, `125,5k$`, `5,7M$`). */
export function formatDisplayMoneyAbsolute(absValue: number): string {
  const { main, appendSeparatedDollar } = formatDisplayMoney(absValue);
  return appendSeparatedDollar ? `${main}$` : main;
}

export type FormatSignedDisplayMoneyOptions = {
  /** When true, prefixes strictly positive amounts with '+'. */
  leadingPlusWhenPositive?: boolean;
};

/** Signed display string with attached `$` and Unicode minus (−). */
export function formatSignedDisplayMoney(
  value: number,
  options?: FormatSignedDisplayMoneyOptions,
): string {
  const leadingPlus = options?.leadingPlusWhenPositive === true && value > 0;
  const sign = value < 0 ? '−' : leadingPlus ? '+' : '';
  return `${sign}${formatDisplayMoneyAbsolute(Math.abs(value))}`;
}

/** Prefix recurring payment amounts: `+` for income, `−` for expense/payment. */
export function formatRecurringPaymentAmount(
  amount: number,
  kind?: 'payment' | 'income' | null,
): string {
  const prefix = kind === 'income' ? '+' : kind === 'payment' ? '−' : '';
  return `${prefix}${formatDisplayMoneyAbsolute(amount)}`;
}

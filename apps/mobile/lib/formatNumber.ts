/** French Canadian locale — space thousands, comma decimals. */
export const FR_CA_NUMBER_LOCALE = 'fr-CA';

/** Regex matching common grouping separators (ASCII + Unicode spaces from fr-CA locale). */
const GROUPING_SEPARATORS = /[\s\u00a0\u202f\u2007\u2009\u205f\u3000]/g;

/** Integer part gets grouping from 1 000+ (4+ digits). */
const THOUSANDS_MIN_DIGITS = 4;

export function stripNumberGrouping(value: string): string {
  return value.replace(GROUPING_SEPARATORS, '');
}

/**
 * Sanitizes typed numeric input: keeps digits and one decimal separator, normalized to `.` for storage.
 * Strips thousands grouping spaces before normalization.
 */
export function sanitizeNumericInput(value: string): string {
  const stripped = stripNumberGrouping(value);
  const cleaned = stripped.replace(/[^0-9.,]/g, '');
  const commaIndex = cleaned.indexOf(',');
  const dotIndex = cleaned.indexOf('.');

  if (commaIndex >= 0 && dotIndex >= 0) {
    if (commaIndex > dotIndex) {
      return cleaned.replace(/\./g, '').replace(',', '.');
    }
    return cleaned.replace(/,/g, '');
  }

  if (commaIndex >= 0) return cleaned.replace(',', '.');
  return cleaned;
}

/** Parses a formatted or raw numeric string (strips grouping, normalizes decimal). */
export function parseFormattedNumber(value: string): number {
  const sanitized = sanitizeNumericInput(value);
  if (!sanitized) return Number.NaN;
  return Number.parseFloat(sanitized);
}

export function parseFormattedNumberOrZero(value: string): number {
  const parsed = parseFormattedNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type FormatNumberDisplayOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

/** Narrow no-break space — preferred fr-CA thousands separator. */
const FR_CA_GROUP_SEP = '\u202f';

/** Insert fr-CA grouping into an integer digit string (e.g. `1200` → `1 200`). */
function groupIntegerDigits(intDigits: string): string {
  const digits = intDigits.replace(/\D/g, '') || '0';
  if (digits.length < THOUSANDS_MIN_DIGITS) return digits;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, FR_CA_GROUP_SEP);
}

/**
 * Display a numeric value with fr-CA grouping (e.g. `1 234`, `1 234,56`).
 * Always inserts a narrow no-break space from 1 000+ so Hermes / RN Web
 * cannot drop the separator the way `toLocaleString('fr-CA')` sometimes does.
 */
export function formatNumberDisplay(value: number, options?: FormatNumberDisplayOptions): string {
  if (!Number.isFinite(value)) {
    return formatNumberDisplay(0, options);
  }

  const abs = Math.abs(value);
  const minFrac = options?.minimumFractionDigits ?? 0;
  const maxFrac = options?.maximumFractionDigits ?? minFrac;
  const fractionDigits = Math.max(0, maxFrac);

  if (fractionDigits <= 0) {
    return groupIntegerDigits(String(Math.round(abs)));
  }

  const fixed = abs.toFixed(fractionDigits);
  const [intRaw, decRaw = ''] = fixed.split('.');
  const grouped = groupIntegerDigits(intRaw);
  const paddedDec = decRaw.length < minFrac ? decRaw.padEnd(minFrac, '0') : decRaw;
  return `${grouped},${paddedDec}`;
}

/**
 * Formats a raw amount string (`digits` + optional `.` decimal separator) for on-screen entry.
 * Internal state should stay unformatted; use this only for display.
 */
export function formatNumberInput(raw: string): string {
  if (!raw) return '';

  const dotIndex = raw.indexOf('.');
  const intRaw = dotIndex >= 0 ? raw.slice(0, dotIndex) : raw;
  const decRaw = dotIndex >= 0 ? raw.slice(dotIndex + 1) : undefined;
  const intDigits = intRaw.replace(/\D/g, '');

  let formattedInt: string;
  if (!intDigits) {
    formattedInt = '0';
  } else {
    formattedInt = groupIntegerDigits(intDigits);
  }

  if (dotIndex < 0) return formattedInt;
  if (decRaw === undefined) return `${formattedInt},`;
  return `${formattedInt},${decRaw}`;
}

/** Formats a stored numeric value for re-populating an input field (unformatted raw string). */
export function formatNumberInputFromValue(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

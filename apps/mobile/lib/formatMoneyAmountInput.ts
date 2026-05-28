const LOCALE = 'fr-CA';

/** Integer part gets fr-CA grouping (e.g. `4 000`) from 1 000+ (4+ digits). */
const THOUSANDS_MIN_DIGITS = 4;

/**
 * Formats a raw numpad amount (`digits` + optional `.` decimal separator) for on-screen entry.
 * Internal state should stay unformatted; use this only for display.
 */
export function formatMoneyAmountInput(raw: string): string {
  if (!raw) return '';

  const dotIndex = raw.indexOf('.');
  const intRaw = dotIndex >= 0 ? raw.slice(0, dotIndex) : raw;
  const decRaw = dotIndex >= 0 ? raw.slice(dotIndex + 1) : undefined;
  const intDigits = intRaw.replace(/\D/g, '');

  let formattedInt: string;
  if (!intDigits) {
    formattedInt = '0';
  } else if (intDigits.length >= THOUSANDS_MIN_DIGITS) {
    formattedInt = Number(intDigits).toLocaleString(LOCALE, { maximumFractionDigits: 0 });
  } else {
    formattedInt = intDigits;
  }

  if (dotIndex < 0) return formattedInt;
  if (decRaw === undefined) return `${formattedInt},`;
  return `${formattedInt},${decRaw}`;
}

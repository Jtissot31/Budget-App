/**
 * Inter presets for numeric / money typography only.
 * UI labels and body copy stay Plus Jakarta Sans — see `plusJakartaFonts.ts`.
 */
export const MONEY_AMOUNT_FONT = 'Inter_800ExtraBold';

/** Inter 600 SemiBold — transaction history list amounts (IGA −105,68$). */
export const TRANSACTION_ROW_AMOUNT_FONT = 'Inter_600SemiBold';

/** Inter 800 ExtraBold — use for tabular nums, numpad keys, date numerals, and money overrides. */
export const interNumericExtraBoldText = {
  fontFamily: MONEY_AMOUNT_FONT,
  fontWeight: 'normal' as const,
};

/** Inter 600 SemiBold — lighter list-row amounts (not ExtraBold). */
export const interNumericSemiboldText = {
  fontFamily: TRANSACTION_ROW_AMOUNT_FONT,
  fontWeight: 'normal' as const,
};

/**
 * Inter presets for numeric / money typography only.
 * UI labels and body copy stay Plus Jakarta Sans — see `plusJakartaFonts.ts`.
 */
export const MONEY_AMOUNT_FONT = 'Inter_800ExtraBold';

/** @deprecated Import {@link MONEY_AMOUNT_FONT} */
export const TRANSACTION_ROW_AMOUNT_FONT = MONEY_AMOUNT_FONT;

/** Inter 800 ExtraBold — use for tabular nums, numpad keys, date numerals, and money overrides. */
export const interNumericExtraBoldText = {
  fontFamily: MONEY_AMOUNT_FONT,
  fontWeight: 'normal' as const,
};

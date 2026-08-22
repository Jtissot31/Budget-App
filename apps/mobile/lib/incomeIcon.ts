/** Marker for the default income history glyph. Not an Ionicons name. */
export const INCOME_HISTORY_ICON = 'income-outline-asset' as const;

export type IncomeHistoryIcon = typeof INCOME_HISTORY_ICON;

export function isIncomeHistoryIcon(icon?: string | null): boolean {
  return icon === INCOME_HISTORY_ICON;
}

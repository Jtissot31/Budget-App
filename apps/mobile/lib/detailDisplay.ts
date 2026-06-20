import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';

/** Placeholder for missing detail fields across detail screens. */
export const EMPTY_DETAIL_VALUE = 'N/A';

export function detailValueOrEmpty(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : EMPTY_DETAIL_VALUE;
}

/** Weekly amount label for detail rows — short unit to avoid value shrink. */
export function formatDetailWeeklyAmount(
  amount: number,
  options?: { leadingPlus?: boolean },
): string {
  const formatted = formatDisplayMoneyAbsolute(amount);
  const prefix = options?.leadingPlus && amount > 0 ? '+' : '';
  return `${prefix}${formatted} / sem`;
}

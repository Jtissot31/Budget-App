import { isIconName, type IconName } from '@/constants/categoryOptions';
import { EXPENSE_MDI_ICON } from '@/lib/mdiIconCatalog';

/** Marker for the default expense icon (`ShoppingBag4Fill`). Not an Ionicons glyph. */
export const EXPENSE_DEFAULT_ICON = 'shopping-bag-4-fill' as const;

export type ExpenseFallbackIcon = typeof EXPENSE_DEFAULT_ICON;

/** True when the stored icon should render as the default shopping bag at display time. */
export function isExpenseDefaultIcon(icon?: string | null): boolean {
  if (!icon) return true;
  return icon === EXPENSE_DEFAULT_ICON || icon === EXPENSE_MDI_ICON || icon === 'receipt-outline';
}

export function resolveExpenseFallbackIcon(transactionIcon?: string | null): IconName | ExpenseFallbackIcon {
  if (isIconName(transactionIcon) && !isExpenseDefaultIcon(transactionIcon)) {
    return transactionIcon;
  }
  return EXPENSE_DEFAULT_ICON;
}

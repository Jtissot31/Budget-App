import { resolveMdiOrLegacyIcon, type MdiIconName } from '@/lib/mdiIconCatalog';
import type { LoanType } from '@/types';

export function defaultLoanIcon(type: LoanType): MdiIconName {
  switch (type) {
    case 'friend_debt':
      return 'Person';
    case 'line_of_credit':
      return 'CreditCard';
    case 'mortgage':
      return 'Apartments1StoryGabledRoof';
    case 'child_support':
      return 'FavoriteBorder';
    default:
      return 'AttachMoney';
  }
}

const CHILD_SUPPORT_LEGACY_ICONS = new Set(['ChildCare', 'heart-outline']);

export function resolveLoanIcon(loan: { type?: LoanType; icon?: string | null }): MdiIconName {
  const type = loan.type ?? 'personal_loan';
  if (type === 'child_support' && (!loan.icon || CHILD_SUPPORT_LEGACY_ICONS.has(loan.icon))) {
    return defaultLoanIcon('child_support');
  }
  if (loan.icon) return resolveMdiOrLegacyIcon(loan.icon);
  return defaultLoanIcon(type);
}

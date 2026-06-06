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
    default:
      return 'AttachMoney';
  }
}

export function resolveLoanIcon(loan: { type?: LoanType; icon?: string | null }): MdiIconName {
  if (loan.icon) return resolveMdiOrLegacyIcon(loan.icon);
  return defaultLoanIcon(loan.type ?? 'personal_loan');
}

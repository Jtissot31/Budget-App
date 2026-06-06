import { type ViewStyle } from 'react-native';
import { getCategoryIconName, isIconName, type IconName } from '@/constants/categoryOptions';
import { EXPENSE_DEFAULT_ICON, resolveExpenseFallbackIcon } from '@/lib/expenseIcon';
import { getMerchantLogoUrls } from '@/lib/merchantLogo';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import type { Transaction } from '@/types';

type Props = {
  transaction: Transaction;
  size?: number;
  iconSize?: number;
  style?: ViewStyle;
};

export function TransactionAvatar({ transaction, size = 38, iconSize, style }: Props) {
  const fallbackIcon = getFallbackIcon(transaction);

  return (
    <UserPickedIconWell
      icon={fallbackIcon}
      color={transaction.categoryColor}
      size={size}
      iconSize={iconSize}
      merchantLabel={transaction.label}
      style={style}
    />
  );
}

export function hasMerchantLogoCandidate(label: string): boolean {
  return getMerchantLogoUrls(label).length > 0;
}

function getFallbackIcon(transaction: Transaction): IconName | typeof EXPENSE_DEFAULT_ICON {
  if (transaction.type === 'expense') {
    return resolveExpenseFallbackIcon(transaction.transactionIcon);
  }
  if (isIconName(transaction.transactionIcon)) return transaction.transactionIcon;
  return getCategoryIconName(transaction);
}

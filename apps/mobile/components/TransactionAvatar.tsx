import { type ViewStyle } from 'react-native';
import { getCategoryIconName, isIconName, type IconName } from '@/constants/categoryOptions';
import { EXPENSE_DEFAULT_ICON, resolveExpenseFallbackIcon } from '@/lib/expenseIcon';
import { getMerchantLogoUrls } from '@/lib/merchantLogo';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import {
  isContactTransferTx,
  parseExpediteurFromNote,
} from '@/lib/accountTransactionFlow';
import { useAppTheme } from '@/lib/themeContext';
import type { Transaction } from '@/types';

/** Material contact glyph for person-to-person transfers in transaction history. */
export const CONTACT_TRANSFER_ICON: IconName = 'person-outline';

type Props = {
  transaction: Transaction;
  contactPhotoUri?: string | null;
  size?: number;
  iconSize?: number;
  style?: ViewStyle;
  /** History rows: contact icon instead of photo for contact transfers. */
  preferContactIcon?: boolean;
};

export function isContactPersonTransferTx(
  tx: Pick<Transaction, 'type' | 'note'>,
): boolean {
  return (
    isContactTransferTx(tx) ||
    (tx.type === 'income' && Boolean(parseExpediteurFromNote(tx.note)))
  );
}

export function TransactionAvatar({
  transaction,
  contactPhotoUri,
  size = 38,
  iconSize,
  style,
  preferContactIcon = false,
}: Props) {
  const { colors } = useAppTheme();
  const fallbackIcon = getFallbackIcon(transaction);
  const trimmedContactPhoto = contactPhotoUri?.trim() ?? '';
  const showContactTransferIcon =
    preferContactIcon && isContactPersonTransferTx(transaction);
  const iconColor = transaction.type === 'income' ? colors.success : transaction.categoryColor;

  return (
    <UserPickedIconWell
      icon={showContactTransferIcon ? CONTACT_TRANSFER_ICON : fallbackIcon}
      color={iconColor}
      size={size}
      iconSize={iconSize}
      coverImageUri={showContactTransferIcon ? null : trimmedContactPhoto || null}
      merchantLabel={
        showContactTransferIcon || trimmedContactPhoto ? null : transaction.label
      }
      noBackground={!showContactTransferIcon}
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

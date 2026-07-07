import { useMemo } from 'react';
import { type ViewStyle } from 'react-native';
import { getCategoryIconName, isIconName, type IconName } from '@/constants/categoryOptions';
import { EXPENSE_DEFAULT_ICON, isExpenseDefaultIcon, resolveExpenseFallbackIcon } from '@/lib/expenseIcon';
import { getMerchantLogoUrls, resolveTransactionMerchantLogo } from '@/lib/merchantLogo';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import {
  isContactTransferTx,
  parseExpediteurFromNote,
} from '@/lib/accountTransactionFlow';
import { useAppTheme } from '@/lib/themeContext';
import type { MerchantOverride, Transaction } from '@/types';

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
  /** Neutral white glyph inside the filled icon well (Historique list rows). */
  wellGlyphWhite?: boolean;
  /** Optional merchant override (custom logo / icon from directory). */
  merchantOverride?: Pick<MerchantOverride, 'logoUrl' | 'icon' | 'useAutoLogo'> | null;
  /**
   * Historique embedded rows: remote merchant logos render frameless (no charcoal well).
   * Category icons and contact transfers keep the filled well.
   */
  framelessRemoteLogo?: boolean;
};

export function isContactPersonTransferTx(
  tx: Pick<Transaction, 'type' | 'note'>,
): boolean {
  return (
    isContactTransferTx(tx) ||
    (tx.type === 'income' && Boolean(parseExpediteurFromNote(tx.note)))
  );
}

/** True when a row should show a frameless remote merchant logo (not category/contact). */
export function shouldFramelessMerchantLogo(
  transaction: Pick<Transaction, 'type' | 'label' | 'note' | 'transactionIcon'>,
  options?: {
    contactPhotoUri?: string | null;
    preferContactIcon?: boolean;
    merchantOverride?: Pick<MerchantOverride, 'logoUrl' | 'icon' | 'useAutoLogo'> | null;
  },
): boolean {
  const trimmedContactPhoto = options?.contactPhotoUri?.trim() ?? '';
  const showContactTransferIcon =
    options?.preferContactIcon && isContactPersonTransferTx(transaction);

  if (showContactTransferIcon || trimmedContactPhoto || transaction.type === 'transfer') {
    return false;
  }

  const resolved = resolveTransactionMerchantLogo(transaction.label, options?.merchantOverride);
  const hasRemoteLogo =
    Boolean(resolved.logoUrl) ||
    hasMerchantLogoCandidate(transaction.label) ||
    Boolean(options?.merchantOverride?.logoUrl?.trim());

  if (transaction.type === 'income' && !hasRemoteLogo) {
    return false;
  }

  if (
    transaction.type === 'expense' &&
    !hasRemoteLogo &&
    !isExpenseDefaultIcon(transaction.transactionIcon)
  ) {
    return false;
  }

  return hasRemoteLogo;
}

export function TransactionAvatar({
  transaction,
  contactPhotoUri,
  size = 38,
  iconSize,
  style,
  preferContactIcon = false,
  wellGlyphWhite = false,
  merchantOverride,
  framelessRemoteLogo = false,
}: Props) {
  const { colors } = useAppTheme();
  const trimmedContactPhoto = contactPhotoUri?.trim() ?? '';
  const showContactTransferIcon =
    preferContactIcon && isContactPersonTransferTx(transaction);

  const merchantLogo = useMemo(() => {
    if (showContactTransferIcon || trimmedContactPhoto || transaction.type === 'transfer') {
      return null;
    }

    const resolved = resolveTransactionMerchantLogo(transaction.label, merchantOverride);
    const hasRemoteLogo =
      Boolean(resolved.logoUrl) ||
      hasMerchantLogoCandidate(transaction.label) ||
      Boolean(merchantOverride?.logoUrl?.trim());

    if (transaction.type === 'income' && !hasRemoteLogo) {
      return null;
    }

    if (
      transaction.type === 'expense' &&
      !hasRemoteLogo &&
      !isExpenseDefaultIcon(transaction.transactionIcon)
    ) {
      return { logoUrl: null, merchantLabel: null, manualIcon: null };
    }

    return resolved;
  }, [
    merchantOverride,
    showContactTransferIcon,
    transaction.label,
    transaction.transactionIcon,
    transaction.type,
    trimmedContactPhoto,
  ]);

  const fallbackIcon = useMemo(() => {
    if (merchantLogo?.manualIcon) {
      return merchantLogo.manualIcon;
    }
    return getFallbackIcon(transaction);
  }, [merchantLogo?.manualIcon, transaction]);

  const iconColor = transaction.type === 'income' ? colors.success : transaction.categoryColor;

  const useFramelessLogo =
    framelessRemoteLogo &&
    shouldFramelessMerchantLogo(transaction, {
      contactPhotoUri,
      preferContactIcon,
      merchantOverride,
    });

  return (
    <UserPickedIconWell
      icon={showContactTransferIcon ? CONTACT_TRANSFER_ICON : fallbackIcon}
      color={iconColor}
      size={size}
      iconSize={iconSize}
      wellGlyphWhite={wellGlyphWhite}
      logoUrl={merchantLogo?.logoUrl ?? null}
      merchantLabel={merchantLogo?.merchantLabel ?? null}
      coverImageUri={showContactTransferIcon ? null : trimmedContactPhoto || null}
      noBackground={useFramelessLogo}
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

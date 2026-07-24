import { useMemo } from 'react';
import { type ViewStyle } from 'react-native';
import { getCategoryIconName, isIconName, type IconName } from '@/constants/categoryOptions';
import { EXPENSE_DEFAULT_ICON, isExpenseDefaultIcon, resolveExpenseFallbackIcon } from '@/lib/expenseIcon';
import { resolveTransactionMerchantLogo } from '@/lib/merchantLogo';
import { merchantLabelHasResolvableLogo } from '@/lib/merchantLogoMemory';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import {
  isContactTransferTx,
  parseExpediteurFromNote,
} from '@/lib/accountTransactionFlow';
import { userPickedIconLogoSize } from '@/lib/userPickedIcon';
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
   * Historique embedded rows: merchant logos and category/income glyphs render
   * frameless (no charcoal well). Contact transfers keep the filled well.
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

/** True when Historique should render a frameless avatar (not contact/transfer wells). */
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

  return true;
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
      hasMerchantLogoCandidate(transaction.label, merchantOverride) ||
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

  const hasRemoteLogo = Boolean(merchantLogo?.logoUrl);
  // Frameless glyphs share the standard logo inset footprint.
  const resolvedIconSize =
    useFramelessLogo && !hasRemoteLogo && iconSize == null
      ? userPickedIconLogoSize(size)
      : iconSize;

  return (
    <UserPickedIconWell
      icon={showContactTransferIcon ? CONTACT_TRANSFER_ICON : fallbackIcon}
      color={iconColor}
      size={size}
      iconSize={resolvedIconSize}
      wellGlyphWhite={wellGlyphWhite}
      logoUrl={merchantLogo?.logoUrl ?? null}
      merchantLabel={merchantLogo?.merchantLabel ?? null}
      coverImageUri={showContactTransferIcon ? null : trimmedContactPhoto || null}
      noBackground={useFramelessLogo}
      style={style}
    />
  );
}

export function hasMerchantLogoCandidate(
  label: string,
  override?: Pick<MerchantOverride, 'logoUrl' | 'icon' | 'useAutoLogo'> | null,
): boolean {
  return merchantLabelHasResolvableLogo(label, override);
}

function getFallbackIcon(transaction: Transaction): IconName | typeof EXPENSE_DEFAULT_ICON {
  if (transaction.type === 'expense') {
    return resolveExpenseFallbackIcon(transaction.transactionIcon);
  }
  if (isIconName(transaction.transactionIcon)) return transaction.transactionIcon;
  return getCategoryIconName(transaction);
}

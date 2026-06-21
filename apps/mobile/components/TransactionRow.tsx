import { memo, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { PaymentListRow } from '@/components/PaymentListRow';
import { TransactionAvatar } from '@/components/TransactionAvatar';
import {
  TransactionAmountLabel,
  transactionAmountDirectionFromType,
} from '@/components/TransactionAmountLabel';
import type { SimulatedAccount, Transaction } from '@/types';
import { type AppColors } from '@/constants/theme';
import { rowValue } from '@/lib/textLayout';
import { resolveContactPhotoUriForTransaction } from '@/lib/contactHistory';
import { useContactPhotoMap } from '@/hooks/useContactPhotoMap';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import {
  getTransactionTypeLabel,
  isLikelySavingsGoalId,
  parseAccountIdFromNote,
  parseTransferAccountsFromNote,
  resolveTransactionHistorySubtitle,
} from '@/lib/accountTransactionFlow';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
import { useAppTheme } from '@/lib/themeContext';

const AVATAR_SIZE = 48;

type Props = {
  transaction: Transaction;
  accounts?: readonly SimulatedAccount[];
  /** Pass from list parent to avoid per-row store subscriptions. */
  savingsGoals?: readonly { id: string; name: string }[];
  /** Pass from list parent to avoid per-row store subscriptions. */
  contactPhotoByKey?: ReadonlyMap<string, string>;
  onPress?: () => void;
  /** Stable list handler — preferred over inline `onPress` closures in virtualized lists. */
  onPressId?: (transactionId: string) => void;
};

function isUnresolvedHistorySubtitle(transaction: Transaction, label: string): boolean {
  if (transaction.type === 'transfer') {
    const { sourceId, destinationId } = parseTransferAccountsFromNote(transaction.note);
    const rawIds = [sourceId, destinationId].filter(Boolean) as string[];
    if (rawIds.some((id) => label === id || label.includes(id))) {
      return true;
    }
    if (rawIds.some(isLikelySavingsGoalId) && (label.includes('goal-') || label.includes('goal_'))) {
      return true;
    }
  }

  const accountId = parseAccountIdFromNote(transaction.note);
  return Boolean(
    accountId &&
      (label === accountId || (isLikelySavingsGoalId(accountId) && label.includes(accountId))),
  );
}

function getTransactionRowMeta(
  transaction: Transaction,
  accounts?: readonly SimulatedAccount[],
  savingsGoals?: readonly { id: string; name: string }[],
): string | null {
  const subtitle = resolveTransactionHistorySubtitle(transaction, { accounts, savingsGoals });
  const resolvedSubtitle =
    subtitle && !isUnresolvedHistorySubtitle(transaction, subtitle) ? subtitle : null;

  if (transaction.type === 'transfer') {
    return resolvedSubtitle ?? getTransactionTypeLabel('transfer');
  }

  return resolvedSubtitle;
}

type TransactionRowBaseProps = Props & {
  savingsGoals: readonly { id: string; name: string }[];
  contactPhotoByKey: ReadonlyMap<string, string>;
};

const TransactionRowBase = memo(function TransactionRowBase({
  transaction,
  accounts,
  savingsGoals,
  contactPhotoByKey,
  onPress,
  onPressId,
}: TransactionRowBaseProps) {
  const { colors: themeColors } = useAppTheme();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const isTransfer = transaction.type === 'transfer';
  const isIncome = transaction.type === 'income';

  const handlePress = useCallback(() => {
    if (onPressId) {
      onPressId(transaction.id);
      return;
    }
    onPress?.();
  }, [onPress, onPressId, transaction.id]);

  const contactPhotoUri = useMemo(
    () => resolveContactPhotoUriForTransaction(transaction, contactPhotoByKey),
    [transaction, contactPhotoByKey],
  );

  const name = isTransfer ? getTransactionTypeLabel('transfer') : transaction.label;
  const meta = useMemo(
    () => getTransactionRowMeta(transaction, accounts, savingsGoals),
    [transaction, accounts, savingsGoals],
  );
  const direction = transactionAmountDirectionFromType(transaction.type);

  const amountColor =
    isIncome ? themeColors.success : isTransfer ? themeColors.textMuted : themeColors.text;

  return (
    <PaymentListRow
      onPress={onPress || onPressId ? handlePress : undefined}
      avatar={
        <TransactionAvatar
          transaction={transaction}
          contactPhotoUri={contactPhotoUri}
          size={AVATAR_SIZE}
          preferContactIcon
          style={styles.avatar}
        />
      }
      title={name}
      meta={meta}
      amount={
        <TransactionAmountLabel
          amount={formatDisplayMoneyAbsolute(Math.abs(transaction.amount))}
          direction={direction}
          color={amountColor}
          textStyle={[styles.amount, isIncome && styles.amountIncome]}
        />
      }
    />
  );
});

const TransactionRowWithStores = memo(function TransactionRowWithStores(props: Props) {
  const contactPhotoByKey = useContactPhotoMap();
  const savingsGoals = useSavingsGoals();
  return (
    <TransactionRowBase
      {...props}
      contactPhotoByKey={contactPhotoByKey}
      savingsGoals={savingsGoals}
    />
  );
});

export const TransactionRow = memo(function TransactionRow({
  savingsGoals: savingsGoalsProp,
  contactPhotoByKey: contactPhotoByKeyProp,
  ...rest
}: Props) {
  if (savingsGoalsProp && contactPhotoByKeyProp) {
    return (
      <TransactionRowBase
        {...rest}
        savingsGoals={savingsGoalsProp}
        contactPhotoByKey={contactPhotoByKeyProp}
      />
    );
  }
  return <TransactionRowWithStores {...rest} />;
});

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    avatar: {
      flexShrink: 0,
    },
    amount: {
      ...rowValue,
      color: colors.text,
      textAlign: 'right',
    },
    amountIncome: {
      color: colors.success,
    },
  });
}

import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TransactionAvatar, shouldFramelessMerchantLogo } from '@/components/TransactionAvatar';
import {
  TransactionAmountLabel,
  transactionAmountDirectionFromType,
} from '@/components/TransactionAmountLabel';
import type { MerchantOverride, SimulatedAccount, Transaction } from '@/types';
import { getMerchantOverrideForLabel } from '@/lib/merchantLogo';
import {
  ICON_WELL_SIZE,
  spacing,
  transactionRowAmountTypography,
  typographyKit,
} from '@/constants/theme';
import { planFinanceContainerPressedStyle } from '@/constants/planFinanceKit';
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
import { tapHaptic } from '@/lib/haptics';
import { userPickedIconLogoSize } from '@/lib/userPickedIcon';
import { useAppTheme } from '@/lib/themeContext';

const EMBEDDED_ICON_WELL_SIZE = 30;
const EMBEDDED_ROW_TITLE_SIZE = 16;

type Props = {
  transaction: Transaction;
  accounts?: readonly SimulatedAccount[];
  /** Pass from list parent to avoid per-row store subscriptions. */
  savingsGoals?: readonly { id: string; name: string }[];
  /** Pass from list parent to avoid per-row store subscriptions. */
  contactPhotoByKey?: ReadonlyMap<string, string>;
  /** Pass from list parent for merchant logo overrides in Historique. */
  merchantOverrideByLabel?: ReadonlyMap<string, MerchantOverride>;
  onPress?: () => void;
  /** Stable list handler — preferred over inline `onPress` closures in virtualized lists. */
  onPressId?: (transactionId: string) => void;
  /** Flat row inside a parent card — adds hairline dividers between rows. */
  embedded?: boolean;
  isLast?: boolean;
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
  merchantOverrideByLabel?: ReadonlyMap<string, MerchantOverride>;
};

const TransactionRowBase = memo(function TransactionRowBase({
  transaction,
  accounts,
  savingsGoals,
  contactPhotoByKey,
  merchantOverrideByLabel,
  onPress,
  onPressId,
  embedded = false,
  isLast = false,
}: TransactionRowBaseProps) {
  const { colors } = useAppTheme();
  const isTransfer = transaction.type === 'transfer';
  const isIncome = transaction.type === 'income';

  const handlePress = useCallback(() => {
    tapHaptic();
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
    isIncome ? colors.success : isTransfer ? colors.textMuted : colors.text;

  const pressable = onPress || onPressId;
  const avatarSize = embedded ? EMBEDDED_ICON_WELL_SIZE : ICON_WELL_SIZE;
  // Amounts: Onest 800 ExtraBold (scoped exception — merchant name/subtitle stay Jakarta).
  const amountTextStyle = embedded
    ? styles.embeddedAmount
    : transactionRowAmountTypography();
  const merchantOverride = merchantOverrideByLabel
    ? getMerchantOverrideForLabel(transaction.label, merchantOverrideByLabel)
    : undefined;
  const framelessLogo =
    embedded &&
    shouldFramelessMerchantLogo(transaction, {
      contactPhotoUri,
      preferContactIcon: true,
      merchantOverride,
    });

  return (
    <Pressable
      accessibilityRole={pressable ? 'button' : undefined}
      onPress={pressable ? handlePress : undefined}
      style={({ pressed }) => [
        styles.row,
        embedded && styles.rowEmbedded,
        pressed && (embedded ? planFinanceContainerPressedStyle() : styles.pressed),
      ]}
    >
      <View style={[styles.mainRow, embedded && styles.mainRowEmbedded]}>
        <TransactionAvatar
          transaction={transaction}
          contactPhotoUri={contactPhotoUri}
          merchantOverride={merchantOverride}
          size={avatarSize}
          iconSize={framelessLogo ? userPickedIconLogoSize(avatarSize) : 18}
          preferContactIcon
          wellGlyphWhite
          framelessRemoteLogo={embedded}
          style={[
            styles.avatar,
            embedded && !framelessLogo && styles.avatarEmbedded,
            embedded && !framelessLogo && { borderColor: colors.containerBorder },
          ]}
        />

        <View style={[styles.content, embedded && styles.contentEmbedded]}>
          <View style={styles.titleRow}>
            <View style={styles.nameCol}>
              <Text
                style={[
                  styles.name,
                  embedded ? styles.nameEmbedded : null,
                  embedded ? typographyKit.bodyBold : typographyKit.captionSemibold,
                  { color: colors.text },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {name}
              </Text>
            </View>
            <View style={styles.amountCol}>
              <TransactionAmountLabel
                amount={formatDisplayMoneyAbsolute(Math.abs(transaction.amount))}
                direction={direction}
                color={amountColor}
                textStyle={amountTextStyle}
              />
            </View>
          </View>

          {meta ? (
            <Text
              style={[
                styles.meta,
                embedded && styles.metaEmbedded,
                embedded ? typographyKit.metaMedium : typographyKit.caption,
                { color: colors.textMuted },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {meta}
            </Text>
          ) : null}
        </View>
      </View>

      {embedded && !isLast ? (
        <View style={[styles.dividerEmbedded, { backgroundColor: colors.containerBorder }]} />
      ) : null}
    </Pressable>
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

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowEmbedded: {
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: 0,
  },
  mainRowEmbedded: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  contentEmbedded: {
    gap: spacing.xs,
  },
  avatarEmbedded: {
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.88,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  avatar: {
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    lineHeight: 18,
  },
  nameEmbedded: {
    letterSpacing: -0.2,
  },
  embeddedAmount: {
    ...transactionRowAmountTypography({
      fontSize: EMBEDDED_ROW_TITLE_SIZE,
      lineHeight: 20,
      letterSpacing: -0.2,
    }),
  },
  amountCol: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
  },
  metaEmbedded: {
    letterSpacing: 0.2,
  },
  dividerEmbedded: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.lg,
  },
});

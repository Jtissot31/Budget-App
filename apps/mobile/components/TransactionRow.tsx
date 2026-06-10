import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassContainer } from '@/components/GlassContainer';
import { TransactionAvatar } from '@/components/TransactionAvatar';
import type { SimulatedAccount, Transaction } from '@/types';
import { interMediumText, radius, spacing, typography } from '@/constants/theme';
import { listRowTitle, rowTitleTextProps, rowValue, rowValueContainer, singleLineAmountProps } from '@/lib/textLayout';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
import { useSimulatedAccounts } from '@/hooks/useSimulatedAccounts';
import { resolveTransactionPaymentMethodLabel } from '@/lib/accountTransactionFlow';
import { UNIFORM_ROW_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  transaction: Transaction;
  accounts?: readonly SimulatedAccount[];
  onPress?: () => void;
};

export function TransactionRow({ transaction: tx, accounts, onPress }: Props) {
  const { colors } = useAppTheme();
  const storeAccounts = useSimulatedAccounts();
  const savingsGoals = useSavingsGoals();
  const resolvedAccounts = accounts && accounts.length > 0 ? accounts : storeAccounts;
  const isIncome = tx.type === 'income';
  const isTransfer = tx.type === 'transfer';
  const amountColor = isIncome ? colors.success : isTransfer ? colors.textMuted : colors.text;
  const hasReceipt = Boolean(tx.receiptUri || tx.receiptStatus);
  const paymentMethodLabel = useMemo(
    () => resolveTransactionPaymentMethodLabel(tx, { accounts: resolvedAccounts, savingsGoals }),
    [resolvedAccounts, savingsGoals, tx],
  );
  const paymentMethodIcon = isTransfer ? 'swap-horizontal-outline' : isIncome ? 'wallet-outline' : 'card-outline';

  return (
    <Pressable android_ripple={null} onPress={onPress}>
      <GlassContainer
        borderRadius={radius.md}
        padding={spacing.md}
        innerStyle={styles.cardInner}
      >
          <TransactionAvatar transaction={tx} size={48} />
          <View style={styles.body}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.text }]} {...rowTitleTextProps}>
                {tx.label}
              </Text>
              {hasReceipt ? (
                <View style={[styles.receiptBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="receipt-outline" size={13} color={colors.textMuted} />
                </View>
              ) : null}
            </View>
            {paymentMethodLabel ? (
              <View style={[styles.accountPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name={paymentMethodIcon} size={11} color={colors.textMuted} />
                <Text style={[styles.accountPillText, { color: colors.textMuted }]} numberOfLines={1}>
                  {paymentMethodLabel}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.right}>
            <Text style={[styles.amount, { color: amountColor }]} {...singleLineAmountProps}>
              {isTransfer ? '' : isIncome ? '+' : '−'}
              {formatDisplayMoneyAbsolute(tx.amount)}
            </Text>
          </View>
      </GlassContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: UNIFORM_ROW_MIN_HEIGHT,
  },
  body: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 0 },
  label: {
    ...listRowTitle,
    fontSize: 13,
  },
  accountPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    maxWidth: '100%',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  accountPillText: {
    ...interMediumText,
    fontSize: typography.micro,
    flexShrink: 1,
  },
  receiptBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  right: {
    ...rowValueContainer,
    alignSelf: 'stretch',
    justifyContent: 'center',
    minWidth: 88,
  },
  amount: { ...rowValue },
});

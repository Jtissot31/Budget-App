/**
 * Shared transaction history — the Transactions tab day groups, reusable anywhere.
 * Uppercase day eyebrow (AUJ. / HIER / MER. 1 OCT) + one glass card of ProtoTransactionRows.
 */
import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { ProtoTransactionRow } from '@/components/transactions/ProtoTransactionRow';
import { spacing, typographyKit } from '@/constants/theme';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
import { openTransactionDetail } from '@/lib/openTransactionDetail';
import { formatProtoDaySectionLabel, todayDayKey } from '@/lib/transactionListSectionFormat';
import { groupTransactionsByDay } from '@/lib/transactionListUtils';
import { useAppTheme } from '@/lib/themeContext';
import type { SimulatedAccount, Transaction } from '@/types';

type DayGroupProps = {
  date: string;
  txs: readonly Transaction[];
  accounts?: readonly SimulatedAccount[];
  /** Defaults to the shared savings-goal cache. */
  savingsGoals?: readonly { id: string; name: string }[];
  horizontalGutter?: number;
  onPressTransaction?: (transactionId: string) => void;
};

const EMPTY_ACCOUNTS: readonly SimulatedAccount[] = [];

export const TransactionDayGroup = memo(function TransactionDayGroup({
  date,
  txs,
  accounts = EMPTY_ACCOUNTS,
  savingsGoals,
  horizontalGutter = 0,
  onPressTransaction = openTransactionDetail,
}: DayGroupProps) {
  const { colors } = useAppTheme();
  const cachedGoals = useSavingsGoals();
  const todayKey = useMemo(() => todayDayKey(), []);
  const sectionLabel = useMemo(() => formatProtoDaySectionLabel(date, todayKey), [date, todayKey]);

  return (
    <View style={[styles.group, { paddingHorizontal: horizontalGutter }]}>
      <Text style={[styles.dateLabel, { color: colors.textMuted }]}>{sectionLabel}</Text>
      <ProtoGlassCard style={styles.dayCard}>
        {txs.map((tx, index) => (
          <ProtoTransactionRow
            key={tx.id}
            transaction={tx}
            accounts={accounts}
            savingsGoals={savingsGoals ?? cachedGoals}
            isLast={index === txs.length - 1}
            onPressId={onPressTransaction}
          />
        ))}
      </ProtoGlassCard>
    </View>
  );
});

type GroupsProps = {
  transactions: readonly Transaction[];
  accounts?: readonly SimulatedAccount[];
  /** Defaults to opening the transaction detail screen. */
  onPressTransaction?: (transactionId: string) => void;
  /** Cap the number of day groups rendered (embedded previews). */
  maxGroups?: number;
};

/** Groups by local day (newest first) and renders one TransactionDayGroup per day. */
export function TransactionDayGroups({
  transactions,
  accounts = [],
  onPressTransaction,
  maxGroups,
}: GroupsProps) {
  const savingsGoals = useSavingsGoals();
  const grouped = useMemo(() => {
    const groups = groupTransactionsByDay([...transactions]);
    return maxGroups != null ? groups.slice(0, maxGroups) : groups;
  }, [maxGroups, transactions]);
  const handlePress = useCallback(
    (id: string) => (onPressTransaction ? onPressTransaction(id) : openTransactionDetail(id)),
    [onPressTransaction],
  );

  return (
    <>
      {grouped.map(([date, txs]) => (
        <TransactionDayGroup
          key={date}
          date={date}
          txs={txs}
          accounts={accounts}
          savingsGoals={savingsGoals}
          onPressTransaction={handlePress}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: spacing.md,
    width: '100%',
    alignSelf: 'stretch',
  },
  dayCard: {
    width: '100%',
    alignSelf: 'stretch',
  },
  dateLabel: {
    ...typographyKit.eyebrow,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
});

/**
 * Account history — one card per month instead of one header per day, so a quiet account
 * doesn't turn into a long list of single-row days. Each row carries its date under the amount.
 */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { ProtoTransactionRow } from '@/components/transactions/ProtoTransactionRow';
import { spacing, typographyKit } from '@/constants/theme';
import { openTransactionDetail } from '@/lib/openTransactionDetail';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import {
  formatMonthSectionLabel,
  formatRowDayLabel,
  sumHistoryDayTotals,
  todayDayKey,
} from '@/lib/transactionListSectionFormat';
import { groupTransactionsByDay } from '@/lib/transactionListUtils';
import { useAppTheme } from '@/lib/themeContext';
import type { SimulatedAccount, Transaction } from '@/types';

type MonthGroup = {
  /** First day key seen in the month (only its month and year are read). */
  dateKey: string;
  rows: { dateKey: string; tx: Transaction }[];
};

function groupByMonth(transactions: readonly Transaction[]): MonthGroup[] {
  const months = new Map<string, MonthGroup>();
  for (const [dateKey, txs] of groupTransactionsByDay([...transactions])) {
    const monthKey = dateKey.slice(0, 7);
    const group = months.get(monthKey) ?? { dateKey, rows: [] };
    months.set(monthKey, group);
    for (const tx of txs) group.rows.push({ dateKey, tx });
  }
  return [...months.values()];
}

type Props = {
  transactions: readonly Transaction[];
  accounts: readonly SimulatedAccount[];
  savingsGoals: readonly { id: string; name: string }[];
};

export function AccountHistoryList({ transactions, accounts, savingsGoals }: Props) {
  const { colors } = useAppTheme();
  const todayKey = todayDayKey();
  const months = useMemo(() => groupByMonth(transactions), [transactions]);

  return (
    <View style={styles.list}>
      {months.map((month) => {
        const totals = sumHistoryDayTotals(month.rows.map((row) => row.tx));
        const net = totals.incomeTotal - totals.expenseTotal;
        return (
          <View key={month.dateKey}>
            <View style={styles.monthHeader}>
              <Text style={[styles.monthLabel, { color: colors.textMuted }]} numberOfLines={1}>
                {formatMonthSectionLabel(month.dateKey, todayKey)}
              </Text>
              <Text style={[styles.monthTotal, { color: colors.textMuted }]} numberOfLines={1}>
                {net > 0 ? '+' : net < 0 ? '−' : ''}
                {formatDisplayMoneyAbsolute(Math.abs(net))}
              </Text>
            </View>
            <ProtoGlassCard>
              {month.rows.map(({ dateKey, tx }, index) => (
                <ProtoTransactionRow
                  key={tx.id}
                  transaction={tx}
                  accounts={accounts}
                  savingsGoals={savingsGoals}
                  isLast={index === month.rows.length - 1}
                  onPressId={openTransactionDetail}
                  dateLabel={formatRowDayLabel(dateKey, todayKey)}
                />
              ))}
            </ProtoGlassCard>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  monthLabel: { ...typographyKit.metaMedium, fontSize: 13.5, lineHeight: 18, flexShrink: 0 },
  monthTotal: { ...typographyKit.metaMedium, fontSize: 13.5, lineHeight: 18, flexShrink: 1 },
});

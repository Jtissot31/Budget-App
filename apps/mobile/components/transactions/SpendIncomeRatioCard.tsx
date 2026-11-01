/**
 * Activité summary: how much of this month's income went to expenses.
 * Transfers count on neither side: they only move money between accounts.
 */
import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { RingGauge, SummaryCard } from '@/components/kit';
import { jakartaSemiboldText } from '@/constants/theme';
import { BUDGET_OVER } from '@/lib/budgetTone';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';
import type { Transaction } from '@/types';

function signedMoney(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatDisplayMoneyAbsolute(Math.abs(value))}`;
}

export function SpendIncomeRatioCard({
  transactions,
  monthKey,
  dayKeyOf,
}: {
  transactions: readonly Transaction[];
  /** « YYYY-MM » of the month to summarize. */
  monthKey: string;
  /** Local day key (« YYYY-MM-DD ») of a transaction date. */
  dayKeyOf: (date: string) => string;
}) {
  const { colors } = useAppTheme();
  const { income, expenses } = useMemo(() => {
    let incomeTotal = 0;
    let expenseTotal = 0;
    for (const tx of transactions) {
      if (!dayKeyOf(tx.date).startsWith(monthKey)) continue;
      if (tx.type === 'income') incomeTotal += Math.abs(tx.amount);
      else if (tx.type === 'expense') expenseTotal += Math.abs(tx.amount);
    }
    return { income: incomeTotal, expenses: expenseTotal };
  }, [dayKeyOf, monthKey, transactions]);

  const ratio = income > 0 ? expenses / income : null;
  const pct = ratio == null ? '—' : `${Math.round(ratio * 100)} %`;

  return (
    <SummaryCard
      label="Dépenses / revenus"
      amount={pct}
      aside={
        <RingGauge
          progress={ratio == null ? 0 : Math.min(1, ratio)}
          color={ratio != null && ratio > 1 ? BUDGET_OVER : colors.accentGreen}
          size={64}
          stroke={7}
        >
          <Text style={[styles.ringText, { color: colors.textMuted }]}>ce mois</Text>
        </RingGauge>
      }
      stats={[
        { label: 'Revenus', value: formatDisplayMoneyAbsolute(income) },
        { label: 'Dépenses', value: formatDisplayMoneyAbsolute(expenses) },
        { label: 'Reste', value: signedMoney(income - expenses) },
      ]}
      footer={ratio == null ? 'Aucun revenu inscrit ce mois-ci' : undefined}
    />
  );
}

const styles = StyleSheet.create({
  ringText: { ...jakartaSemiboldText, fontSize: 10.5, lineHeight: 14 },
});

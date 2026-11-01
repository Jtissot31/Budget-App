/**
 * Activité summary: this month's income against expenses, as one two-colour bar.
 * Transfers count on neither side: they only move money between accounts.
 * Tapping it opens the transactions analysis.
 */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/icons/AppIcon';
import { FitText, ListCard, PressScale } from '@/components/kit';
import { jakartaMediumText, jakartaSemiboldText, spacing } from '@/constants/theme';
import { BUDGET_OVER } from '@/lib/budgetTone';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { Transaction } from '@/types';

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
  const router = useRouter();
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

  const hasActivity = income > 0 || expenses > 0;

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`Revenus ${formatDisplayMoneyAbsolute(income)}, dépenses ${formatDisplayMoneyAbsolute(expenses)} ce mois. Voir l’analyse`}
      scaleTo={0.98}
      onPress={() => {
        tapHaptic();
        router.push('/transactions-insights');
      }}
    >
      <ListCard padding={16} style={styles.card}>
        <View style={styles.totals}>
          <View style={styles.total}>
            <View style={styles.labelRow}>
              <View style={[styles.dot, { backgroundColor: colors.accentGreen }]} />
              <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
                Revenus
              </Text>
            </View>
            <FitText style={[styles.amount, { color: colors.text }]} fontSize={20} lineHeight={26} minScale={0.6}>
              {formatDisplayMoneyAbsolute(income)}
            </FitText>
          </View>
          <View style={styles.total}>
            <View style={styles.labelRow}>
              <View style={[styles.dot, { backgroundColor: BUDGET_OVER }]} />
              <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
                Dépenses
              </Text>
            </View>
            <FitText style={[styles.amount, { color: colors.text }]} fontSize={20} lineHeight={26} minScale={0.6}>
              {formatDisplayMoneyAbsolute(expenses)}
            </FitText>
          </View>
          <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
        </View>

        <View style={styles.bar}>
          {hasActivity ? (
            <>
              {income > 0 ? <View style={[styles.segment, { flexGrow: income, backgroundColor: colors.accentGreen }]} /> : null}
              {expenses > 0 ? <View style={[styles.segment, { flexGrow: expenses, backgroundColor: BUDGET_OVER }]} /> : null}
            </>
          ) : (
            <View style={[styles.segment, { flexGrow: 1, backgroundColor: colors.borderSubtle }]} />
          )}
        </View>
      </ListCard>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  totals: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  total: { flexGrow: 1, flexBasis: 0, minWidth: 0, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { ...jakartaMediumText, flexShrink: 1, fontSize: 13, lineHeight: 17 },
  amount: { ...jakartaSemiboldText },
  bar: { flexDirection: 'row', gap: 3, height: 12 },
  segment: { flexBasis: 0, minWidth: 6, borderRadius: 6 },
});

import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OnyxContainer } from '@/components/OnyxContainer';
import { ProtoSectionHeader } from '@/components/proto/ProtoSectionHeader';
import { TransactionRow } from '@/components/TransactionRow';
import { ONYX_CONTAINER } from '@/constants/planFinanceKit';
import { spacing, typographyKit } from '@/constants/theme';
import { formatBudgetMonthLabel } from '@/lib/budgetMonth';
import { tapHaptic } from '@/lib/haptics';
import { openTransactionDetail } from '@/lib/openTransactionDetail';
import type { BudgetOverrunData } from '@/lib/resolveBudgetOverrun';
import { useAppTheme } from '@/lib/themeContext';

const MAX_VISIBLE = 8;

type Props = {
  data: BudgetOverrunData;
};

export function BudgetOverrunTransactions({ data }: Props) {
  const { colors } = useAppTheme();
  const router = useRouter();

  const busting = useMemo(
    () => data.transactions.filter((tx) => data.overspendTransactionIds.has(tx.id)),
    [data.overspendTransactionIds, data.transactions],
  );

  const showingSubset = busting.length > 0 && busting.length < data.transactions.length;
  const source = showingSubset ? busting : data.transactions;
  const visible = source.slice(0, MAX_VISIBLE);
  const hiddenCount = Math.max(0, source.length - visible.length);

  const title = showingSubset
    ? 'Dépenses hors budget'
    : data.isCurrentMonth
      ? 'Dépenses ce mois-ci'
      : `Dépenses — ${formatBudgetMonthLabel(data.monthDate)}`;

  const handlePressTransaction = useCallback((transactionId: string) => {
    tapHaptic();
    openTransactionDetail(transactionId);
  }, []);

  const handleSeeAll = useCallback(() => {
    if (!data.categoryId) return;
    tapHaptic();
    router.push({
      pathname: '/budget-category-transactions',
      params: { id: data.categoryId, name: data.categoryName },
    });
  }, [data.categoryId, data.categoryName, router]);

  if (data.transactions.length === 0) {
    return (
      <View style={styles.section}>
        <ProtoSectionHeader title={title.toUpperCase()} />
        <OnyxContainer style={styles.emptyCard}>
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            Aucune dépense trouvée pour cette enveloppe.
          </Text>
        </OnyxContainer>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <ProtoSectionHeader
        title={title.toUpperCase()}
        actionLabel="Voir tout"
        onAction={handleSeeAll}
      />
      <OnyxContainer style={styles.listCard}>
        {visible.map((tx) => (
          <TransactionRow
            key={tx.id}
            transaction={tx}
            embedded
            onPressId={handlePressTransaction}
          />
        ))}
      </OnyxContainer>
      {hiddenCount > 0 ? (
        <Text style={[styles.more, { color: colors.textMuted }]}>
          + {hiddenCount} autre{hiddenCount > 1 ? 's' : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    alignSelf: 'stretch',
  },
  listCard: {
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  emptyCard: {
    padding: ONYX_CONTAINER.padding.card,
  },
  empty: {
    ...typographyKit.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  more: {
    ...typographyKit.metaMedium,
    fontSize: 12,
    lineHeight: 16,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

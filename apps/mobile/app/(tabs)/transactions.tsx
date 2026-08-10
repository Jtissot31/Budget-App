/**
 * Transactions tab — Budget Proto (cashflow hero + type filters + date-grouped list).
 * FAB → add-transaction; row tap → transaction detail. Agenda / merchants live elsewhere.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { ProtoTransactionRow } from '@/components/transactions/ProtoTransactionRow';
import { TransactionsCashflowHero } from '@/components/transactions/TransactionsCashflowHero';
import {
  TransactionsTypeFilter,
  TransactionsViewHeader,
  type HistoryTypeFilter,
} from '@/components/transactions/TransactionsViewHeader';
import {
  FLOATING_NAV_CONTENT_PADDING,
  jakartaExtraBoldText,
  jakartaMediumText,
  radius,
  screenHorizontalGutter,
  spacing,
  typography,
  typographyKit,
} from '@/constants/theme';
import {
  formatProtoDaySectionLabel,
  todayDayKey,
} from '@/lib/transactionListSectionFormat';
import { getTransactions, getSimulatedAccounts } from '@/lib/db';
import { ensureDbReady } from '@/lib/init';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { openTransactionDetail } from '@/lib/openTransactionDetail';
import { UNIFORM_ACTION_BUTTON_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
import { useAppTheme } from '@/lib/themeContext';
import type { SimulatedAccount, Transaction } from '@/types';

function getLocalDayKey(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type ProtoDayGroupProps = {
  date: string;
  txs: Transaction[];
  accounts: SimulatedAccount[];
  savingsGoals: readonly { id: string; name: string }[];
  horizontalGutter: number;
  onPressTransaction: (transactionId: string) => void;
};

const ProtoDayGroup = memo(function ProtoDayGroup({
  date,
  txs,
  accounts,
  savingsGoals,
  horizontalGutter,
  onPressTransaction,
}: ProtoDayGroupProps) {
  const { colors } = useAppTheme();
  const todayKey = useMemo(() => todayDayKey(), []);
  const sectionLabel = useMemo(
    () => formatProtoDaySectionLabel(date, todayKey),
    [date, todayKey],
  );

  return (
    <View style={[styles.group, { paddingHorizontal: horizontalGutter }]}>
      <Text style={[styles.dateLabel, { color: colors.textMuted }]}>{sectionLabel}</Text>
      <ProtoGlassCard>
        {txs.map((tx, index) => (
          <ProtoTransactionRow
            key={tx.id}
            transaction={tx}
            accounts={accounts}
            savingsGoals={savingsGoals}
            isLast={index === txs.length - 1}
            onPressId={onPressTransaction}
          />
        ))}
      </ProtoGlassCard>
    </View>
  );
});

export default function TransactionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const contentGutter = Platform.OS === 'web' ? 0 : screenHorizontalGutter(insets);
  const listRef = useRef<FlatList<[string, Transaction[]]>>(null);
  const [items, setItems] = useState<Transaction[]>([]);
  const [simulatedAccounts, setSimulatedAccounts] = useState<SimulatedAccount[]>([]);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<HistoryTypeFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const savingsGoals = useSavingsGoals();

  const load = useCallback(async () => {
    await ensureDbReady();
    const [transactions, accounts] = await Promise.all([
      getTransactions(),
      getSimulatedAccounts(),
    ]);
    setItems(transactions);
    setSimulatedAccounts(accounts);
  }, []);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => {
      void load();
    });
  }, [load]);

  useRefreshOnFocus(load, { minIntervalMs: 5_000 });
  useScrollToTopOnFocus(
    useCallback(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, []),
  );

  const filteredItems = useMemo(() => {
    if (historyTypeFilter === 'all') return items;
    return items.filter((tx) => tx.type === historyTypeFilter);
  }, [historyTypeFilter, items]);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of filteredItems) {
      const key = getLocalDayKey(tx.date);
      const bucket = map.get(key);
      if (bucket) bucket.push(tx);
      else map.set(key, [tx]);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0));
  }, [filteredItems]);

  const monthCashflow = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let totalIncome = 0;
    let totalSpend = 0;
    for (const tx of items) {
      const d = new Date(tx.date);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== y || d.getMonth() !== m) continue;
      if (tx.type === 'income') totalIncome += Math.abs(tx.amount);
      else if (tx.type === 'expense') totalSpend += Math.abs(tx.amount);
    }
    const monthLabel = now.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' });
    return { totalIncome, totalSpend, monthLabel };
  }, [items]);

  const handlePressTransaction = useCallback((transactionId: string) => {
    openTransactionDetail(transactionId);
  }, []);

  const listHeader = useMemo(
    () => (
      <View style={{ paddingHorizontal: contentGutter, marginBottom: spacing.md }}>
        <View style={{ marginBottom: spacing.lg }}>
          <TransactionsCashflowHero
            monthLabel={monthCashflow.monthLabel}
            totalIncome={monthCashflow.totalIncome}
            totalSpend={monthCashflow.totalSpend}
          />
        </View>
        <TransactionsTypeFilter value={historyTypeFilter} onChange={setHistoryTypeFilter} />
      </View>
    ),
    [
      contentGutter,
      historyTypeFilter,
      monthCashflow.monthLabel,
      monthCashflow.totalIncome,
      monthCashflow.totalSpend,
    ],
  );

  const renderDayGroup = useCallback(
    ({ item: [date, txs] }: { item: [string, Transaction[]] }) => (
      <ProtoDayGroup
        date={date}
        txs={txs}
        accounts={simulatedAccounts}
        savingsGoals={savingsGoals}
        horizontalGutter={contentGutter}
        onPressTransaction={handlePressTransaction}
      />
    ),
    [contentGutter, handlePressTransaction, savingsGoals, simulatedAccounts],
  );

  const hasActiveFilter = historyTypeFilter !== 'all';

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <TransactionsViewHeader topInset={insets.top} titleColor={colors.text} />

        <FlatList
          ref={listRef}
          style={styles.listViewport}
          data={grouped}
          keyExtractor={([date]) => date}
          extraData={`${historyTypeFilter}:${simulatedAccounts.length}`}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[
            styles.listWithHeader,
            { paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={{ paddingHorizontal: contentGutter }}>
              <ProtoGlassCard style={styles.emptyCard}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
                  <AppIcon family="ionicons" name="receipt-outline" size={22} color={colors.textMuted} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {hasActiveFilter ? 'Aucun résultat' : 'Aucune transaction'}
                </Text>
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                  {hasActiveFilter
                    ? 'Essaie un autre filtre.'
                    : 'Ajoute une transaction avec le bouton +.'}
                </Text>
                {!hasActiveFilter ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      tapHaptic();
                      router.push({ pathname: '/add-transaction', params: { type: 'expense' } });
                    }}
                    style={({ pressed }) => [
                      styles.emptyCta,
                      { backgroundColor: colors.accentGreen },
                      pressed && styles.pressed,
                    ]}
                  >
                    <AppIcon family="ionicons" name="add" size={16} color={colors.background} />
                    <Text style={[styles.emptyCtaText, { color: colors.background }]}>
                      Nouvelle transaction
                    </Text>
                  </Pressable>
                ) : null}
              </ProtoGlassCard>
            </View>
          }
          renderItem={renderDayGroup}
        />
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listViewport: { flex: 1 },
  listWithHeader: {
    paddingBottom: FLOATING_NAV_CONTENT_PADDING,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...jakartaExtraBoldText,
    fontSize: typography.body,
    textAlign: 'center',
  },
  emptyHint: {
    ...jakartaMediumText,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    minHeight: UNIFORM_ACTION_BUTTON_MIN_HEIGHT,
  },
  emptyCtaText: {
    ...jakartaExtraBoldText,
    fontSize: typography.body,
  },
  group: {
    marginBottom: spacing.md,
  },
  dateLabel: {
    ...typographyKit.eyebrow,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  pressed: { opacity: 0.78 },
});

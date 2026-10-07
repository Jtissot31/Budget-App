/**
 * Transactions tab — Budget Proto (type filters + date-grouped list).
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
import { MinimalDatePicker } from '@/components/MinimalDatePicker';
import { PageTransition } from '@/components/PageTransition';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import {
  ProtoActiveFilterChip,
  ProtoSearchField,
  ProtoToolbarIconButton,
} from '@/components/proto/ProtoSearchToolbar';
import { SpendAndSaveCard } from '@/components/dashboard/SpendAndSaveCard';
import { ProtoTransactionRow } from '@/components/transactions/ProtoTransactionRow';
import {
  TransactionsTypeFilter,
  TransactionsViewHeader,
  type HistoryTypeFilter,
} from '@/components/transactions/TransactionsViewHeader';
import { VoiceTransactionSheet } from '@/components/VoiceTransactionSheet';
import { TRANSACTIONS_FAB_STACK_HEIGHT } from '@/constants/fabStyles';
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
import { formatFriendlyDateLabel } from '@/lib/formatFriendlyDateLabel';
import {
  formatProtoDaySectionLabel,
  todayDayKey,
} from '@/lib/transactionListSectionFormat';
import {
  getLocalDayKey,
  transactionMatchesSearch,
} from '@/lib/transactionListUtils';
import { getTransactions, getSimulatedAccounts } from '@/lib/db';
import { ensureDbReady } from '@/lib/init';
import { dataEvents, uiEvents } from '@/lib/events';
import { KNOWN_MERCHANT_NAMES, QUEBEC_DEMO_MERCHANT_NAMES } from '@/lib/merchantLogo';
import { tapHaptic } from '@/lib/haptics';
import { openTransactionDetail } from '@/lib/openTransactionDetail';
import { UNIFORM_ACTION_BUTTON_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
import { useAppTheme } from '@/lib/themeContext';
import type { SimulatedAccount, Transaction } from '@/types';

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
      <ProtoGlassCard style={styles.dayCard}>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [voiceSheetOpen, setVoiceSheetOpen] = useState(false);
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

  useEffect(() => uiEvents.subscribeVoiceTransaction(() => setVoiceSheetOpen(true)), []);

  useRefreshOnFocus(load, { minIntervalMs: 5_000 });
  useScrollToTopOnFocus(
    useCallback(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, []),
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim();
    return items.filter((tx) => {
      if (historyTypeFilter !== 'all' && tx.type !== historyTypeFilter) return false;
      if (dateFilter && getLocalDayKey(tx.date) !== dateFilter) return false;
      if (query && !transactionMatchesSearch(tx, query)) return false;
      return true;
    });
  }, [dateFilter, historyTypeFilter, items, searchQuery]);

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

  /** Catalogue Québec/Canada + commerces déjà saisis — base de reconnaissance de la dictée. */
  const knownMerchantNames = useMemo(() => {
    const names = new Set<string>([...QUEBEC_DEMO_MERCHANT_NAMES, ...KNOWN_MERCHANT_NAMES]);
    for (const tx of items) {
      if (tx.type !== 'expense') continue;
      const label = tx.label.trim();
      if (label) names.add(label);
    }
    return [...names];
  }, [items]);

  const handlePressTransaction = useCallback((transactionId: string) => {
    openTransactionDetail(transactionId);
  }, []);

  const openDatePicker = useCallback(() => {
    tapHaptic();
    setDatePickerOpen(true);
  }, []);

  const clearDateFilter = useCallback(() => {
    tapHaptic();
    setDateFilter('');
  }, []);

  const listHeader = useMemo(
    () => (
      <>
        <TransactionsViewHeader topInset={insets.top} titleColor={colors.text} />
        <View style={{ paddingHorizontal: contentGutter, marginBottom: spacing.md }}>
          <View style={styles.searchToolbar}>
            <ProtoSearchField
              value={searchQuery}
              onChangeText={setSearchQuery}
              accessibilityLabel="Rechercher une transaction"
            />
            <ProtoToolbarIconButton
              icon="receipt-outline"
              onPress={() => {
                tapHaptic();
                router.push('/documents-library');
              }}
              accessibilityLabel="Bibliothèque de documents"
            />
            <ProtoToolbarIconButton
              icon={dateFilter ? 'calendar' : 'calendar-outline'}
              active={Boolean(dateFilter)}
              onPress={openDatePicker}
              accessibilityLabel="Rechercher par date"
            />
          </View>
          {dateFilter ? (
            <ProtoActiveFilterChip
              icon="calendar"
              label={formatFriendlyDateLabel(dateFilter)}
              onPress={openDatePicker}
              onClear={clearDateFilter}
              accessibilityLabel={`Date filtrée : ${formatFriendlyDateLabel(dateFilter)}. Modifier`}
              clearAccessibilityLabel="Effacer le filtre de date"
            />
          ) : null}
          <TransactionsTypeFilter value={historyTypeFilter} onChange={setHistoryTypeFilter} />
        </View>
        <View style={{ paddingHorizontal: contentGutter, marginBottom: spacing.md }}>
          <SpendAndSaveCard />
        </View>
      </>
    ),
    [
      clearDateFilter,
      colors.text,
      contentGutter,
      dateFilter,
      historyTypeFilter,
      insets.top,
      openDatePicker,
      router,
      searchQuery,
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

  const hasActiveFilter =
    historyTypeFilter !== 'all' || searchQuery.trim().length > 0 || Boolean(dateFilter);

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <FlatList
          ref={listRef}
          style={styles.listViewport}
          data={grouped}
          keyExtractor={([date]) => date}
          extraData={`${historyTypeFilter}:${searchQuery}:${dateFilter}:${simulatedAccounts.length}`}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={7}
          // Web leaves this off. On device it clips rows inside overflow:hidden day cards.
          removeClippedSubviews={false}
          ListHeaderComponent={listHeader}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.listWithHeader,
            // + hauteur du FAB micro empilé au-dessus du + vert.
            {
              paddingBottom:
                insets.bottom + FLOATING_NAV_CONTENT_PADDING + TRANSACTIONS_FAB_STACK_HEIGHT,
            },
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
                    ? 'Essaie une autre recherche, une autre date ou un autre filtre.'
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

        <MinimalDatePicker
          visible={datePickerOpen}
          value={dateFilter}
          allowClear
          onCancel={() => setDatePickerOpen(false)}
          onConfirm={(value) => {
            setDateFilter(value);
            setDatePickerOpen(false);
          }}
        />

        <VoiceTransactionSheet
          visible={voiceSheetOpen}
          onClose={() => setVoiceSheetOpen(false)}
          accounts={simulatedAccounts}
          merchantNames={knownMerchantNames}
        />
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listViewport: { flex: 1, width: '100%', alignSelf: 'stretch' },
  listWithHeader: {
    paddingBottom: FLOATING_NAV_CONTENT_PADDING,
  },
  searchToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
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
  pressed: { opacity: 0.78 },
});

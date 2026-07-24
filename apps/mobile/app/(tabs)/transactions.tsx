import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgendaView, type AgendaViewRef } from '@/components/AgendaView';
import { ContactFormModal } from '@/components/ContactFormModal';
import { MerchantDirectory, type MerchantDirectoryRow } from '@/components/MerchantDirectory';
import type { ContactDirectoryRow } from '@/components/ContactDirectory';
import { MerchantEditModal, type MerchantEditTarget } from '@/components/MerchantEditModal';
import { DashboardCard } from '@/components/DashboardCard';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { type FormFeedback } from '@/lib/formFeedback';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import {
  formatHistoryDaySectionHeader,
  sumHistoryDayTotals,
  todayDayKey,
} from '@/lib/transactionListSectionFormat';
import {
  createNewRecurringPaymentForm,
  RecurringPaymentFormModal,
  manualAccountOptions,
  recurringPaymentToForm,
  saveRecurringPaymentForm,
  toAccountOptions,
  type PaymentForm,
  type RecurringPaymentAddVariant,
} from '@/lib/recurringPaymentsForm';
import { PageTransition } from '@/components/PageTransition';
import { TransactionRow } from '@/components/TransactionRow';
import {
  TransactionsViewHeader,
  type HistoryTypeFilter,
  type TransactionsViewTab,
} from '@/components/transactions/TransactionsViewHeader';
import {
  colors,
  FLOATING_NAV_CONTENT_PADDING,
  ICON_WELL_SIZE,
  PAGE_PADDING_HORIZONTAL,
  radius,
  screenHorizontalGutter,
  spacing,
  typography,
  typographyKit,
} from '@/constants/theme';
import { getContacts, getMerchantOverrides, getTransactions, sortTransactionsNewestFirst, getCategories, getCategoryBudgets, getSimulatedAccounts } from '@/lib/db';
import { ensureDbReady } from '@/lib/init';
import { isContactTransferTx, parseAccountIdFromNote } from '@/lib/accountTransactionFlow';
import { buildContactDirectoryRows } from '@/lib/contactHistory';
import {
  buildMerchantOverrideByNormalizedName,
  getMerchantOverrideForLabel,
  normalizeMerchantKey,
  resolveCanonicalMerchantOriginalName,
} from '@/lib/merchantLogo';
import { dataEvents, uiEvents } from '@/lib/events';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { openTransactionDetail } from '@/lib/openTransactionDetail';
import {
  UNIFORM_ACTION_BUTTON_MIN_HEIGHT,
} from '@/lib/uniformGroupStyles';
import { useContactPhotoMap } from '@/hooks/useContactPhotoMap';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
import { useAppTheme } from '@/lib/themeContext';
import type { Category, CategoryBudget, Contact, MerchantOverride, RecurringPayment, SimulatedAccount, Transaction } from '@/types';

type ViewTab = TransactionsViewTab;

function getLocalDayKey(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRequestedView(view?: string): ViewTab | null {
  if (view === 'agenda' || view === 'merchants' || view === 'history') return view;
  return null;
}

type HistoryDayGroupProps = {
  date: string;
  txs: Transaction[];
  accounts: SimulatedAccount[];
  savingsGoals: readonly { id: string; name: string }[];
  contactPhotoByKey: ReadonlyMap<string, string>;
  merchantOverrideByLabel: ReadonlyMap<string, MerchantOverride>;
  horizontalGutter: number;
  onPressTransaction: (transactionId: string) => void;
};

const HistoryDayGroup = memo(function HistoryDayGroup({
  date,
  txs,
  accounts,
  savingsGoals,
  contactPhotoByKey,
  merchantOverrideByLabel,
  horizontalGutter,
  onPressTransaction,
}: HistoryDayGroupProps) {
  const { colors } = useAppTheme();
  const todayKey = useMemo(() => todayDayKey(), []);
  const sectionHeader = useMemo(() => formatHistoryDaySectionHeader(date, todayKey), [date, todayKey]);
  const dayTotals = useMemo(() => sumHistoryDayTotals(txs), [txs]);
  const showDayTotals = dayTotals.expenseTotal > 0 || dayTotals.incomeTotal > 0;
  const showAccountSubtitle = useMemo(() => {
    const accountIds = new Set(
      txs
        .map((tx) => parseAccountIdFromNote(tx.note))
        .filter((id): id is string => Boolean(id)),
    );
    return accountIds.size > 1;
  }, [txs]);
  const textFaint = colors.textMuted;
  const textMutedSoft = colors.textSecondary;

  return (
    <View style={[styles.group, { paddingHorizontal: horizontalGutter }]}>
      <View style={styles.dateHeader}>
        <Text style={[styles.dateHeaderLabel, { color: textFaint }]}>
          <Text style={[styles.dateHeaderBold, { color: textMutedSoft }]}>{sectionHeader.titleBold}</Text>
          {sectionHeader.titleSuffix}
        </Text>
        {showDayTotals ? (
          <View style={styles.dateHeaderTotals}>
            {dayTotals.expenseTotal > 0 ? (
              <Text style={[styles.dateHeaderAmount, { color: colors.text }]}>
                −{formatDisplayMoneyAbsolute(dayTotals.expenseTotal)}
              </Text>
            ) : null}
            {dayTotals.incomeTotal > 0 ? (
              <Text style={[styles.dateHeaderAmount, { color: colors.success }]}>
                +{formatDisplayMoneyAbsolute(dayTotals.incomeTotal)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <DashboardCard padding={0} innerStyle={styles.groupCard}>
        {txs.map((tx, index) => (
          <TransactionRow
            key={tx.id}
            transaction={tx}
            accounts={accounts}
            savingsGoals={savingsGoals}
            contactPhotoByKey={contactPhotoByKey}
            merchantOverrideByLabel={merchantOverrideByLabel}
            onPressId={onPressTransaction}
            embedded
            isLast={index === txs.length - 1}
            showAccountSubtitle={showAccountSubtitle}
          />
        ))}
      </DashboardCard>
    </View>
  );
});

export default function TransactionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const contentGutter = Platform.OS === 'web' ? 0 : screenHorizontalGutter(insets);
  const contentCanvas = colors.background;
  const historyListRef = useRef<FlatList<[string, Transaction[]]>>(null);
  const merchantsListRef = useRef<FlatList<MerchantDirectoryRow | ContactDirectoryRow>>(null);
  const agendaRef = useRef<AgendaViewRef>(null);
  const hasBlurredRef = useRef(false);
  const [items, setItems] = useState<Transaction[]>([]);
  const [simulatedAccounts, setSimulatedAccounts] = useState<SimulatedAccount[]>([]);
  const [merchantOverrides, setMerchantOverrides] = useState<MerchantOverride[]>([]);
  const [savedContacts, setSavedContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<HistoryTypeFilter>('all');
  const [historyFiltersExpanded, setHistoryFiltersExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const initialView: ViewTab =
    params.view === 'agenda' ? 'agenda' : params.view === 'merchants' ? 'merchants' : 'history';
  const [activeView, setActiveView] = useState<ViewTab>(initialView);
  const [editingMerchant, setEditingMerchant] = useState<MerchantEditTarget | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [recurringForm, setRecurringForm] = useState<PaymentForm | null>(null);
  const [recurringAccounts, setRecurringAccounts] = useState(manualAccountOptions());
  const [recurringCategories, setRecurringCategories] = useState<Category[]>([]);
  const [recurringCategoryBudgets, setRecurringCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [recurringFeedback, setRecurringFeedback] = useState<FormFeedback | null>(null);
  const requestedView = getRequestedView(params.view);
  const savingsGoals = useSavingsGoals();
  const contactPhotoByKey = useContactPhotoMap();

  // Lazy-mount Agenda / Merchants so hidden tabs do not load DB or subscribe on first paint.
  const [mountedViews, setMountedViews] = useState<Record<ViewTab, boolean>>(() => ({
    history: true,
    agenda: initialView === 'agenda',
    merchants: initialView === 'merchants',
  }));

  const setCurrentView = useCallback(
    (view: ViewTab) => {
      setActiveView(view);
      setMountedViews((prev) => (prev[view] ? prev : { ...prev, [view]: true }));
      router.setParams({ view });
    },
    [router],
  );

  const scrollViewToTop = useCallback((view: ViewTab) => {
    if (view === 'history') {
      historyListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
    if (view === 'merchants') {
      merchantsListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
    if (view === 'agenda') {
      agendaRef.current?.resetToTop();
    }
  }, []);

  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const needsReloadRef = useRef(false);

  const load = useCallback(async () => {
    if (loadInFlightRef.current) {
      needsReloadRef.current = true;
      return loadInFlightRef.current;
    }

    const run = (async () => {
      do {
        needsReloadRef.current = false;
        await ensureDbReady();
        const [transactions, accounts, overrides, contacts] = await Promise.all([
          getTransactions(),
          getSimulatedAccounts(),
          getMerchantOverrides(),
          getContacts(),
        ]);
        setItems(transactions);
        setSimulatedAccounts(accounts);
        setMerchantOverrides(overrides);
        setSavedContacts(contacts);
      } while (needsReloadRef.current);
    })();

    loadInFlightRef.current = run;
    try {
      await run;
    } finally {
      if (loadInFlightRef.current === run) {
        loadInFlightRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);

  const prepareRecurringFormContext = useCallback(async () => {
    const [categories, categoryBudgets, simulatedAccounts] = await Promise.all([
      getCategories(),
      getCategoryBudgets(),
      getSimulatedAccounts(),
    ]);
    const accounts = toAccountOptions(simulatedAccounts);
    const accountOptions = accounts.length ? accounts : manualAccountOptions();
    setRecurringAccounts(accountOptions);
    setRecurringCategories(categories);
    setRecurringCategoryBudgets(categoryBudgets);
    return { accountOptions, categories };
  }, []);

  const openNewRecurringPayment = useCallback(async (variant: RecurringPaymentAddVariant = 'bill') => {
    tapHaptic();
    const { accountOptions, categories } = await prepareRecurringFormContext();
    setRecurringForm(createNewRecurringPaymentForm(accountOptions, categories, variant));
  }, [prepareRecurringFormContext]);

  const openEditRecurringPayment = useCallback(async (payment: RecurringPayment) => {
    await prepareRecurringFormContext();
    setRecurringForm(recurringPaymentToForm(payment));
  }, [prepareRecurringFormContext]);

  useEffect(() => uiEvents.subscribeNewRecurringPayment((variant) => {
    if (activeView !== 'agenda') return;
    void openNewRecurringPayment(variant);
  }), [activeView, openNewRecurringPayment]);

  const saveRecurringPayment = async () => {
    if (!recurringForm) return;
    setRecurringSaving(true);
    const result = await saveRecurringPaymentForm(recurringForm, recurringAccounts);
    setRecurringSaving(false);
    if (result !== true) {
      setRecurringFeedback(result);
      return;
    }
    setRecurringFeedback(null);
    setRecurringForm(null);
    dataEvents.emit();
    successHaptic();
  };

  useRefreshOnFocus(load, { minIntervalMs: 5_000 });
  useEffect(() => {
    if (requestedView) {
      setActiveView(requestedView);
      setMountedViews((prev) =>
        prev[requestedView] ? prev : { ...prev, [requestedView]: true },
      );
    }
  }, [requestedView]);

  useFocusEffect(
    useCallback(() => {
      if (hasBlurredRef.current) {
        const nextView = requestedView ?? 'history';
        setActiveView(nextView);
        setMountedViews((prev) => (prev[nextView] ? prev : { ...prev, [nextView]: true }));
        router.setParams({ view: nextView });
        scrollViewToTop(nextView);
      }

      return () => {
        hasBlurredRef.current = true;
      };
    }, [requestedView, router, scrollViewToTop]),
  );
  useScrollToTopOnFocus(
    useCallback(() => {
      scrollViewToTop(activeView);
    }, [activeView, scrollViewToTop]),
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollViewToTop(activeView));
    return () => cancelAnimationFrame(frame);
  }, [activeView, scrollViewToTop]);

  const merchantOverrideMap = useMemo(
    () => buildMerchantOverrideByNormalizedName(merchantOverrides),
    [merchantOverrides],
  );

  const transactionMerchantLabels = useMemo(
    () => items.map((tx) => tx.label),
    [items],
  );

  const resolveMerchantOriginalName = useCallback(
    (displayName: string) => resolveCanonicalMerchantOriginalName(displayName, items.map((tx) => tx.label)),
    [items],
  );

  const merchants = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number; lastVisit: string | null }>();
    items.forEach((tx) => {
      if (tx.type === 'transfer' || tx.type === 'income' || isContactTransferTx(tx)) return;
      const cur = map.get(tx.label) ?? {
        name: tx.label,
        count: 0,
        total: 0,
        lastVisit: null,
      };
      cur.count += 1;
      cur.total += tx.amount;
      if (!cur.lastVisit || tx.date > cur.lastVisit) {
        cur.lastVisit = tx.date;
      }
      map.set(tx.label, cur);
    });
    const fromTransactions = [...map.values()]
      .flatMap((m): MerchantDirectoryRow[] => {
        const override = getMerchantOverrideForLabel(m.name, merchantOverrideMap);
        if (override?.hidden) return [];
        return [{
          originalName: m.name,
          name: override?.displayName?.trim() || m.name,
          logoUrl: override?.logoUrl ?? null,
          icon: override?.icon ?? null,
          useAutoLogo: override?.useAutoLogo !== false,
          count: m.count,
          total: m.total,
          lastVisit: m.lastVisit,
        }];
      });

    const transactionLabelKeys = new Set([...map.keys()].map((label) => normalizeMerchantKey(label)));
    const standaloneMerchants = merchantOverrides
      .filter(
        (override) =>
          !override.hidden && !transactionLabelKeys.has(normalizeMerchantKey(override.originalName)),
      )
      .map((override): MerchantDirectoryRow => ({
        originalName: override.originalName,
        name: override.displayName?.trim() || override.originalName,
        logoUrl: override.logoUrl ?? null,
        icon: override.icon ?? null,
        useAutoLogo: override.useAutoLogo !== false,
        count: 0,
        total: 0,
        lastVisit: null,
      }));

    return [...fromTransactions, ...standaloneMerchants].sort((a, b) => b.total - a.total);
  }, [items, merchantOverrideMap, merchantOverrides]);

  const contacts = useMemo(
    () => buildContactDirectoryRows(items, savedContacts),
    [items, savedContacts],
  );

  const openAddMerchant = () => {
    tapHaptic();
    setEditingMerchant({
      originalName: '',
      displayName: '',
    });
  };

  const closeMerchantEditor = () => {
    setEditingMerchant(null);
  };

  const searchFilteredItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (tx) =>
        tx.label.toLowerCase().includes(query) ||
        (tx.categoryName?.toLowerCase().includes(query) ?? false),
    );
  }, [items, deferredSearch]);

  const historyFilteredItems = useMemo(() => {
    if (historyTypeFilter === 'all') return searchFilteredItems;
    return searchFilteredItems.filter((tx) => tx.type === historyTypeFilter);
  }, [historyTypeFilter, searchFilteredItems]);

  const grouped = useMemo(() => {
    const g: Record<string, Transaction[]> = {};
    historyFilteredItems.forEach((tx) => {
      const key = getLocalDayKey(tx.date);
      if (!g[key]) g[key] = [];
      g[key].push(tx);
    });
    return Object.entries(g)
      .map(([day, txs]) => [day, sortTransactionsNewestFirst(txs)] as [string, Transaction[]])
      .sort(([a], [b]) => b.localeCompare(a));
  }, [historyFilteredItems]);

  const historyHasActiveFilters = search.trim().length > 0 || historyTypeFilter !== 'all';

  const handlePressTransaction = useCallback((transactionId: string) => {
    tapHaptic();
    openTransactionDetail(transactionId);
  }, []);

  const renderHistoryDayGroup = useCallback(
    ({ item: [date, txs] }: { item: [string, Transaction[]] }) => (
      <HistoryDayGroup
        date={date}
        txs={txs}
        accounts={simulatedAccounts}
        savingsGoals={savingsGoals}
        contactPhotoByKey={contactPhotoByKey}
        merchantOverrideByLabel={merchantOverrideMap}
        horizontalGutter={contentGutter}
        onPressTransaction={handlePressTransaction}
      />
    ),
    [contactPhotoByKey, contentGutter, handlePressTransaction, merchantOverrideMap, savingsGoals, simulatedAccounts],
  );

  const renderScrollHeader = useCallback(
    (showHistoryToolbar: boolean) => (
      <TransactionsViewHeader
        topInset={insets.top}
        titleColor={colors.text}
        activeView={activeView}
        onChangeView={setCurrentView}
        showHistoryToolbar={showHistoryToolbar}
        search={search}
        onSearchChange={setSearch}
        historyFiltersExpanded={historyFiltersExpanded}
        onToggleHistoryFilters={() => setHistoryFiltersExpanded((expanded) => !expanded)}
        historyTypeFilter={historyTypeFilter}
        onHistoryTypeFilterChange={setHistoryTypeFilter}
      />
    ),
    [
      activeView,
      colors.text,
      historyFiltersExpanded,
      historyTypeFilter,
      insets.top,
      search,
      setCurrentView,
    ],
  );

  const historyListHeader = useMemo(() => renderScrollHeader(true), [renderScrollHeader]);
  const agendaMerchantsListHeader = useMemo(() => renderScrollHeader(false), [renderScrollHeader]);

  return (
    <PageTransition>
    <View style={[styles.screen, { backgroundColor: contentCanvas }]}>
      <View
        style={[
          styles.flex,
          { backgroundColor: contentCanvas, display: activeView === 'history' ? 'flex' : 'none' },
        ]}
        collapsable={false}
      >
          <FlatList
            ref={historyListRef}
            style={[styles.listViewport, { backgroundColor: contentCanvas }]}
            data={grouped}
            keyExtractor={([date]) => date}
            extraData={`${deferredSearch}:${historyTypeFilter}:${simulatedAccounts.length}`}
            initialNumToRender={8}
            maxToRenderPerBatch={6}
            windowSize={7}
            removeClippedSubviews={Platform.OS !== 'web'}
            ListHeaderComponent={historyListHeader}
            contentContainerStyle={[
              styles.listWithHeader,
              { backgroundColor: contentCanvas, paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING, paddingTop: spacing.xl },
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
                <PlanFinanceContainer style={styles.historyEmptyInner}>
                  <View style={[styles.historyEmptyIcon, { backgroundColor: colors.surfaceElevated }]}>
                    <AppIcon family="ionicons" name="receipt-outline" size={22} color={colors.textMuted} />
                  </View>
                  <Text style={[styles.historyEmptyTitle, { color: colors.text }]}>
                    {historyHasActiveFilters ? 'Aucun résultat' : 'Aucune transaction'}
                  </Text>
                  <Text style={[styles.historyEmptyHint, { color: colors.textMuted }]}>
                    {historyHasActiveFilters
                      ? 'Essaie un autre filtre ou une autre recherche.'
                      : 'Scanne un reçu pour ajouter ta première transaction.'}
                  </Text>
                  {!historyHasActiveFilters ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        tapHaptic();
                        router.push('/scan');
                      }}
                      style={({ pressed }) => [
                        styles.historyEmptyCta,
                        { backgroundColor: colors.text, borderColor: colors.text },
                        pressed && styles.pressed,
                      ]}
                    >
                      <AppIcon family="ionicons" name="scan-outline" size={16} color={colors.background} />
                      <Text style={[styles.historyEmptyCtaText, { color: colors.background }]}>
                        Scanner un reçu
                      </Text>
                    </Pressable>
                  ) : null}
                </PlanFinanceContainer>
              </View>
            }
            renderItem={renderHistoryDayGroup}
          />
      </View>

      {mountedViews.agenda ? (
        <View
          style={[
            styles.agendaWrap,
            { backgroundColor: contentCanvas, display: activeView === 'agenda' ? 'flex' : 'none' },
          ]}
        >
          <AgendaView
            ref={agendaRef}
            headerComponent={agendaMerchantsListHeader}
            onEditRecurring={(payment) => void openEditRecurringPayment(payment)}
          />
        </View>
      ) : null}

      {mountedViews.merchants ? (
        <View
          style={[
            styles.flex,
            { backgroundColor: contentCanvas, display: activeView === 'merchants' ? 'flex' : 'none' },
          ]}
          collapsable={false}
        >
          <MerchantDirectory
            listRef={merchantsListRef}
            headerComponent={agendaMerchantsListHeader}
            merchants={merchants}
            contacts={contacts}
            contentPaddingBottom={insets.bottom + FLOATING_NAV_CONTENT_PADDING}
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            onAddMerchant={openAddMerchant}
            onPressMerchant={(merchant) => {
              tapHaptic();
              router.push({ pathname: '/merchant-detail', params: { merchant: merchant.originalName } });
            }}
            onPressContact={(contact) => {
              tapHaptic();
              router.push({
                pathname: '/contact-detail',
                params: { contact: contact.key, name: contact.name },
              });
            }}
            onAddContact={() => setShowContactForm(true)}
          />
        </View>
      ) : null}

      <MerchantEditModal
        visible={Boolean(editingMerchant)}
        merchant={editingMerchant}
        bottomInset={insets.bottom}
        resolveOriginalName={resolveMerchantOriginalName}
        transactionMerchantNames={transactionMerchantLabels}
        onClose={closeMerchantEditor}
        onSaved={load}
      />
      <ContactFormModal
        visible={showContactForm}
        bottomInset={insets.bottom}
        onClose={() => setShowContactForm(false)}
        onSaved={load}
      />
      <RecurringPaymentFormModal
        visible={recurringForm != null}
        form={recurringForm}
        accounts={recurringAccounts}
        categories={recurringCategories}
        categoryBudgets={recurringCategoryBudgets}
        saving={recurringSaving}
        bottomInset={insets.bottom}
        onClose={() => {
          setRecurringForm(null);
          setRecurringFeedback(null);
        }}
        onChange={setRecurringForm}
        onSave={() => void saveRecurringPayment()}
        feedback={recurringFeedback}
      />
    </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  historyEmptyInner: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  historyEmptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  historyEmptyTitle: {
    fontSize: typography.body,
    fontWeight: '800',
    textAlign: 'center',
  },
  historyEmptyHint: {
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
  },
  historyEmptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    minHeight: UNIFORM_ACTION_BUTTON_MIN_HEIGHT,
  },
  historyEmptyCtaText: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  list: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingTop: spacing.md,
    paddingBottom: FLOATING_NAV_CONTENT_PADDING,
  },
  listWithHeader: {
    paddingBottom: FLOATING_NAV_CONTENT_PADDING,
  },
  listViewport: { flex: 1 },
  emptyWrap: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  agendaWrap: {
    flex: 1,
  },
  group: {
    marginBottom: spacing.sm,
  },
  dateHeader: {
    paddingVertical: spacing.sm,
    gap: 2,
  },
  dateHeaderLabel: {
    ...typographyKit.microUpper,
  },
  dateHeaderBold: {
    ...typographyKit.microUpper,
  },
  dateHeaderTotals: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  dateHeaderAmount: {
    ...typographyKit.metaMedium,
    fontVariant: ['tabular-nums'],
  },
  groupCard: {
    overflow: 'hidden',
  },
  empty: { color: colors.textMuted, textAlign: 'center', fontSize: typography.caption },
  pressed: { opacity: 0.78 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
  },
  merchantModalSheet: {
    maxHeight: '86%',
    backgroundColor: colors.containerBackground,
    borderRadius: 30,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginBottom: spacing.md,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  modalTitleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  formHeadCopy: { flex: 1, minWidth: 0, gap: 4 },
  formTitle: { color: colors.text, fontSize: typography.body, fontWeight: '800' },
  formHint: { color: colors.textMuted, fontSize: typography.meta, lineHeight: 17 },
  logoPreviewWrap: {
    position: 'relative',
    paddingRight: 4,
    paddingBottom: 4,
  },
  logoPreview: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackPreview: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  logoEditButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: { width: 30, height: 30 },
  logoPickerGroup: {
    gap: spacing.sm,
  },
  logoPickerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  logoPickerHint: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  logoOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  logoOption: {
    width: 58,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  logoOptionActive: {
    backgroundColor: colors.scopeActive,
  },
  logoOptionIcon: {
    width: ICON_WELL_SIZE,
    height: ICON_WELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackOptionIcon: {
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  logoOptionImage: { width: 24, height: 24 },
  inputGroup: { gap: spacing.xs },
  label: {
    color: colors.textMuted,
    fontSize: typography.meta,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: colors.containerBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  saveText: { color: colors.background, fontSize: typography.body, fontWeight: '800' },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
  },
  confirmCard: {
    width: '100%',
  },
  confirmCardInner: {
    alignItems: 'center',
  },
  confirmIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmTitle: {
    ...typographyKit.sectionTitle,
    color: colors.text,
    textAlign: 'center',
  },
  confirmMessage: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    width: '100%',
    marginTop: spacing.lg,
  },
  confirmSecondaryButton: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: UNIFORM_ACTION_BUTTON_MIN_HEIGHT,
    paddingVertical: spacing.md,
  },
  confirmDestructiveButton: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: UNIFORM_ACTION_BUTTON_MIN_HEIGHT,
    paddingVertical: spacing.md,
  },
  confirmSecondaryText: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  confirmDestructiveText: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  flex: { flex: 1 },
});

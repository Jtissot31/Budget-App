import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgendaView, type AgendaViewRef } from '@/components/AgendaView';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { ContactFormModal } from '@/components/ContactFormModal';
import { MerchantDirectory } from '@/components/MerchantDirectory';
import { MerchantEditModal, type MerchantEditTarget } from '@/components/MerchantEditModal';
import { DashboardCard } from '@/components/DashboardCard';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { type FormFeedback } from '@/lib/formFeedback';
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
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  colors,
  containerSurfaceStyle,
  DARK_CANVAS,
  dashboardPaletteForTheme,
  FLOATING_NAV_CONTENT_PADDING,
  ICON_WELL_SIZE,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_CONTENT_GAP,
  PAGE_TITLE_STYLE,
  SECTION_TITLE_STYLE,
  jakartaBoldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { listDayTotal } from '@/lib/textLayout';
import { getContacts, getMerchantOverrides, getTransactions, sortTransactionsNewestFirst, getCategories, getCategoryBudgets, getSimulatedAccounts } from '@/lib/db';
import { ensureDbReady } from '@/lib/init';
import { isContactTransferTx } from '@/lib/accountTransactionFlow';
import { buildContactDirectoryRows } from '@/lib/contactHistory';
import { dataEvents, uiEvents } from '@/lib/events';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import {
  UNIFORM_ACTION_BUTTON_MIN_HEIGHT,
  UNIFORM_SECTION_HEADER_MIN_HEIGHT,
} from '@/lib/uniformGroupStyles';
import { useContactPhotoMap } from '@/hooks/useContactPhotoMap';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
import { useAppTheme } from '@/lib/themeContext';
import type { Category, CategoryBudget, Contact, MerchantOverride, RecurringPayment, SimulatedAccount, Transaction } from '@/types';

type ViewTab = 'history' | 'agenda' | 'merchants';
type HistoryTypeFilter = 'all' | 'expense' | 'income';

type MerchantRow = {
  originalName: string;
  name: string;
  logoUrl?: string | null;
  icon?: string | null;
  useAutoLogo?: boolean;
  count: number;
  total: number;
  lastVisit: string | null;
};

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

function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function isCurrentMonth(isoDate: string) {
  return getLocalDayKey(isoDate).slice(0, 7) === getCurrentMonthKey();
}

function computeMonthStats(transactions: Transaction[]): MonthStats {
  const monthTxs = transactions.filter((tx) => isCurrentMonth(tx.date));
  let expenses = 0;
  let income = 0;
  for (const tx of monthTxs) {
    if (tx.type === 'expense') expenses += tx.amount;
    else if (tx.type === 'income') income += tx.amount;
  }
  return {
    count: monthTxs.length,
    expenses,
    income,
    net: income - expenses,
  };
}


const HISTORY_FILTER_OPTIONS: { id: HistoryTypeFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'expense', label: 'Dépenses' },
  { id: 'income', label: 'Revenus' },
];

type HistoryListItem =
  | { kind: 'search' }
  | { kind: 'day'; date: string; txs: Transaction[] };

type HistoryDayGroupProps = {
  date: string;
  txs: Transaction[];
  accounts: SimulatedAccount[];
  savingsGoals: readonly { id: string; name: string }[];
  contactPhotoByKey: ReadonlyMap<string, string>;
  mutedColor: string;
  onPressTransaction: (transactionId: string) => void;
};

const HistoryDayGroup = memo(function HistoryDayGroup({
  date,
  txs,
  accounts,
  savingsGoals,
  contactPhotoByKey,
  mutedColor,
  onPressTransaction,
}: HistoryDayGroupProps) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeaderRow}>
        <Text style={[styles.groupLabel, { color: mutedColor }]}>
          {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
        </Text>
      </View>
      <View style={styles.groupTransactions}>
        {txs.map((tx) => (
          <TransactionRow
            key={tx.id}
            transaction={tx}
            accounts={accounts}
            savingsGoals={savingsGoals}
            contactPhotoByKey={contactPhotoByKey}
            onPressId={onPressTransaction}
          />
        ))}
      </View>
    </View>
  );
});

export default function TransactionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const dashboardPalette = useMemo(() => dashboardPaletteForTheme(isLight), [isLight]);
  const historyQuickActionsSurface = useMemo(() => containerSurfaceStyle(isLight), [isLight]);
  const contentCanvas = isLight ? colors.background : DARK_CANVAS;
  const historyListRef = useRef<FlatList<HistoryListItem>>(null);
  const merchantsListRef = useRef<FlatList<MerchantRow>>(null);
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
  const [activeView, setActiveView] = useState<ViewTab>(params.view === 'agenda' ? 'agenda' : params.view === 'merchants' ? 'merchants' : 'history');
  const [editingMerchant, setEditingMerchant] = useState<MerchantEditTarget | null>(null);
  const [isEditingMerchants, setIsEditingMerchants] = useState(false);
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

  const setCurrentView = useCallback(
    (view: ViewTab) => {
      setActiveView(view);
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

  const load = useCallback(async () => {
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

  useRefreshOnFocus(load);
  useEffect(() => {
    if (requestedView) {
      setActiveView(requestedView);
    }
  }, [requestedView]);

  useFocusEffect(
    useCallback(() => {
      if (hasBlurredRef.current) {
        const nextView = requestedView ?? 'history';
        setActiveView(nextView);
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
    () => new Map(merchantOverrides.map((override) => [override.originalName, override])),
    [merchantOverrides],
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
    return [...map.values()]
      .flatMap((m): MerchantRow[] => {
        const override = merchantOverrideMap.get(m.name);
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
      })
      .sort((a, b) => b.total - a.total);
  }, [items, merchantOverrideMap]);

  const contacts = useMemo(
    () => buildContactDirectoryRows(items, savedContacts),
    [items, savedContacts],
  );

  const openMerchantEditor = (merchant: MerchantRow) => {
    const override = merchantOverrideMap.get(merchant.originalName);
    tapHaptic();
    setEditingMerchant({
      originalName: merchant.originalName,
      displayName: merchant.name,
      override,
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

  const historyListData = useMemo<HistoryListItem[]>(
    () => [{ kind: 'search' }, ...grouped.map(([date, txs]) => ({ kind: 'day' as const, date, txs }))],
    [grouped],
  );

  const historyHasActiveFilters = search.trim().length > 0 || historyTypeFilter !== 'all';

  const handlePressTransaction = useCallback(
    (transactionId: string) => {
      tapHaptic();
      router.push({ pathname: '/transaction-detail', params: { transactionId } });
    },
    [router],
  );

  const historySearchBar = useMemo(
    () => (
      <View
        style={[
          styles.searchRow,
          {
            backgroundColor: colors.containerBackground,
            borderColor: colors.containerBorder,
            borderWidth: 1,
            marginBottom: historyFiltersExpanded ? spacing.md : 0,
          },
        ]}
      >
        <AppIcon family="ionicons" name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.search, { color: colors.text }]}
          placeholder="Rechercher"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filtres"
          accessibilityState={{ expanded: historyFiltersExpanded }}
          hitSlop={8}
          onPress={() => {
            tapHaptic();
            setHistoryFiltersExpanded((expanded) => !expanded);
          }}
          style={styles.filterIconBtn}
        >
          <AppIcon
            family="ionicons"
            name={historyFiltersExpanded ? 'filter' : 'filter-outline'}
            size={20}
            color={historyTypeFilter !== 'all' ? colors.primary : colors.textMuted}
          />
        </Pressable>
      </View>
    ),
    [colors.containerBackground, colors.containerBorder, colors.primary, colors.text, colors.textMuted, historyFiltersExpanded, historyTypeFilter, search],
  );

  const historySearchToolbar = useMemo(
    () => (
      <View style={styles.historyToolbar}>
        {historySearchBar}
        {historyFiltersExpanded ? (
          <View style={styles.historyFilterWrap}>
            <SegmentedTabs
              tabs={HISTORY_FILTER_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
              active={historyTypeFilter}
              onChange={(id) => {
                tapHaptic();
                setHistoryTypeFilter(id);
              }}
              showDivider={false}
              trackBgColor="transparent"
              activeBgColor="rgba(255,255,255,0.07)"
              activeLabelColor="rgba(255,255,255,0.85)"
              inactiveLabelColor="rgba(255,255,255,0.28)"
            />
          </View>
        ) : null}
      </View>
    ),
    [colors.containerBackground, colors.containerBorder, colors.primary, colors.text, colors.textMuted, historyFiltersExpanded, historySearchBar, historyTypeFilter],
  );

  const historyScrollHeader = (
    <View
      style={[
        styles.pageHeroBlock,
        styles.pageHeroBlockListHeader,
        { paddingTop: insets.top + SCREEN_TOP_GUTTER },
      ]}
    >
      <View style={styles.topBar}>
        <Text style={[styles.title, { color: colors.text }]}>Transactions</Text>
        <Pressable onPress={() => router.push('/scan')} hitSlop={12} style={styles.scanIcon}>
          <AppIcon family="ionicons" name="scan-outline" size={22} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={[styles.tabsWrap, styles.tabsWrapHistory]}>
        <SegmentedTabs
          tabs={[
            { id: 'history', label: 'Historique' },
            { id: 'agenda', label: 'Agenda' },
            { id: 'merchants', label: 'Marchands' },
          ]}
          active={activeView}
          onChange={setCurrentView}
          showDivider={false}
        />
      </View>
    </View>
  );

  const historyEmptyState = (
    <DashboardCard padding={spacing.lg} innerStyle={styles.historyEmptyInner}>
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
          <Text style={[styles.historyEmptyCtaText, { color: colors.background }]}>Scanner un reçu</Text>
        </Pressable>
      ) : null}
    </DashboardCard>
  );

  const renderHistoryListItem = useCallback(
    ({ item }: { item: HistoryListItem }) => {
      if (item.kind === 'search') {
        return (
          <View style={[styles.historySearchSection, { backgroundColor: contentCanvas }]}>
            {historySearchToolbar}
          </View>
        );
      }

      return (
        <HistoryDayGroup
          date={item.date}
          txs={item.txs}
          accounts={simulatedAccounts}
          savingsGoals={savingsGoals}
          contactPhotoByKey={contactPhotoByKey}
          mutedColor={colors.textMuted}
          onPressTransaction={handlePressTransaction}
        />
      );
    },
    [
      colors.textMuted,
      contactPhotoByKey,
      contentCanvas,
      handlePressTransaction,
      historySearchToolbar,
      savingsGoals,
      simulatedAccounts,
    ],
  );

  const pageHeader = (
    <View style={[styles.pageHeroBlock, { paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
      <View style={styles.topBar}>
        <Text style={[styles.title, { color: colors.text }]}>Transactions</Text>
        <Pressable onPress={() => router.push('/scan')} hitSlop={12} style={styles.scanIcon}>
          <AppIcon family="ionicons" name="scan-outline" size={22} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={[styles.tabsWrap, activeView === 'history' && styles.tabsWrapHistory]}>
        <SegmentedTabs
          tabs={[
            { id: 'history', label: 'Historique' },
            { id: 'agenda', label: 'Agenda' },
            { id: 'merchants', label: 'Marchands' },
          ]}
          active={activeView}
          onChange={setCurrentView}
          showDivider={false}
        />
      </View>
    </View>
  );

  return (
    <PageTransition>
    <View style={[styles.screen, { backgroundColor: contentCanvas }]}>
      {activeView !== 'history' ? pageHeader : null}

      {activeView === 'history' ? (
        <View style={[styles.flex, { backgroundColor: contentCanvas }]} collapsable={false}>
          <FlatList
            ref={historyListRef}
            style={[styles.listViewport, { backgroundColor: contentCanvas }]}
            data={historyListData}
            keyExtractor={(item) => (item.kind === 'search' ? '__search__' : item.date)}
            extraData={`${deferredSearch}:${historyTypeFilter}:${simulatedAccounts.length}`}
            ListHeaderComponent={historyScrollHeader}
            initialNumToRender={8}
            maxToRenderPerBatch={6}
            windowSize={7}
            overScrollMode={Platform.OS === 'android' ? 'never' : 'auto'}
            removeClippedSubviews={Platform.OS === 'android'}
            contentContainerStyle={[
              styles.list,
              styles.listContentStretch,
              { backgroundColor: contentCanvas, paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING },
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
            ListFooterComponent={grouped.length === 0 ? historyEmptyState : null}
            renderItem={renderHistoryListItem}
          />
        </View>
      ) : null}

      {activeView === 'agenda' ? (
        <View style={[styles.agendaWrap, { backgroundColor: contentCanvas }]}>
          <AgendaView
            ref={agendaRef}
            onEditRecurring={(payment) => void openEditRecurringPayment(payment)}
          />
        </View>
      ) : null}

      {activeView === 'merchants' ? (
        <View style={[styles.flex, { backgroundColor: contentCanvas }]} collapsable={false}>
          <MerchantDirectory
            listRef={merchantsListRef}
            merchants={merchants}
            contacts={contacts}
            isEditing={isEditingMerchants}
            contentPaddingBottom={insets.bottom + FLOATING_NAV_CONTENT_PADDING}
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            onToggleEdit={() => setIsEditingMerchants((editing) => !editing)}
            onPressMerchant={(merchant) => {
              if (isEditingMerchants) {
                openMerchantEditor(merchant);
                return;
              }
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  title: {
    ...PAGE_TITLE_STYLE,
    flex: 1,
  },
  scanIcon: { padding: 4 },
  pageHeroBlock: {
    alignSelf: 'stretch',
    width: '100%',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  /** Inside history FlatList — horizontal inset comes from `styles.list` only. */
  pageHeroBlockListHeader: {
    paddingHorizontal: 0,
  },
  tabsWrap: {
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: PAGE_TITLE_CONTENT_GAP,
  },
  tabsWrapHistory: {
    marginBottom: spacing.md,
  },
  historyToolbar: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  historySearchSection: {
    marginBottom: spacing.lg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    borderRadius: radius.card,
    backgroundColor: colors.containerBackground,
    borderWidth: 1,
    borderColor: colors.containerBorder,
  },
  search: { flex: 1, color: colors.text, fontSize: typography.body, padding: 0 },
  filterIconBtn: {
    padding: 4,
    marginLeft: spacing.xs,
  },
  historyFilterWrap: {
    marginBottom: 0,
  },
  historyEmptyInner: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
    paddingVertical: spacing.lg,
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
  listContentStretch: {
    alignItems: 'stretch',
  },
  listViewport: { flex: 1 },
  emptyWrap: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  agendaWrap: {
    flex: 1,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  group: {
    marginBottom: spacing.xl,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: UNIFORM_SECTION_HEADER_MIN_HEIGHT,
    marginBottom: spacing.md,
  },
  groupLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textTransform: 'capitalize',
    flex: 1,
    minWidth: 0,
  },
  groupDayTotal: {
    ...listDayTotal,
  },
  groupTransactions: {
    gap: spacing.lg,
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
    borderRadius: 999,
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
    ...SECTION_TITLE_STYLE,
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

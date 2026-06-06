import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgendaView, type AgendaViewRef } from '@/components/AgendaView';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { IconFrame, LogoIconFrame } from '@/components/IconFrame';
import { MerchantLogo } from '@/components/MerchantLogo';
import { DashboardCard } from '@/components/DashboardCard';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import {
  createNewRecurringPaymentForm,
  RecurringPaymentFormModal,
  manualAccountOptions,
  saveRecurringPaymentForm,
  toAccountOptions,
  type PaymentForm,
} from '@/lib/recurringPaymentsForm';
import { PageTransition } from '@/components/PageTransition';
import { GlassContainer } from '@/components/GlassContainer';
import { TransactionRow } from '@/components/TransactionRow';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  colors,
  FLOATING_NAV_CONTENT_PADDING,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_CONTENT_GAP,
  PAGE_TITLE_STYLE,
  SECTION_TITLE_STYLE,
  PORTFOLIO_SECTION_GAP,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { listDayTotal, rowLabel, rowTitleTextProps, singleLineAmountProps } from '@/lib/textLayout';
import { getMerchantOverrides, getTransactions, sortTransactionsNewestFirst, upsertMerchantOverride, getCategories, getCategoryBudgets, getSimulatedAccounts } from '@/lib/db';
import { dataEvents, uiEvents } from '@/lib/events';
import { getMerchantLogoUrl, POPULAR_MERCHANT_LOGO_OPTIONS } from '@/lib/merchantLogo';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import {
  UNIFORM_ACTION_BUTTON_MIN_HEIGHT,
  UNIFORM_CHIP_FONT_SIZE,
  UNIFORM_ROW_MIN_HEIGHT,
  UNIFORM_SECTION_HEADER_MIN_HEIGHT,
  UNIFORM_SEGMENT_INNER_HEIGHT,
} from '@/lib/uniformGroupStyles';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import type { Category, CategoryBudget, MerchantOverride, Transaction } from '@/types';

type ViewTab = 'history' | 'agenda' | 'merchants';
type HistoryTypeFilter = 'all' | 'expense' | 'income';

type MerchantRow = {
  originalName: string;
  name: string;
  logoUrl?: string | null;
  count: number;
  total: number;
};

const MERCHANT_LOGO_SIZE = 36;

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

export default function TransactionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const contentCanvas = colors.background;
  const historyListRef = useRef<FlatList<[string, Transaction[]]>>(null);
  const merchantsListRef = useRef<FlatList<MerchantRow>>(null);
  const agendaRef = useRef<AgendaViewRef>(null);
  const hasBlurredRef = useRef(false);
  const [items, setItems] = useState<Transaction[]>([]);
  const [merchantOverrides, setMerchantOverrides] = useState<MerchantOverride[]>([]);
  const [search, setSearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<HistoryTypeFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<ViewTab>(params.view === 'agenda' ? 'agenda' : params.view === 'merchants' ? 'merchants' : 'history');
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [editingMerchant, setEditingMerchant] = useState<MerchantRow | null>(null);
  const [isEditingMerchants, setIsEditingMerchants] = useState(false);
  const [merchantNameDraft, setMerchantNameDraft] = useState('');
  const [selectedMerchantLogoUrl, setSelectedMerchantLogoUrl] = useState<string | null>(null);
  const [showMerchantLogoPicker, setShowMerchantLogoPicker] = useState(false);
  const [showMerchantDeleteConfirm, setShowMerchantDeleteConfirm] = useState(false);
  const [recurringForm, setRecurringForm] = useState<PaymentForm | null>(null);
  const [recurringAccounts, setRecurringAccounts] = useState(manualAccountOptions());
  const [recurringCategories, setRecurringCategories] = useState<Category[]>([]);
  const [recurringCategoryBudgets, setRecurringCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [recurringSaving, setRecurringSaving] = useState(false);
  const requestedView = getRequestedView(params.view);

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
    const [transactions, overrides] = await Promise.all([getTransactions(search), getMerchantOverrides()]);
    setItems(transactions);
    setMerchantOverrides(overrides);
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);

  const openNewRecurringPayment = useCallback(async () => {
    tapHaptic();
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
    setRecurringForm(createNewRecurringPaymentForm(accountOptions, categories));
  }, []);

  useEffect(() => uiEvents.subscribeNewRecurringPayment(() => {
    if (activeView !== 'agenda') return;
    void openNewRecurringPayment();
  }), [activeView, openNewRecurringPayment]);

  const saveRecurringPayment = async () => {
    if (!recurringForm) return;
    setRecurringSaving(true);
    const ok = await saveRecurringPaymentForm(recurringForm, recurringAccounts);
    setRecurringSaving(false);
    if (!ok) return;
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
    const map = new Map<string, { name: string; count: number; total: number }>();
    items.forEach((tx) => {
      if (tx.type === 'transfer' || tx.type === 'income') return;
      const cur = map.get(tx.label) ?? {
        name: tx.label,
        count: 0,
        total: 0,
      };
      cur.count += 1;
      cur.total += tx.amount;
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
          count: m.count,
          total: m.total,
        }];
      })
      .sort((a, b) => b.total - a.total);
  }, [items, merchantOverrideMap]);

  const editingOverride = editingMerchant ? merchantOverrideMap.get(editingMerchant.originalName) : undefined;
  const autoMerchantLogo = useMemo(() => getMerchantLogoUrl(merchantNameDraft), [merchantNameDraft]);
  const merchantPreviewLogo = selectedMerchantLogoUrl ?? autoMerchantLogo;

  const openMerchantEditor = (merchant: MerchantRow) => {
    const override = merchantOverrideMap.get(merchant.originalName);
    tapHaptic();
    setEditingMerchant(merchant);
    setMerchantNameDraft(override?.displayName?.trim() || merchant.name);
    setSelectedMerchantLogoUrl(override?.logoUrl ?? null);
    setShowMerchantLogoPicker(false);
    setShowMerchantDeleteConfirm(false);
  };

  const closeMerchantEditor = () => {
    setEditingMerchant(null);
    setMerchantNameDraft('');
    setSelectedMerchantLogoUrl(null);
    setShowMerchantLogoPicker(false);
    setShowMerchantDeleteConfirm(false);
  };

  const saveMerchantOverride = async () => {
    if (!editingMerchant) return;
    const displayName = merchantNameDraft.trim();
    if (!displayName) {
      Alert.alert('Nom requis', 'Entre un nom de marchand à afficher.');
      return;
    }

    await upsertMerchantOverride({
      originalName: editingMerchant.originalName,
      displayName: displayName === editingMerchant.originalName ? null : displayName,
      logoUrl: selectedMerchantLogoUrl,
      hidden: false,
      updatedAt: new Date().toISOString(),
    });
    successHaptic();
    closeMerchantEditor();
    await load();
  };

  const hideMerchant = async () => {
    if (!editingMerchant) return;
    await upsertMerchantOverride({
      originalName: editingMerchant.originalName,
      displayName: editingOverride?.displayName ?? null,
      logoUrl: editingOverride?.logoUrl ?? null,
      hidden: true,
      updatedAt: new Date().toISOString(),
    });
    successHaptic();
    closeMerchantEditor();
    await load();
  };

  const historyFilteredItems = useMemo(() => {
    if (historyTypeFilter === 'all') return items;
    return items.filter((tx) => tx.type === historyTypeFilter);
  }, [historyTypeFilter, items]);

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

  const pageHeader = (
    <View style={{ paddingTop: insets.top + SCREEN_TOP_GUTTER }}>
      <View style={styles.topBar}>
        <Text style={[styles.title, { color: colors.text }]}>Transactions</Text>
        <Pressable onPress={() => router.push('/scan')} hitSlop={12} style={styles.scanIcon}>
          <Ionicons name="scan-outline" size={22} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.tabsWrap}>
        <SegmentedTabs
          tabs={[
            { id: 'history', label: 'Historique' },
            { id: 'agenda', label: 'Agenda' },
            { id: 'merchants', label: 'Marchands' },
          ]}
          active={activeView}
          onChange={setCurrentView}
          showDivider={false}
          trackBgColor="#161616"
          activeBgColor="#2c2c2c"
          activeLabelColor="#ffffff"
          inactiveLabelColor="rgba(255,255,255,0.38)"
        />
      </View>
    </View>
  );

  return (
    <PageTransition>
    <View style={[styles.screen, { backgroundColor: contentCanvas }]}>
      {pageHeader}

      {activeView === 'history' ? (
        <View style={[styles.flex, { backgroundColor: contentCanvas }]} collapsable={false}>
          <FlatList
            ref={historyListRef}
            style={[styles.listViewport, { backgroundColor: contentCanvas }]}
            data={grouped}
            keyExtractor={([date]) => date}
            removeClippedSubviews
            ListHeaderComponent={
              <View>
                <View style={[styles.searchRow, { backgroundColor: colors.cardBackground }]}>
                  <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                  <TextInput
                    style={[styles.search, { color: colors.text }]}
                    placeholder="Rechercher"
                    placeholderTextColor={colors.textMuted}
                    value={search}
                    onChangeText={setSearch}
                    onSubmitEditing={() => void load()}
                  />
                </View>
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
              </View>
            }
            contentContainerStyle={[
              styles.list,
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
            ListEmptyComponent={
              <DashboardCard padding={spacing.lg} innerStyle={styles.historyEmptyInner}>
                <View style={[styles.historyEmptyIcon, { backgroundColor: colors.surfaceElevated }]}>
                  <Ionicons name="receipt-outline" size={22} color={colors.textMuted} />
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
                    <Ionicons name="scan-outline" size={16} color={colors.background} />
                    <Text style={[styles.historyEmptyCtaText, { color: colors.background }]}>Scanner un reçu</Text>
                  </Pressable>
                ) : null}
              </DashboardCard>
            }
            renderItem={({ item: [date, txs] }) => {
              return (
                <View style={styles.group}>
                  <View style={styles.groupHeaderRow}>
                    <Text style={[styles.groupLabel, { color: colors.textMuted }]}>
                      {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </Text>
                  </View>
                  <View style={styles.groupTransactions}>
                    {txs.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        transaction={tx}
                        onPress={() => setSelected(tx)}
                      />
                    ))}
                  </View>
                </View>
              );
            }}
          />
        </View>
      ) : null}

      {activeView === 'agenda' ? (
        <View style={[styles.agendaWrap, { backgroundColor: contentCanvas }]}>
          <AgendaView ref={agendaRef} />
        </View>
      ) : null}

      {activeView === 'merchants' ? (
        <View style={[styles.flex, { backgroundColor: contentCanvas }]} collapsable={false}>
          <FlatList
            ref={merchantsListRef}
            style={[styles.listViewport, { backgroundColor: contentCanvas }]}
            data={merchants}
            keyExtractor={(m) => m.originalName}
            removeClippedSubviews
            ListHeaderComponent={
              <View>
                <View style={styles.merchantToolbar}>
                  <Text style={[styles.merchantToolbarHint, { color: colors.textMuted }]} numberOfLines={2}>
                    {isEditingMerchants ? 'Touchez un marchand pour le modifier ou le retirer.' : `${merchants.length} marchand${merchants.length > 1 ? 's' : ''}`}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={isEditingMerchants ? "Terminer l'édition des marchands" : 'Modifier les marchands'}
                    style={({ pressed }) => [
                      styles.merchantEditModeButton,
                      {
                        backgroundColor: isEditingMerchants ? colors.text : colors.surfaceSolid,
                        borderColor: isEditingMerchants ? colors.text : colors.borderStrong,
                      },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      tapHaptic();
                      setIsEditingMerchants((editing) => !editing);
                    }}
                  >
                    <Ionicons
                      name={isEditingMerchants ? 'checkmark-outline' : 'pencil-outline'}
                      size={14}
                      color={isEditingMerchants ? colors.background : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.merchantEditModeText,
                        { color: isEditingMerchants ? colors.background : colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {isEditingMerchants ? 'Terminer' : 'Modifier'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            }
            contentContainerStyle={[
              styles.list,
              { backgroundColor: contentCanvas, paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING },
            ]}
            ItemSeparatorComponent={() => (
              <View style={[styles.merchantListSeparator, { backgroundColor: contentCanvas }]} />
            )}
            ListEmptyComponent={
              <View style={[styles.emptyWrap, { backgroundColor: contentCanvas }]}>
                <Text style={[styles.empty, { color: colors.textMuted }]}>Aucun marchand</Text>
              </View>
            }
            renderItem={({ item }) => {
              const editOutline = ['rgba(0,245,160,0.55)', 'rgba(0,245,160,0.18)', 'rgba(0,245,160,0.42)'] as const;
              return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isEditingMerchants
                    ? `Modifier ${item.name}`
                    : `Voir l'historique de ${item.name}`
                }
                android_ripple={null}
                onPress={() => {
                  if (isEditingMerchants) {
                    openMerchantEditor(item);
                    return;
                  }
                  tapHaptic();
                  router.push({ pathname: '/merchant-detail', params: { merchant: item.originalName } });
                }}
              >
                <GlassContainer
                  borderRadius={radius.card}
                  padding={spacing.md}
                  innerStyle={[styles.merchantRowInner, isEditingMerchants && styles.merchantRowEditing]}
                  outlineColors={isEditingMerchants ? editOutline : undefined}
                >
                <View style={styles.merchantLogoCol}>
                  <MerchantLogo name={item.name} logoUrl={item.logoUrl} />
                </View>
                <View style={styles.merchantLeft}>
                  <Text style={[styles.merchantName, { color: colors.text }]} {...rowTitleTextProps}>
                    {item.name}
                  </Text>
                  {isEditingMerchants ? (
                    <Text style={[styles.merchantMeta, { color: colors.textMuted }]}>
                      Touchez pour modifier
                    </Text>
                  ) : null}
                </View>
                <Ionicons
                  name={isEditingMerchants ? 'pencil-outline' : 'chevron-forward'}
                  size={16}
                  color={isEditingMerchants ? colors.primary : colors.textMuted}
                  style={styles.merchantChevron}
                />
                </GlassContainer>
              </Pressable>
            );
            }}
          />
        </View>
      ) : null}

      <Modal
        visible={Boolean(editingMerchant)}
        animationType="fade"
        transparent
        onRequestClose={showMerchantDeleteConfirm ? () => setShowMerchantDeleteConfirm(false) : closeMerchantEditor}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMerchantEditor} />
          <View
            style={[
              styles.merchantModalSheet,
              {
                backgroundColor: colors.surfaceSolid,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <View style={styles.modalTitleCopy}>
                <Text style={[styles.formTitle, { color: colors.text }]}>Modifier le marchand</Text>
                <Text style={[styles.formHint, { color: colors.textMuted }]} numberOfLines={2}>
                  Le changement s’applique seulement à la liste Marchands.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                style={({ pressed }) => [
                  styles.closeBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
                onPress={closeMerchantEditor}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalContent}
            >
              <View style={styles.formHead}>
                <View style={styles.logoPreviewWrap}>
                  {merchantPreviewLogo ? (
                    <LogoIconFrame uri={merchantPreviewLogo} size={52} />
                  ) : (
                    <IconFrame size={52}>
                      <Ionicons name="storefront-outline" size={22} color={colors.textMuted} />
                    </IconFrame>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Choisir un logo marchand"
                    style={({ pressed }) => [
                      styles.logoEditButton,
                      { backgroundColor: colors.surfaceSolid, borderColor: colors.border },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      tapHaptic();
                      setShowMerchantLogoPicker((visible) => !visible);
                    }}
                  >
                    <Ionicons name="pencil-outline" size={13} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <View style={styles.formHeadCopy}>
                  <Text style={[styles.formHint, { color: colors.textMuted }]}>
                    {selectedMerchantLogoUrl
                      ? 'Logo populaire sélectionné. Le nom peut rester personnalisé.'
                      : 'Automatique utilise le nom du marchand pour trouver le logo.'}
                  </Text>
                </View>
              </View>

              {showMerchantLogoPicker ? (
                <View style={styles.logoPickerGroup}>
                  <View style={styles.logoPickerTitleRow}>
                    <Text style={[styles.label, { color: colors.textMuted }]}>Logo</Text>
                    <Text style={[styles.logoPickerHint, { color: colors.textMuted }]}>Auto par défaut</Text>
                  </View>
                  <View style={styles.logoOptionRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Utiliser le logo automatique"
                      onPress={() => {
                        tapHaptic();
                        setSelectedMerchantLogoUrl(null);
                        setShowMerchantLogoPicker(false);
                      }}
                      style={[
                        styles.logoOption,
                        !selectedMerchantLogoUrl && styles.logoOptionActive,
                        { borderColor: !selectedMerchantLogoUrl ? colors.primary : colors.border },
                      ]}
                    >
                      {autoMerchantLogo ? (
                        <LogoIconFrame uri={autoMerchantLogo} size={34} />
                      ) : (
                        <IconFrame size={34}>
                          <Ionicons name="sparkles-outline" size={17} color={colors.textMuted} />
                        </IconFrame>
                      )}
                    </Pressable>

                    {POPULAR_MERCHANT_LOGO_OPTIONS.map((option) => {
                      const selectedLogo = selectedMerchantLogoUrl === option.logoUrl;
                      return (
                        <Pressable
                          key={option.id}
                          accessibilityRole="button"
                          accessibilityLabel="Choisir ce logo"
                          onPress={() => {
                            tapHaptic();
                            setSelectedMerchantLogoUrl(option.logoUrl);
                            setShowMerchantLogoPicker(false);
                          }}
                          style={[
                            styles.logoOption,
                            selectedLogo && styles.logoOptionActive,
                            { borderColor: selectedLogo ? colors.primary : colors.border },
                          ]}
                        >
                          {option.logoUrl ? (
                            <LogoIconFrame uri={option.logoUrl} size={34} />
                          ) : (
                            <IconFrame size={34}>
                              <Ionicons name="storefront-outline" size={17} color={colors.textMuted} />
                            </IconFrame>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Nom du marchand</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.surface, borderColor: colors.borderStrong, color: colors.text },
                  ]}
                  value={merchantNameDraft}
                  onChangeText={setMerchantNameDraft}
                  placeholder="IGA, Metro, Tim Hortons..."
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <Pressable style={[styles.saveBtn, { backgroundColor: colors.text }]} onPress={() => void saveMerchantOverride()}>
                <Text style={[styles.saveText, { color: colors.background }]}>Enregistrer</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.deleteBtn,
                  { backgroundColor: colors.dangerMuted, borderColor: colors.danger },
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  tapHaptic();
                  setShowMerchantDeleteConfirm(true);
                }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={[styles.deleteText, { color: colors.danger }]}>Supprimer de la liste</Text>
              </Pressable>
            </ScrollView>
          </View>
          {showMerchantDeleteConfirm && editingMerchant ? (
            <View style={styles.confirmOverlay}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Annuler le retrait du marchand"
                style={StyleSheet.absoluteFill}
                onPress={() => setShowMerchantDeleteConfirm(false)}
              />
              <GlassContainer style={styles.confirmCard} padding={spacing.lg} borderRadius={radius.card} innerStyle={styles.confirmCardInner}>
                <View style={[styles.confirmIcon, { backgroundColor: colors.dangerMuted }]}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </View>
                <Text style={[styles.confirmTitle, { color: colors.text }]}>Retirer ce marchand ?</Text>
                <Text style={[styles.confirmMessage, { color: colors.textMuted }]}>
                  {editingMerchant.name} sera retiré de la liste Marchands. Les transactions existantes restent conservées.
                </Text>
                <View style={styles.confirmActions}>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.confirmSecondaryButton,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setShowMerchantDeleteConfirm(false)}
                  >
                    <Text style={[styles.confirmSecondaryText, { color: colors.textSecondary }]}>Annuler</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.confirmDestructiveButton,
                      { backgroundColor: colors.danger, borderColor: colors.danger },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => void hideMerchant()}
                  >
                    <Text style={[styles.confirmDestructiveText, { color: colors.background }]}>Retirer</Text>
                  </Pressable>
                </View>
              </GlassContainer>
            </View>
          ) : null}
        </View>
      </Modal>
      <TransactionDetailSheet transaction={selected} onClose={() => setSelected(null)} onDeleted={() => { void load(); }} />
      <RecurringPaymentFormModal
        visible={recurringForm != null}
        form={recurringForm}
        accounts={recurringAccounts}
        categories={recurringCategories}
        categoryBudgets={recurringCategoryBudgets}
        saving={recurringSaving}
        bottomInset={insets.bottom}
        onClose={() => setRecurringForm(null)}
        onChange={setRecurringForm}
        onSave={() => void saveRecurringPayment()}
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
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  title: {
    ...PAGE_TITLE_STYLE,
    flex: 1,
  },
  scanIcon: { padding: 4 },
  tabsWrap: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginBottom: PAGE_TITLE_CONTENT_GAP,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    borderRadius: radius.card,
    backgroundColor: colors.cardBackground,
  },
  search: { flex: 1, color: colors.text, fontSize: typography.body, padding: 0 },
  historyFilterWrap: {
    marginBottom: spacing.xl,
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
    marginBottom: spacing.xxl,
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
  merchantToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  merchantToolbarHint: {
    flex: 1,
    color: colors.textMuted,
    fontSize: typography.meta,
    lineHeight: 17,
  },
  merchantEditModeButton: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    minHeight: UNIFORM_SEGMENT_INNER_HEIGHT,
  },
  merchantEditModeText: {
    fontSize: UNIFORM_CHIP_FONT_SIZE,
    fontWeight: '800',
  },
  merchantListSeparator: {
    height: PORTFOLIO_SECTION_GAP,
  },
  merchantRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: UNIFORM_ROW_MIN_HEIGHT,
  },
  merchantRowEditing: {},
  merchantRowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  merchantChevron: { opacity: 0.5, marginLeft: spacing.xs },
  merchantLogoCol: {
    minWidth: MERCHANT_LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  merchantLeft: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  merchantName: {
    ...rowLabel,
    fontWeight: '800',
  },
  merchantMeta: {
    color: colors.textMuted,
    fontSize: typography.meta,
    marginTop: 2,
    flexShrink: 1,
  },
  pressed: { opacity: 0.78 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
  },
  merchantModalSheet: {
    maxHeight: '86%',
    backgroundColor: colors.surfaceSolid,
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
    width: 34,
    height: 34,
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
    backgroundColor: colors.surfaceSolid,
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
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
  },
  deleteText: {
    fontSize: typography.body,
    fontWeight: '800',
  },
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

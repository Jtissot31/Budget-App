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
import { IconFrame, LogoIconFrame } from '@/components/IconFrame';
import { MerchantLogo } from '@/components/MerchantLogo';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import { GlassContainer } from '@/components/GlassContainer';
import { TransactionRow } from '@/components/TransactionRow';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { colors, FLOATING_NAV_CONTENT_PADDING, PAGE_TITLE_CONTENT_GAP, radius, spacing, typography } from '@/constants/theme';
import { getMerchantOverrides, getTransactions, sortTransactionsNewestFirst, upsertMerchantOverride } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { getMerchantLogoUrl, POPULAR_MERCHANT_LOGO_OPTIONS } from '@/lib/merchantLogo';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import type { MerchantOverride, Transaction } from '@/types';

type ViewTab = 'history' | 'agenda' | 'merchants';

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

export default function TransactionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const historyListRef = useRef<FlatList<[string, Transaction[]]>>(null);
  const merchantsListRef = useRef<FlatList<MerchantRow>>(null);
  const agendaRef = useRef<AgendaViewRef>(null);
  const hasBlurredRef = useRef(false);
  const [items, setItems] = useState<Transaction[]>([]);
  const [merchantOverrides, setMerchantOverrides] = useState<MerchantOverride[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<ViewTab>(params.view === 'agenda' ? 'agenda' : params.view === 'merchants' ? 'merchants' : 'history');
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [editingMerchant, setEditingMerchant] = useState<MerchantRow | null>(null);
  const [isEditingMerchants, setIsEditingMerchants] = useState(false);
  const [merchantNameDraft, setMerchantNameDraft] = useState('');
  const [selectedMerchantLogoUrl, setSelectedMerchantLogoUrl] = useState<string | null>(null);
  const [showMerchantLogoPicker, setShowMerchantLogoPicker] = useState(false);
  const [showMerchantDeleteConfirm, setShowMerchantDeleteConfirm] = useState(false);
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

  useRefreshOnFocus(load);
  useEffect(() => {
    if (requestedView && requestedView !== activeView) {
      setActiveView(requestedView);
    }
  }, [activeView, requestedView]);

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
      const cur = map.get(tx.label) ?? {
        name: tx.label,
        count: 0,
        total: 0,
      };
      cur.count += 1;
      cur.total += tx.type === 'expense' ? tx.amount : 0;
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

  const grouped = useMemo(() => {
    const g: Record<string, Transaction[]> = {};
    items.forEach((tx) => {
      const key = getLocalDayKey(tx.date);
      if (!g[key]) g[key] = [];
      g[key].push(tx);
    });
    return Object.entries(g)
      .map(([day, txs]) => [day, sortTransactionsNewestFirst(txs)] as [string, Transaction[]])
      .sort(([a], [b]) => b.localeCompare(a));
  }, [items]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
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
        />
      </View>

      {activeView === 'history' ? (
        <View style={styles.flex}>
          <View style={[styles.searchRow, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
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
      <FlatList
            ref={historyListRef}
            data={grouped}
            keyExtractor={([date]) => date}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING }]}
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
            ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>Aucune transaction</Text>}
            renderItem={({ item: [date, txs] }) => (
              <View style={styles.group}>
                <Text style={[styles.groupLabel, { color: colors.textMuted }]}>
                  {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </Text>
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
            )}
          />
        </View>
      ) : null}

      {activeView === 'agenda' ? (
        <View style={styles.agendaWrap}>
          <AgendaView ref={agendaRef} />
        </View>
      ) : null}

      {activeView === 'merchants' ? (
        <View style={styles.flex}>
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
          <FlatList
            ref={merchantsListRef}
            style={styles.flex}
            data={merchants}
            keyExtractor={(m) => m.originalName}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING }]}
            ItemSeparatorComponent={() => <View style={styles.merchantListSeparator} />}
            ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>Aucun marchand</Text>}
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
                  borderRadius={radius.lg}
                  padding={spacing.md}
                  innerStyle={[styles.merchantRowInner, isEditingMerchants && styles.merchantRowEditing]}
                  outlineColors={isEditingMerchants ? editOutline : undefined}
                >
                <View style={styles.merchantLogoCol}>
                  <MerchantLogo name={item.name} logoUrl={item.logoUrl} />
                </View>
                <View style={styles.merchantLeft}>
                  <Text style={[styles.merchantName, { color: colors.text }]} numberOfLines={2} ellipsizeMode="tail">
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
              <GlassContainer style={styles.confirmCard} padding={spacing.lg} borderRadius={28} innerStyle={styles.confirmCardInner}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: PAGE_TITLE_CONTENT_GAP,
  },
  title: {
    color: colors.text,
    fontSize: typography.screenTitle,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  scanIcon: { padding: 4 },
  tabsWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: PAGE_TITLE_CONTENT_GAP,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surfaceSolid,
  },
  search: { flex: 1, color: colors.text, fontSize: typography.body, padding: 0 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: FLOATING_NAV_CONTENT_PADDING },
  agendaWrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: FLOATING_NAV_CONTENT_PADDING,
  },
  group: {
    marginBottom: spacing.xl,
  },
  groupLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    marginBottom: spacing.sm,
    textTransform: 'capitalize',
  },
  groupTransactions: {
    gap: spacing.sm,
  },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 48, fontSize: typography.caption },
  merchantToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
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
  },
  merchantEditModeText: {
    fontSize: typography.micro,
    fontWeight: '800',
  },
  merchantListSeparator: {
    height: spacing.sm,
  },
  merchantRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '500',
    flexShrink: 1,
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
    backgroundColor: colors.cyanMuted,
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.34,
    shadowRadius: 24,
    elevation: 12,
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
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
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
    gap: spacing.sm,
    width: '100%',
    marginTop: spacing.lg,
  },
  confirmSecondaryButton: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  confirmDestructiveButton: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
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

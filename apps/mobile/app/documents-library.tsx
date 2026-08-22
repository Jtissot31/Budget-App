/**
 * Bibliothèque de documents — Reçus (transactions), Contrats, Talons de paie.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { MonthRangePicker } from '@/components/MonthRangePicker';
import { PageTransition } from '@/components/PageTransition';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import {
  ProtoActiveFilterChip,
  ProtoSearchField,
  ProtoToolbarIconButton,
} from '@/components/proto/ProtoSearchToolbar';
import {
  SettingsPickerSheet,
  type SettingsPickerOption,
} from '@/components/SettingsPickerSheet';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { ThemedConfirmModal } from '@/components/ThemedConfirmModal';
import { TransactionAvatar } from '@/components/TransactionAvatar';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  FLOATING_NAV_CONTENT_PADDING,
  jakartaMediumText,
  PAGE_TITLE_STYLE,
  radius,
  screenHorizontalGutter,
  spacing,
  typography,
  typographyKit,
} from '@/constants/theme';
import { homeAlertPreviewSurface } from '@/lib/alertPresentation';
import {
  addLibraryDocument,
  attachReceiptToTransaction,
  collectReceiptAttachCandidates,
  collectReceiptMerchantGroups,
  getLibraryDocuments,
  isPreviewableDocumentUri,
  libraryDocumentMatchesSearch,
  receiptMerchantMatchesSearch,
  removeLibraryDocument,
  transactionHasRegisteredReceipt,
  type DocumentKind,
  type LibraryDocument,
  type ReceiptMerchantGroup,
} from '@/lib/documentsLibrary';
import { getTransactions } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { ensureDbReady } from '@/lib/init';
import { getMerchantLogoUrls } from '@/lib/merchantLogo';
import {
  filterByMonthRange,
  formatMonthRangeLabel,
  type MonthRangeFilter,
} from '@/lib/monthRangeFilter';
import { captureReceiptPhoto, pickReceiptFromGallery } from '@/lib/receiptCapture';
import { SHEET_DISMISS_ANIMATION_MS } from '@/lib/sheet/useDraggableSheetGesture';
import {
  resolveUserPickedIconWellBackground,
  userPickedIconCornerRadius,
} from '@/lib/userPickedIcon';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import { UNIFORM_ACTION_BUTTON_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import type { Transaction } from '@/types';

type TabId = DocumentKind;

const TABS: { id: TabId; label: string }[] = [
  { id: 'receipt', label: 'Reçus' },
  { id: 'contract', label: 'Contrats' },
  { id: 'paystub', label: 'Talons de paie' },
];

const EMPTY_ICON_WELL = 44;

type ReceiptSourceId = 'camera' | 'gallery' | 'scan';

const RECEIPT_SOURCE_OPTIONS: SettingsPickerOption<string>[] = [
  {
    id: 'camera',
    label: 'Prendre une photo',
    description: 'Ouvre la caméra pour photographier le reçu',
    icon: 'camera-outline',
  },
  {
    id: 'gallery',
    label: 'Importer depuis la galerie',
    description: 'Choisis une image déjà sur ton téléphone',
    icon: 'images-outline',
  },
  {
    id: 'scan',
    label: 'Scanner (nouvelle transaction)',
    description: 'Analyse le reçu et crée la transaction',
    icon: 'scan-outline',
  },
];

function formatDate(isoDate: string) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function emptyCopy(tab: TabId): { title: string; hint: string } {
  if (tab === 'receipt') {
    return {
      title: 'Aucun reçu',
      hint: 'Enregistre un reçu ici et associe-le à une transaction pour le retrouver facilement.',
    };
  }
  if (tab === 'contract') {
    return {
      title: 'Aucun contrat',
      hint: 'Ajoute un contrat (bail, assurance, abonnement…) pour le retrouver facilement.',
    };
  }
  return {
    title: 'Aucun talon de paie',
    hint: 'Ajoute un talon de paie pour suivre tes revenus et les retrouver plus tard.',
  };
}

function searchPlaceholder(tab: TabId): string {
  if (tab === 'receipt') return 'Rechercher un marchand';
  if (tab === 'contract') return 'Rechercher un contrat';
  return 'Rechercher un talon';
}

function emptyIconName(tab: TabId): 'receipt-outline' | 'document-text-outline' | 'wallet-outline' {
  if (tab === 'receipt') return 'receipt-outline';
  if (tab === 'contract') return 'document-text-outline';
  return 'wallet-outline';
}

function emptyCtaLabel(tab: TabId): string {
  if (tab === 'receipt') return 'Enregistrer un reçu';
  if (tab === 'contract') return 'Ajouter un contrat';
  return 'Ajouter un talon';
}

export default function DocumentsLibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const contentGutter = Platform.OS === 'web' ? 0 : screenHorizontalGutter(insets);
  const elevatedSurface = homeAlertPreviewSurface(colors, isLight);
  const iconWellBg = resolveUserPickedIconWellBackground(isLight);

  const [tab, setTab] = useState<TabId>('receipt');
  const [receiptTransactions, setReceiptTransactions] = useState<Transaction[]>([]);
  const [contracts, setContracts] = useState<LibraryDocument[]>([]);
  const [paystubs, setPaystubs] = useState<LibraryDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState<MonthRangeFilter | null>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [attachCandidates, setAttachCandidates] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftUri, setDraftUri] = useState<string | null>(null);
  const [pendingReceiptUri, setPendingReceiptUri] = useState<string | null>(null);
  const [txPickerVisible, setTxPickerVisible] = useState(false);
  const [receiptSourceVisible, setReceiptSourceVisible] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [noCandidatesVisible, setNoCandidatesVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const sheetCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (sheetCloseTimer.current) clearTimeout(sheetCloseTimer.current);
    },
    [],
  );

  /**
   * Android swallows a camera / gallery intent launched while a modal sheet is
   * still animating out — wait for the dismiss before handing off.
   */
  const runAfterSheetClose = useCallback((action: () => void) => {
    if (sheetCloseTimer.current) clearTimeout(sheetCloseTimer.current);
    sheetCloseTimer.current = setTimeout(action, SHEET_DISMISS_ANIMATION_MS);
  }, []);

  const load = useCallback(async () => {
    await ensureDbReady();
    const [txs, contractDocs, paystubDocs] = await Promise.all([
      getTransactions(),
      getLibraryDocuments('contract'),
      getLibraryDocuments('paystub'),
    ]);
    setReceiptTransactions(txs.filter(transactionHasRegisteredReceipt));
    setAttachCandidates(collectReceiptAttachCandidates(txs));
    setContracts(contractDocs);
    setPaystubs(paystubDocs);
  }, []);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => {
      void load();
    });
  }, [load]);

  useRefreshOnFocus(load);

  /**
   * Reçus: receipts → month filter → merchant grouping → search filter.
   * The month filter runs before grouping so counts and latest date match the range.
   */
  const visibleReceiptMerchants = useMemo(() => {
    const query = searchQuery.trim();
    const monthScoped = filterByMonthRange(receiptTransactions, monthFilter);
    return collectReceiptMerchantGroups(monthScoped).filter((group) =>
      receiptMerchantMatchesSearch(group, query),
    );
  }, [monthFilter, receiptTransactions, searchQuery]);

  /** Contrats / Talons: stored documents → month filter → search filter. */
  const visibleDocuments = useMemo(() => {
    const query = searchQuery.trim();
    const docs = tab === 'contract' ? contracts : paystubs;
    return filterByMonthRange(docs, monthFilter).filter((doc) =>
      libraryDocumentMatchesSearch(doc, query),
    );
  }, [contracts, monthFilter, paystubs, searchQuery, tab]);

  const listData = tab === 'receipt' ? visibleReceiptMerchants : visibleDocuments;

  const hasActiveFilter = searchQuery.trim().length > 0 || monthFilter !== null;
  const empty = emptyCopy(tab);

  const openMonthPicker = useCallback(() => {
    tapHaptic();
    setMonthPickerOpen(true);
  }, []);

  const clearMonthFilter = useCallback(() => {
    tapHaptic();
    setMonthFilter(null);
  }, []);

  const txPickerOptions = useMemo<SettingsPickerOption<string>[]>(
    () =>
      attachCandidates.map((tx) => {
        const hasReceipt = transactionHasRegisteredReceipt(tx);
        const logo = getMerchantLogoUrls(tx.label)[0] ?? null;
        return {
          id: tx.id,
          label: tx.label,
          description: [
            formatDate(tx.date),
            formatDisplayMoneyAbsolute(tx.amount),
            hasReceipt ? 'Remplacera le reçu actuel' : null,
          ]
            .filter(Boolean)
            .join(' · '),
          icon: hasReceipt ? 'receipt' : 'receipt-outline',
          logoUrl: logo,
        };
      }),
    [attachCandidates],
  );

  const openTransactionPicker = useCallback(
    (uri: string) => {
      if (attachCandidates.length === 0) {
        setNoCandidatesVisible(true);
        return;
      }
      setPendingReceiptUri(uri);
      setTxPickerVisible(true);
    },
    [attachCandidates.length],
  );

  const captureThenAttach = useCallback(
    async (source: 'camera' | 'gallery') => {
      try {
        setBusy(true);
        const result =
          source === 'gallery' ? await pickReceiptFromGallery() : await captureReceiptPhoto();
        if (result.cancelled || !result.uri) return;
        openTransactionPicker(result.uri);
      } catch (err) {
        setNoticeMessage(
          err instanceof Error
            ? err.message
            : source === 'camera'
              ? 'Impossible d’ouvrir la caméra.'
              : 'Impossible d’ouvrir la galerie.',
        );
      } finally {
        setBusy(false);
      }
    },
    [openTransactionPicker],
  );

  const startAddReceipt = useCallback(() => {
    tapHaptic();
    setReceiptSourceVisible(true);
  }, []);

  const handleReceiptSource = useCallback(
    (id: string) => {
      const source = id as ReceiptSourceId;
      if (source === 'scan') {
        router.push('/scan');
        return;
      }
      void captureThenAttach(source);
    },
    [captureThenAttach, router],
  );

  const pickStoredDocUri = useCallback(async (source: 'gallery' | 'file') => {
    try {
      if (source === 'gallery') {
        const result = await pickReceiptFromGallery();
        if (result.cancelled || !result.uri) return null;
        return result.uri;
      }
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return null;
      return result.assets[0]?.uri ?? null;
    } catch (err) {
      Alert.alert(
        'Permission requise',
        err instanceof Error ? err.message : 'Impossible d’accéder au fichier.',
      );
      return null;
    }
  }, []);

  const startAddStoredDoc = useCallback(() => {
    tapHaptic();
    Alert.alert(
      tab === 'contract' ? 'Ajouter un contrat' : 'Ajouter un talon de paie',
      'Tu peux joindre une photo ou un PDF (optionnel).',
      [
        {
          text: 'Galerie',
          onPress: () => {
            void pickStoredDocUri('gallery').then((uri) => {
              setDraftUri(uri);
              setAdding(true);
            });
          },
        },
        {
          text: 'Fichier (PDF / image)',
          onPress: () => {
            void pickStoredDocUri('file').then((uri) => {
              setDraftUri(uri);
              setAdding(true);
            });
          },
        },
        {
          text: 'Sans fichier',
          onPress: () => {
            setDraftUri(null);
            setAdding(true);
          },
        },
        { text: 'Annuler', style: 'cancel' },
      ],
    );
  }, [pickStoredDocUri, tab]);

  const handleAddStored = useCallback(async () => {
    if (tab === 'receipt') return;
    const title = draftTitle.trim();
    if (!title) {
      Alert.alert('Titre requis', 'Entre un nom pour ce document.');
      return;
    }
    tapHaptic();
    await addLibraryDocument({
      kind: tab,
      title,
      date: new Date().toISOString(),
      uri: draftUri,
    });
    setDraftTitle('');
    setDraftUri(null);
    setAdding(false);
    await load();
  }, [draftTitle, draftUri, load, tab]);

  const handleSelectTransaction = useCallback(
    async (transactionId: string) => {
      const uri = pendingReceiptUri?.trim();
      if (!uri) return;
      const tx = attachCandidates.find((item) => item.id === transactionId);
      if (!tx) return;
      try {
        setBusy(true);
        await attachReceiptToTransaction(tx, uri);
        successHaptic();
        setPendingReceiptUri(null);
        setTxPickerVisible(false);
        await load();
      } catch {
        Alert.alert('Erreur', 'Impossible de joindre le reçu à cette transaction.');
      } finally {
        setBusy(false);
      }
    },
    [attachCandidates, load, pendingReceiptUri],
  );

  const openReceiptMerchant = useCallback(
    (item: ReceiptMerchantGroup) => {
      tapHaptic();
      router.push({
        pathname: '/merchant-receipts',
        params: { merchant: item.merchantLabel },
      });
    },
    [router],
  );

  const renderReceiptMerchant = useCallback(
    ({ item }: { item: ReceiptMerchantGroup }) => {
      const countLabel =
        item.receiptCount === 1 ? '1 reçu' : `${item.receiptCount} reçus`;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Reçus ${item.merchantLabel}`}
          onPress={() => openReceiptMerchant(item)}
          style={({ pressed }) => [styles.rowPress, pressed && styles.pressed]}
        >
          <ProtoGlassCard padding={12} style={styles.rowCard}>
            <View style={styles.rowInner}>
              <TransactionAvatar transaction={item.latestTransaction} size={44} />
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.merchantLabel}
                </Text>
                <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                  {countLabel} · {formatDate(item.latestDate)}
                </Text>
              </View>
              <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          </ProtoGlassCard>
        </Pressable>
      );
    },
    [colors.text, colors.textMuted, openReceiptMerchant],
  );

  const renderStoredDoc = useCallback(
    ({ item }: { item: LibraryDocument }) => {
      const iconName = item.kind === 'contract' ? 'document-text-outline' : 'wallet-outline';
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.title}
          onLongPress={() => {
            tapHaptic();
            Alert.alert('Supprimer ce document ?', item.title, [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Supprimer',
                style: 'destructive',
                onPress: () => {
                  void removeLibraryDocument(item.id).then(load);
                },
              },
            ]);
          }}
          style={({ pressed }) => [styles.rowPress, pressed && styles.pressed]}
        >
          <ProtoGlassCard padding={12} style={styles.rowCard}>
            <View style={styles.rowInner}>
              <View
                style={[
                  styles.thumb,
                  {
                    backgroundColor: iconWellBg,
                    borderColor: colors.containerBorder,
                    borderRadius: userPickedIconCornerRadius(44),
                  },
                ]}
              >
                {isPreviewableDocumentUri(item.uri) ? (
                  <Image
                    source={{ uri: item.uri ?? '' }}
                    style={styles.thumbImage}
                    contentFit="cover"
                  />
                ) : (
                  <AppIcon family="ionicons" name={iconName} size={20} color={colors.textMuted} />
                )}
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                  {formatDate(item.date)}
                  {item.note ? ` · ${item.note}` : ''}
                </Text>
              </View>
              <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          </ProtoGlassCard>
        </Pressable>
      );
    },
    [colors.containerBorder, colors.text, colors.textMuted, iconWellBg, load],
  );

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + SCREEN_TOP_GUTTER,
              paddingHorizontal: contentGutter,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={() => {
              tapHaptic();
              router.back();
            }}
            style={({ pressed }) => [styles.backHit, pressed && styles.pressed]}
          >
            <AppIcon family="ionicons" name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            Documents
          </Text>
        </View>

        <View style={[styles.tabsWrap, { paddingHorizontal: contentGutter }]}>
          <SegmentedTabs
            tabs={TABS}
            active={tab}
            onChange={(id) => {
              tapHaptic();
              setTab(id);
              setAdding(false);
              setDraftTitle('');
              setDraftUri(null);
            }}
            size="section"
            variant="section"
            showDivider={false}
          />
        </View>

        <View style={[styles.toolbar, { paddingHorizontal: contentGutter }]}>
          <View style={styles.toolbarRow}>
            <ProtoSearchField
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={searchPlaceholder(tab)}
              accessibilityLabel={searchPlaceholder(tab)}
            />
            <ProtoToolbarIconButton
              icon={monthFilter ? 'calendar' : 'calendar-outline'}
              active={monthFilter !== null}
              onPress={openMonthPicker}
              accessibilityLabel="Filtrer par mois"
            />
          </View>
          {monthFilter ? (
            <ProtoActiveFilterChip
              icon="calendar"
              label={formatMonthRangeLabel(monthFilter)}
              onPress={openMonthPicker}
              onClear={clearMonthFilter}
              accessibilityLabel={`Mois filtré : ${formatMonthRangeLabel(monthFilter)}. Modifier`}
              clearAccessibilityLabel="Effacer le filtre de mois"
            />
          ) : null}
        </View>

        {adding && tab !== 'receipt' ? (
          <View style={[styles.addBar, { paddingHorizontal: contentGutter }]}>
            <ProtoGlassCard padding={12} style={[styles.addCard, elevatedSurface]}>
              <View style={styles.addFields}>
                <TextInput
                  style={[styles.addInput, { color: colors.text }]}
                  placeholder={tab === 'contract' ? 'Nom du contrat' : 'Employeur ou période'}
                  placeholderTextColor={colors.textMuted}
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                  returnKeyType="done"
                  onSubmitEditing={() => void handleAddStored()}
                  autoFocus
                />
                {draftUri ? (
                  <Text style={[styles.addUriHint, { color: colors.textMuted }]} numberOfLines={1}>
                    Fichier joint
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enregistrer"
                onPress={() => void handleAddStored()}
                style={({ pressed }) => [
                  styles.addSave,
                  { backgroundColor: colors.accentGreen },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.addSaveText, { color: colors.background }]}>Ajouter</Text>
              </Pressable>
            </ProtoGlassCard>
          </View>
        ) : null}

        <FlatList
          data={listData as Array<ReceiptMerchantGroup | LibraryDocument>}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.listContent,
            {
              paddingHorizontal: contentGutter,
              paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING,
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
            <ProtoGlassCard style={[styles.emptyCard, elevatedSurface]} padding={14}>
              <View style={styles.emptyInner}>
                <View
                  style={[
                    styles.emptyIcon,
                    {
                      backgroundColor: iconWellBg,
                      borderRadius: userPickedIconCornerRadius(EMPTY_ICON_WELL),
                    },
                  ]}
                >
                  <AppIcon
                    family="ionicons"
                    name={hasActiveFilter ? 'search-outline' : emptyIconName(tab)}
                    size={20}
                    color={colors.textMuted}
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {hasActiveFilter ? 'Aucun résultat' : empty.title}
                </Text>
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                  {hasActiveFilter
                    ? 'Essaie une autre recherche ou un autre mois.'
                    : empty.hint}
                </Text>
                {hasActiveFilter ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={emptyCtaLabel(tab)}
                    disabled={busy}
                    onPress={() => {
                      if (tab === 'receipt') {
                        startAddReceipt();
                        return;
                      }
                      startAddStoredDoc();
                    }}
                    style={({ pressed }) => [
                      styles.emptyCta,
                      { backgroundColor: colors.accentGreen },
                      pressed && styles.pressed,
                    ]}
                  >
                    <AppIcon family="ionicons" name="add" size={16} color={colors.background} />
                    <Text style={[styles.emptyCtaText, { color: colors.background }]}>
                      {emptyCtaLabel(tab)}
                    </Text>
                  </Pressable>
                )}
              </View>
            </ProtoGlassCard>
          }
          renderItem={({ item }) =>
            item.kind === 'receipt_merchant'
              ? renderReceiptMerchant({ item })
              : renderStoredDoc({ item })
          }
        />

        <MonthRangePicker
          visible={monthPickerOpen}
          value={monthFilter}
          onCancel={() => setMonthPickerOpen(false)}
          onConfirm={(value) => {
            setMonthFilter(value);
            setMonthPickerOpen(false);
          }}
        />

        <SettingsPickerSheet
          visible={receiptSourceVisible}
          title="Enregistrer un reçu"
          options={RECEIPT_SOURCE_OPTIONS}
          selectedId=""
          onClose={() => setReceiptSourceVisible(false)}
          onSelect={(id) => {
            setReceiptSourceVisible(false);
            runAfterSheetClose(() => handleReceiptSource(id));
          }}
        />

        <SettingsPickerSheet
          visible={txPickerVisible}
          title="Joindre à une transaction"
          options={txPickerOptions}
          selectedId=""
          onClose={() => {
            setTxPickerVisible(false);
            setPendingReceiptUri(null);
          }}
          onSelect={(id) => {
            void handleSelectTransaction(id);
          }}
        />

        <ThemedConfirmModal
          visible={noticeMessage !== null}
          title="Permission requise"
          message={noticeMessage ?? ''}
          variant="warning"
          confirmLabel="OK"
          onConfirm={() => setNoticeMessage(null)}
          onCancel={() => setNoticeMessage(null)}
        />

        <ThemedConfirmModal
          visible={noCandidatesVisible}
          title="Aucune dépense"
          message="Crée une transaction pour y joindre ce reçu, ou scanne un nouveau reçu."
          variant="info"
          confirmLabel="Scanner / créer"
          cancelLabel="Annuler"
          onConfirm={() => {
            setNoCandidatesVisible(false);
            router.push('/scan');
          }}
          onCancel={() => setNoCandidatesVisible(false)}
        />
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  backHit: {
    padding: spacing.xs,
    flexShrink: 0,
  },
  title: {
    flex: 1,
    ...PAGE_TITLE_STYLE,
    fontSize: 28,
    lineHeight: 36,
    minWidth: 0,
  },
  tabsWrap: {
    marginBottom: spacing.md,
  },
  toolbar: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addBar: {
    marginBottom: spacing.md,
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addFields: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  addInput: {
    ...jakartaMediumText,
    fontSize: typography.body,
    padding: 0,
    minWidth: 0,
  },
  addUriHint: {
    ...typographyKit.micro,
    fontSize: 11,
    lineHeight: 14,
  },
  addSave: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addSaveText: {
    ...typographyKit.metaSemibold,
    fontSize: 13,
  },
  listContent: {
    gap: spacing.sm,
    flexGrow: 1,
  },
  rowPress: {},
  rowCard: {},
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thumb: {
    width: 44,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    ...typographyKit.rowTitle,
    fontSize: 14,
    lineHeight: 18,
  },
  rowMeta: {
    ...typographyKit.micro,
    fontSize: 11,
    lineHeight: 14,
  },
  emptyCard: {
    marginTop: spacing.xxl,
  },
  emptyInner: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  emptyIcon: {
    width: EMPTY_ICON_WELL,
    height: EMPTY_ICON_WELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...typographyKit.metaSemibold,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyHint: {
    ...typographyKit.metaMedium,
    fontSize: 13,
    lineHeight: 18,
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
    marginTop: spacing.xs,
    minHeight: UNIFORM_ACTION_BUTTON_MIN_HEIGHT,
  },
  emptyCtaText: {
    ...typographyKit.metaSemibold,
    fontSize: 14,
  },
  pressed: { opacity: 0.78 },
});

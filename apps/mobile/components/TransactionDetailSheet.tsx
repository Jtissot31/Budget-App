import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import {
  ItemizedArticlesEditor,
  itemizedRowsToNotePayload,
  type ItemizedRow,
} from '@/components/ItemizedArticlesEditor';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ReceiptCaptureActions } from '@/components/ReceiptCaptureActions';
import { SurfaceCard } from '@/components/SurfaceCard';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { TransactionAiInsightCard } from '@/components/TransactionAiInsightCard';
import { TransactionAvatar } from '@/components/TransactionAvatar';
import { getCategoryIconName } from '@/constants/categoryOptions';
import {
  destructiveIconColor,
  destructiveTextActionStyle,
  radius,
  spacing,
  subtleDeleteButtonStyle,
  type AppColors,
} from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
import { listRowTitle, rowTitleTextProps, rowValue, singleLineAmountProps } from '@/lib/textLayout';
import { useSimulatedAccounts } from '@/hooks/useSimulatedAccounts';
import {
  getReceiptStatusLabel,
  getTransactionPaymentMethodFieldLabel,
  getTransactionTypeLabel,
  isContactIncomeTx,
  isContactTransferTx,
  parseDestinataireFromNote,
  parseExpediteurFromNote,
  parseIncomeSourceFromNote,
  parseMotifFromNote,
  parseRaisonFromNote,
  resolveTransactionPaymentMethodLabel,
} from '@/lib/accountTransactionFlow';
import {
  deleteTransactionById,
  getCategories,
  filterActiveCategoryBudgets,
  getCategoryBudgets,
  getSavingsGoals,
  getTransactionById,
  insertTransaction,
} from '@/lib/db';
import { formValidationError } from '@/lib/formFeedback';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import { mergeArticlesIntoNote, parseItemizedNote, parseItemizedRowsFromNote } from '@/lib/itemizedNote';
import { captureReceiptPhoto, pickReceiptFromGallery } from '@/lib/receiptCapture';
import {
  mapScannedItemsToCategories,
  scanReceiptImage,
  serializeScanItemsForRoute,
} from '@/lib/receiptScan';
import { syncWithServer } from '@/lib/sync';
import { getTransactionInsight } from '@/lib/transactionInsight';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import type { Category, SavingsGoal, Transaction } from '@/types';

type Props = {
  transaction: Transaction | null;
  onClose: () => void;
  onDeleted?: () => void;
  onUpdated?: () => void;
};

const DETAIL_SHEET_TOP_RADIUS = 22;

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isPreviewableReceipt(uri?: string | null) {
  return Boolean(uri && !uri.startsWith('scan://') && /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(uri));
}

type DetailRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
  last?: boolean;
};

function DetailRow({ icon, label, value, valueColor, styles, colors, last = false }: DetailRowProps) {
  return (
    <View style={[styles.detailRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Ionicons name={icon} size={14} color={colors.textMuted} style={styles.detailIcon} />
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, valueColor ? { color: valueColor } : null]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function TransactionDetailSheet({ transaction: tx, onClose, onDeleted, onUpdated }: Props) {
  const router = useRouter();
  const { colors, isLight } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [displayTx, setDisplayTx] = useState<Transaction | null>(tx);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetCategoryIds, setBudgetCategoryIds] = useState<Set<string>>(new Set());
  const [editingArticles, setEditingArticles] = useState(false);
  const [draftItems, setDraftItems] = useState<ItemizedRow[]>([]);
  const [savingArticles, setSavingArticles] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ title: string; message: string } | null>(null);
  const storeAccounts = useSimulatedAccounts();
  const [transferGoals, setTransferGoals] = useState<Pick<SavingsGoal, 'id' | 'name'>[]>([]);

  useEffect(() => {
    void getCategories().then(setCategories);
    void getCategoryBudgets().then((budgets) => {
      setBudgetCategoryIds(new Set(filterActiveCategoryBudgets(budgets).map((budget) => budget.categoryId)));
    });
  }, []);

  useEffect(() => {
    setDisplayTx(tx);
  }, [tx]);

  useEffect(() => {
    if (!displayTx) {
      setEditingArticles(false);
      setDraftItems([]);
      setFormFeedback(null);
      return;
    }
    setEditingArticles(false);
    setDraftItems(parseItemizedRowsFromNote(displayTx.note));
  }, [displayTx?.id, displayTx?.note]);

  useEffect(() => {
    if (!displayTx || displayTx.type !== 'transfer') {
      setTransferGoals([]);
      return;
    }

    let cancelled = false;
    void getSavingsGoals().then((goals) => {
      if (!cancelled) setTransferGoals(goals);
    });

    return () => {
      cancelled = true;
    };
  }, [displayTx?.id, displayTx?.type]);

  const paymentMethodLabel = useMemo(
    () => (displayTx ? resolveTransactionPaymentMethodLabel(displayTx, { accounts: storeAccounts, savingsGoals: transferGoals }) : null),
    [storeAccounts, transferGoals, displayTx],
  );

  const detailRows = useMemo(() => {
    if (!displayTx) return [];

    const rows: Array<{
      key: string;
      icon: keyof typeof Ionicons.glyphMap;
      label: string;
      value: string;
      valueColor?: string;
    }> = [];

    rows.push({
      key: 'type',
      icon: 'layers-outline',
      label: 'Type',
      value: getTransactionTypeLabel(displayTx.type),
    });

    const personTransfer = isContactTransferTx(displayTx);
    const contactIncome = isContactIncomeTx(displayTx);

    if (displayTx.categoryName?.trim()) {
      rows.push({
        key: 'category',
        icon: getCategoryIconName(displayTx),
        label: 'Catégorie',
        value: displayTx.categoryName.trim(),
        valueColor: displayTx.categoryColor?.trim() || colors.text,
      });
    }

    if (personTransfer) {
      const destinataire = parseDestinataireFromNote(displayTx.note);
      const raison = parseRaisonFromNote(displayTx.note);
      if (destinataire) {
        rows.push({ key: 'destinataire', icon: 'person-outline', label: 'Destinataire', value: destinataire });
      }
      if (raison) {
        rows.push({ key: 'raison', icon: 'chatbox-outline', label: 'Raison', value: raison });
      }
      if (paymentMethodLabel) {
        rows.push({ key: 'account', icon: 'card-outline', label: 'Payé avec', value: paymentMethodLabel });
      }
    } else if (displayTx.type === 'transfer') {
      if (paymentMethodLabel) {
        rows.push({ key: 'transfer', icon: 'swap-horizontal-outline', label: 'Transfert', value: paymentMethodLabel });
      }
      const motif = parseMotifFromNote(displayTx.note);
      if (motif) {
        rows.push({ key: 'motif', icon: 'chatbox-outline', label: 'Motif', value: motif });
      }
    } else {
      if (contactIncome) {
        const expediteur = parseExpediteurFromNote(displayTx.note);
        const source = parseIncomeSourceFromNote(displayTx.note);
        const raison = parseRaisonFromNote(displayTx.note);
        const contactSource = expediteur ?? source;
        if (contactSource) {
          rows.push({ key: 'source', icon: 'person-outline', label: 'Source', value: contactSource });
        }
        if (raison) {
          rows.push({ key: 'raison', icon: 'chatbox-outline', label: 'Description', value: raison });
        }
      }
      if (paymentMethodLabel) {
        rows.push({
          key: 'account',
          icon: displayTx.type === 'income' ? 'wallet-outline' : 'card-outline',
          label: getTransactionPaymentMethodFieldLabel(displayTx.type),
          value: paymentMethodLabel,
        });
      }
      if (displayTx.type === 'expense') {
        const receiptLabel = getReceiptStatusLabel(displayTx.receiptStatus, displayTx.receiptUri);
        if (receiptLabel) {
          rows.push({ key: 'receipt', icon: 'receipt-outline', label: 'Reçu', value: receiptLabel });
        }
      }
    }

    return rows;
  }, [colors.text, displayTx, paymentMethodLabel]);

  const budgetCategories = useMemo(() => {
    const active = categories.filter(
      (category) => category.name !== 'Revenus' && budgetCategoryIds.has(category.id),
    );
    return active.length > 0 ? active : categories.filter((category) => category.name !== 'Revenus');
  }, [budgetCategoryIds, categories]);

  if (!displayTx) return null;

  const isIncome = displayTx.type === 'income';
  const isTransfer = displayTx.type === 'transfer';
  const isExpense = displayTx.type === 'expense';
  const isPersonTransfer = isContactTransferTx(displayTx);
  const isRegularExpense = isExpense && !isPersonTransfer;
  const visible = !!displayTx;
  const itemizedNote = parseItemizedNote(displayTx.note);
  const amountTint = isIncome ? colors.success : isTransfer ? colors.textMuted : colors.text;
  const hasReceipt = Boolean(displayTx.receiptUri || displayTx.receiptStatus);
  const hasArticles = itemizedNote.length > 0;
  const insight = getTransactionInsight(displayTx, itemizedNote);

  const editTransaction = () => {
    tapHaptic();
    onClose();
    router.push({ pathname: '/add-transaction', params: { editId: displayTx.id } });
  };

  const openScanFlow = () => {
    tapHaptic();
    onClose();
    router.push({
      pathname: '/scan',
      params: {
        editId: displayTx.id,
        merchant: displayTx.label,
        amount: String(displayTx.amount),
      },
    });
  };

  const processReceiptImage = async (uri: string) => {
    if (!uri) return;
    setScanningReceipt(true);
    setFormFeedback(null);

    try {
      const result = await scanReceiptImage(uri, {
        merchantHint: displayTx.label,
        totalHint: displayTx.amount,
      });
      const mapped = mapScannedItemsToCategories(result.items, budgetCategories, displayTx.label);
      onClose();
      router.push({
        pathname: '/add-transaction',
        params: {
          editId: displayTx.id,
          scanItems: serializeScanItemsForRoute(mapped),
          receiptUri: uri,
          merchant: displayTx.label,
        },
      });
    } catch {
      setFormFeedback(formValidationError('Scan impossible', 'Réessaie avec une photo plus nette.'));
    } finally {
      setScanningReceipt(false);
    }
  };

  const handleReceiptImport = async () => {
    try {
      const result = await pickReceiptFromGallery();
      if (result.cancelled || !result.uri) return;
      await processReceiptImage(result.uri);
    } catch (err) {
      setFormFeedback(
        formValidationError('Permission requise', err instanceof Error ? err.message : 'Accès galerie refusé.'),
      );
    }
  };

  const handleReceiptCapture = async () => {
    try {
      const result = await captureReceiptPhoto();
      if (result.cancelled || !result.uri) return;
      await processReceiptImage(result.uri);
    } catch (err) {
      setFormFeedback(
        formValidationError('Permission requise', err instanceof Error ? err.message : 'Accès caméra refusé.'),
      );
    }
  };

  const saveManualArticles = async () => {
    if (!isRegularExpense) return;

    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const payload = itemizedRowsToNotePayload(draftItems, categoryById, displayTx.categoryId, displayTx.label);
    const note = mergeArticlesIntoNote(displayTx.note, payload);

    setSavingArticles(true);
    setFormFeedback(null);

    await insertTransaction({
      id: displayTx.id,
      label: displayTx.label,
      amount: displayTx.amount,
      type: displayTx.type,
      date: displayTx.date,
      categoryId: displayTx.categoryId,
      transactionIcon: displayTx.transactionIcon,
      receiptUri: displayTx.receiptUri,
      receiptStatus: displayTx.receiptStatus,
      note,
      syncStatus: 'pending',
    });
    await syncWithServer();
    const refreshed = await getTransactionById(displayTx.id);
    if (refreshed) setDisplayTx(refreshed);
    setSavingArticles(false);
    setEditingArticles(false);
    successHaptic();
    onUpdated?.();
  };

  const startEditingArticles = () => {
    tapHaptic();
    const rows = parseItemizedRowsFromNote(displayTx.note);
    setDraftItems(rows.length > 0 ? rows : [{ id: `${Date.now()}`, name: '', price: '', categoryId: null }]);
    setEditingArticles(true);
  };

  const startManualArticles = () => {
    tapHaptic();
    setDraftItems([{ id: `${Date.now()}`, name: '', price: '', categoryId: null }]);
    setEditingArticles(true);
  };

  const cancelArticleEdits = () => {
    tapHaptic();
    setEditingArticles(false);
    setDraftItems(parseItemizedRowsFromNote(displayTx.note));
  };

  const handleDelete = () => {
    tapHaptic();
    setConfirmVisible(true);
  };

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        sheetStyle={styles.sheet}
        scrollContentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.xl) }}
      >
        <View style={styles.contentStack}>
          <View style={styles.topActions}>
            <SyncStatusBadge status={displayTx.syncStatus} style={styles.syncBadge} />
            <View style={styles.topActionButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Modifier la transaction"
                hitSlop={10}
                onPress={editTransaction}
                style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
              >
                <Ionicons name="pencil-outline" size={16} color={colors.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer les détails"
                hitSlop={10}
                onPress={onClose}
                style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
              >
                <Ionicons name="close" size={17} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.headerRow}>
            <TransactionAvatar transaction={displayTx} size={44} />
            <View style={styles.headerCopy}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerTitle} {...rowTitleTextProps}>
                  {displayTx.label}
                </Text>
                <Text style={[styles.headerAmount, { color: amountTint }]} {...singleLineAmountProps}>
                  {isTransfer ? '' : isIncome ? '+' : '−'}
                  {formatDisplayMoneyAbsolute(displayTx.amount)}
                </Text>
              </View>
              <Text style={styles.headerMeta}>
                {formatShortDate(displayTx.date)}
                {` · ${getTransactionTypeLabel(displayTx.type)}`}
              </Text>
            </View>
          </View>

          {detailRows.length > 0 ? (
            <View style={[styles.infoGroup, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              {detailRows.map((row, index) => (
                <DetailRow
                  key={row.key}
                  icon={row.icon}
                  label={row.label}
                  value={row.value}
                  valueColor={row.valueColor}
                  styles={styles}
                  colors={colors}
                  last={index === detailRows.length - 1}
                />
              ))}
            </View>
          ) : null}

          {isRegularExpense ? (
            <View style={styles.sectionBlock}>
              <DashboardSectionLabel>Détail du reçu</DashboardSectionLabel>

              {scanningReceipt ? (
                <SurfaceCard innerStyle={styles.scanningInner} padding={spacing.md}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={[styles.scanningText, { color: colors.textMuted }]}>Analyse du reçu en cours…</Text>
                </SurfaceCard>
              ) : null}

              {editingArticles ? (
                <SurfaceCard innerStyle={styles.itemsCardInner} padding={spacing.md}>
                  <View style={styles.itemsCardHeader}>
                    <Text style={[styles.itemsCardTitle, { color: colors.textMuted }]}>
                      {hasArticles
                        ? `${itemizedNote.length} article${itemizedNote.length > 1 ? 's' : ''}`
                        : 'Saisie manuelle'}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Annuler la modification des articles"
                      onPress={cancelArticleEdits}
                      hitSlop={8}
                      style={({ pressed }) => [styles.inlineEditBtn, pressed && styles.headerButtonPressed]}
                    >
                      <Text style={[styles.inlineEditText, { color: colors.textMuted }]}>Annuler</Text>
                    </Pressable>
                  </View>
                  <ItemizedArticlesEditor
                    items={draftItems}
                    categories={budgetCategories}
                    merchantHint={displayTx.label}
                    compact
                    showHeader={false}
                    onChange={setDraftItems}
                  />
                  <PrimarySaveButton
                    label={savingArticles ? 'Enregistrement…' : 'Enregistrer les articles'}
                    onPress={() => void saveManualArticles()}
                    disabled={savingArticles}
                  />
                </SurfaceCard>
              ) : hasArticles ? (
                <SurfaceCard innerStyle={styles.itemsCardInner} padding={spacing.md}>
                  <View style={styles.itemsCardHeader}>
                    <Text style={[styles.itemsCardTitle, { color: colors.textMuted }]}>
                      {itemizedNote.length} article{itemizedNote.length > 1 ? 's' : ''}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Modifier les articles"
                      onPress={startEditingArticles}
                      hitSlop={8}
                      style={({ pressed }) => [styles.inlineEditBtn, pressed && styles.headerButtonPressed]}
                    >
                      <Ionicons name="pencil-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.inlineEditText, { color: colors.text }]}>Modifier</Text>
                    </Pressable>
                  </View>
                  {itemizedNote.map((item, index) => (
                    <View key={`${item.name}-${index}`} style={styles.itemRow}>
                      <View style={styles.itemCopy}>
                        <Text style={styles.itemName} {...rowTitleTextProps}>{item.name}</Text>
                        {item.categoryName ? (
                          <Text style={styles.itemCategory} numberOfLines={1}>{item.categoryName}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.itemPrice}>{formatDisplayMoneyAbsolute(item.price)}</Text>
                    </View>
                  ))}
                </SurfaceCard>
              ) : (
                <SurfaceCard innerStyle={styles.emptyArticlesInner} padding={spacing.md}>
                  <Text style={[styles.emptyArticlesTitle, { color: colors.text }]}>Aucun article enregistré</Text>
                  <Text style={[styles.emptyArticlesHint, { color: colors.textMuted }]}>
                    Importe ou scanne un reçu pour remplir automatiquement les articles.
                  </Text>
                  <ReceiptCaptureActions
                    variant="premium"
                    label="Ajouter un reçu"
                    onScan={openScanFlow}
                    onCapture={() => void handleReceiptCapture()}
                    onImport={() => void handleReceiptImport()}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Saisir les articles manuellement"
                    onPress={startManualArticles}
                    style={({ pressed }) => [styles.manualEntryBtn, pressed && styles.headerButtonPressed]}
                  >
                    <Text style={[styles.manualEntryText, { color: colors.textMuted }]}>Saisir manuellement</Text>
                  </Pressable>
                </SurfaceCard>
              )}

              {!editingArticles && hasArticles ? (
                <ReceiptCaptureActions
                  variant="premium"
                  label="Ajouter un reçu"
                  onScan={openScanFlow}
                  onCapture={() => void handleReceiptCapture()}
                  onImport={() => void handleReceiptImport()}
                />
              ) : null}

              {hasReceipt ? (
                <SurfaceCard innerStyle={styles.receiptCardInner} padding={spacing.md}>
                  {displayTx.receiptStatus === 'scan_pending' ? (
                    <ThemedFormMessage
                      variant="warning"
                      title="Scan à compléter"
                      message="Complète le scan pour extraire les articles."
                      style={styles.receiptScanBanner}
                    />
                  ) : null}
                  {isPreviewableReceipt(displayTx.receiptUri) ? (
                    <Image source={{ uri: displayTx.receiptUri ?? '' }} style={styles.receiptPreview} contentFit="cover" />
                  ) : null}
                  {displayTx.receiptUri && !displayTx.receiptUri.startsWith('scan://') ? (
                    <Pressable style={styles.receiptLink} onPress={() => void Linking.openURL(displayTx.receiptUri ?? '')}>
                      <Ionicons name="open-outline" size={14} color={colors.primary} />
                      <Text style={styles.receiptLinkText} numberOfLines={1}>
                        Ouvrir le reçu
                      </Text>
                    </Pressable>
                  ) : displayTx.receiptStatus !== 'scan_pending' ? (
                    <Text style={styles.receiptMeta}>Reçu lié à cette transaction.</Text>
                  ) : null}
                </SurfaceCard>
              ) : null}
            </View>
          ) : null}

          {insight ? (
            <TransactionAiInsightCard insight={insight} />
          ) : null}

          {formFeedback ? (
            <ThemedFormMessage variant="error" title={formFeedback.title} message={formFeedback.message} />
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Supprimer la transaction"
            style={({ pressed }) => [
              subtleDeleteButtonStyle(isLight),
              pressed && { opacity: 0.72 },
            ]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={16} color={destructiveIconColor(isLight)} />
            <Text style={destructiveTextActionStyle(isLight)}>Supprimer</Text>
          </Pressable>
        </View>
      </BottomSheet>
      <ConfirmDeleteModal
        visible={confirmVisible}
        title="Supprimer la transaction ?"
        message="Cette action est irréversible."
        onConfirm={async () => {
          setConfirmVisible(false);
          await deleteTransactionById(displayTx.id);
          onDeleted?.();
          onClose();
        }}
        onCancel={() => setConfirmVisible(false)}
      />
    </>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    sheet: {
      backgroundColor: colors.containerBackground,
      borderTopLeftRadius: DETAIL_SHEET_TOP_RADIUS,
      borderTopRightRadius: DETAIL_SHEET_TOP_RADIUS,
    },
    contentStack: {
      gap: spacing.lg,
    },
    topActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    syncBadge: {
      alignSelf: 'flex-start',
      flex: 1,
      minWidth: 0,
    },
    topActionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerButton: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSolid,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    headerButtonPressed: {
      opacity: 0.72,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    headerTitle: {
      ...listRowTitle,
      flex: 1,
      minWidth: 0,
      color: colors.text,
    },
    headerAmount: {
      ...rowValue,
      flexShrink: 0,
      color: colors.text,
    },
    headerMeta: {
      ...typographyKit.metaMedium,
      color: colors.textMuted,
    },
    infoGroup: {
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    detailIcon: {
      marginTop: 2,
      flexShrink: 0,
    },
    detailCopy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    detailLabel: {
      ...typographyKit.microMedium,
      color: colors.textMuted,
    },
    detailValue: {
      ...typographyKit.metaMedium,
      color: colors.text,
    },
    sectionBlock: {
      gap: spacing.md,
    },
    itemsCardInner: {
      gap: spacing.md,
    },
    itemsCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    itemsCardTitle: {
      ...typographyKit.microUpper,
      letterSpacing: 0.4,
    },
    inlineEditBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    inlineEditText: {
      ...typographyKit.metaMedium,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minWidth: 0,
    },
    itemCopy: {
      flex: 1,
      minWidth: 0,
      gap: spacing.xs,
    },
    itemName: {
      ...typographyKit.listPrimary,
      color: colors.text,
    },
    itemCategory: {
      ...typographyKit.metaMedium,
      color: colors.textMuted,
    },
    itemPrice: {
      ...rowValue,
      flexShrink: 0,
      color: colors.text,
    },
    emptyArticlesInner: {
      gap: spacing.md,
    },
    emptyArticlesTitle: {
      ...typographyKit.caption,
    },
    emptyArticlesHint: {
      ...typographyKit.metaMedium,
      lineHeight: 19,
    },
    manualEntryBtn: {
      alignSelf: 'center',
      paddingVertical: spacing.sm,
    },
    manualEntryText: {
      ...typographyKit.metaMedium,
    },
    scanningInner: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
    },
    scanningText: {
      ...typographyKit.metaMedium,
    },
    receiptCardInner: {
      gap: spacing.md,
    },
    receiptScanBanner: {
      marginBottom: 0,
    },
    receiptPreview: {
      width: '100%',
      height: 120,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
    },
    receiptLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minWidth: 0,
      paddingVertical: spacing.xs,
    },
    receiptLinkText: {
      ...typographyKit.caption,
      color: colors.primary,
      flex: 1,
      minWidth: 0,
    },
    receiptMeta: {
      ...typographyKit.metaMedium,
      color: colors.textMuted,
    },
  });
}

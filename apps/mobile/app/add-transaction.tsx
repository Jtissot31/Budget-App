import { useEffect, useMemo, useRef, useState } from 'react';
import {
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetCategoryPicker } from '@/components/BudgetCategoryPicker';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { GhostNumpad } from '@/components/GhostNumpad';
import {
  ItemizedArticlesEditor,
  itemizedRowsToNotePayload,
  type ItemizedRow,
} from '@/components/ItemizedArticlesEditor';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { TransferModePicker, type TransferMode } from '@/components/TransferModePicker';
import { ReceiptCaptureActions } from '@/components/ReceiptCaptureActions';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { formValidationError, type FormFeedback } from '@/lib/formFeedback';
import { DatePickerField } from '@/components/MinimalDatePicker';
import {
  CHIP_BORDER_WIDTH,
  CHIP_PADDING_HORIZONTAL,
  TYPE_TRANSACTION_CHIP_MIN_WIDTH,
  ICON_WELL_SIZE,
  interBoldText,
  interExtraBoldText,
  interMediumText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { chipLabelTextProps, singleLineLabelStyle } from '@/lib/textLayout';
import { hasMerchantLogoCandidate } from '@/components/TransactionAvatar';
import { LogoIconFrame } from '@/components/IconFrame';
import { MdiIconPicker } from '@/components/MdiIconPicker';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import {
  TRANSFER_CATEGORY,
  getCategoryIconName,
  type IconName,
} from '@/constants/categoryOptions';
import { EXPENSE_DEFAULT_ICON, isExpenseDefaultIcon, type ExpenseFallbackIcon } from '@/lib/expenseIcon';
import { EXPENSE_MDI_ICON, type MdiIconName } from '@/lib/mdiIconCatalog';
import { MANUAL_ENTRY_ACCOUNTS } from '@/constants/manualEntryAccounts';
import { getMerchantLogoUrl, KNOWN_MERCHANT_NAMES } from '@/lib/merchantLogo';
import { useAppTheme } from '@/lib/themeContext';
import {
  adjustSavingsGoalCurrentAmount,
  adjustSimulatedAccountBalance,
  filterActiveCategoryBudgets,
  getCategories,
  getCategoryBudgets,
  getContacts,
  getSavingsGoals,
  getSimulatedAccounts,
  getTransactionById,
  getTransactions,
  insertTransaction,
  upsertCategory,
  upsertContactByName,
} from '@/lib/db';
import {
  buildAutoTransferLabel,
  findInsufficientFundsViolation,
  getTransactionAccountDeltas,
  isAutoTransferLabel,
  parseAccountIdFromNote,
  appendContactIdToNote,
  parseContactIdFromNote,
  parseDestinataireFromNote,
  parseExpediteurFromNote,
  parseIncomeSourceFromNote,
  parseMotifFromNote,
  parseRaisonFromNote,
  parseTransferAccountsFromNote,
} from '@/lib/accountTransactionFlow';
import {
  buildContactDirectoryRows,
  findContactByName,
  resolveContactIdForName,
  searchContactSuggestions,
} from '@/lib/contactHistory';
import { formatMoneyAmountInput } from '@/lib/formatMoneyAmountInput';
import {
  inferCategoryId,
  inferCategoryIdFromTransferReason,
  normalizeSearch,
} from '@/lib/categoryInference';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import { createEmptyItemizedRow, parseItemizedRowsFromNote } from '@/lib/itemizedNote';
import { captureReceiptPhoto, pickReceiptFromGallery } from '@/lib/receiptCapture';
import {
  mapScannedItemsToCategories,
  parseScanItemsFromRoute,
  scanReceiptImage,
} from '@/lib/receiptScan';
import { getLocalDateInputValue, toLocalDateInputValue } from '@/lib/localDateInput';
import { createLocalTransaction, syncWithServer } from '@/lib/sync';
import type { Category, Contact, SavingsGoal, SimulatedAccount, Transaction, TransactionType } from '@/types';

type PaymentAccountOption = {
  id: string;
  label: string;
  isSimulated: boolean;
};
type TransferEndpoint = {
  id: string;
  label: string;
  sublabel: string;
  kind: 'account' | 'goal';
  isSimulated: boolean;
  icon: string;
  color: string;
};
function amountFontSize(raw: string) {
  const len = (raw || '0').replace(/[^0-9]/g, '').length;
  return Math.max(36, 64 - Math.min(len, 12) * 2.2);
}

function parseMoney(raw: string): number {
  const parsed = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyInput(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function toDateInputValue(value: string): string {
  return toLocalDateInputValue(value);
}

function toTransactionDate(value: string): string {
  const day = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return new Date().toISOString();
  return new Date(`${day}T12:00:00`).toISOString();
}

function isIconName(value?: string | null): value is IconName {
  return Boolean(value && value in Ionicons.glyphMap);
}

const TRANSFER_GOAL_ICON_WELL_SIZE = 28;
const TRANSFER_GOAL_ICON_GLYPH_SIZE = 15;

function TransferGoalChipIcon({
  icon,
  selected,
  selectedColor,
  mutedColor,
}: {
  icon?: string | null;
  selected: boolean;
  selectedColor: string;
  mutedColor: string;
}) {
  return (
    <UserPickedIconBadge
      icon={icon || 'flag-outline'}
      color={selected ? selectedColor : mutedColor}
      size={TRANSFER_GOAL_ICON_WELL_SIZE}
      iconSize={TRANSFER_GOAL_ICON_GLYPH_SIZE}
    />
  );
}

async function applyLinkedSavingsGoalDeltas(
  accounts: SimulatedAccount[],
  accountDeltas: Array<{ id: string; delta: number }>,
  multiplier = 1,
) {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const goalDeltas = new Map<string, number>();

  for (const { id, delta } of accountDeltas) {
    const linkedGoalId = accountById.get(id)?.linkedSavingsGoalId?.trim();
    if (!linkedGoalId) continue;
    goalDeltas.set(linkedGoalId, (goalDeltas.get(linkedGoalId) ?? 0) + delta * multiplier);
  }

  for (const [goalId, delta] of goalDeltas) {
    await adjustSavingsGoalCurrentAmount(goalId, delta);
  }
}

export default function AddTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    editId?: string;
    type?: string;
    label?: string;
    accountId?: string;
    scanItems?: string;
    receiptUri?: string;
    merchant?: string;
    amount?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const editId = typeof params.editId === 'string' ? params.editId : '';
  const routeType = typeof params.type === 'string' ? params.type : '';
  const routeLabel = typeof params.label === 'string' ? params.label : '';
  const routeAccountId = typeof params.accountId === 'string' ? params.accountId : '';
  const routeScanItems = typeof params.scanItems === 'string' ? params.scanItems : '';
  const routeReceiptUri = typeof params.receiptUri === 'string' ? params.receiptUri : '';
  const routeScanAmount = typeof params.amount === 'string' ? params.amount : '';
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetCategoryIds, setBudgetCategoryIds] = useState<Set<string>>(new Set());
  const [savedContacts, setSavedContacts] = useState<Contact[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [simulatedAccounts, setSimulatedAccounts] = useState<SimulatedAccount[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [prefilledEditId, setPrefilledEditId] = useState<string | null>(null);
  const [type, setType] = useState<TransactionType>('expense');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getLocalDateInputValue);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryManuallySelected, setCategoryManuallySelected] = useState(false);
  const [accountId, setAccountId] = useState<string>(MANUAL_ENTRY_ACCOUNTS[0].id);
  const [destinationAccountId, setDestinationAccountId] = useState<string>(MANUAL_ENTRY_ACCOUNTS[1].id);
  const [transferMode, setTransferMode] = useState<TransferMode>('accounts');
  const [transferReason, setTransferReason] = useState('');
  const [linkedContactId, setLinkedContactId] = useState<string | null>(null);
  const [creatingContact, setCreatingContact] = useState(false);
  const [fallbackIcon, setFallbackIcon] = useState<string>(EXPENSE_MDI_ICON);
  const [itemizedExpenses, setItemizedExpenses] = useState<ItemizedRow[]>([]);
  const [receiptUri, setReceiptUri] = useState('');
  const [receiptStatus, setReceiptStatus] = useState<Transaction['receiptStatus'] | null>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [scanPrefillApplied, setScanPrefillApplied] = useState(false);
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [iconPickedManually, setIconPickedManually] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formFeedback, setFormFeedback] = useState<FormFeedback | null>(null);
  const labelInputRef = useRef<TextInput>(null);
  const sheetScrollRef = useRef<ScrollView>(null);
  const amountSectionYRef = useRef(0);
  const nameSectionYRef = useRef(0);

  const merchantSuggestions = useMemo(() => {
    if (type !== 'expense') return [];
    const query = normalizeSearch(label);
    if (query.length < 2) return [];

    return KNOWN_MERCHANT_NAMES.filter((merchant) => {
      const normalized = normalizeSearch(merchant);
      return normalized !== query && (normalized.startsWith(query) || normalized.includes(query));
    }).slice(0, 5);
  }, [label, type]);

  const contactDirectoryRows = useMemo(
    () => buildContactDirectoryRows(allTransactions, savedContacts),
    [allTransactions, savedContacts],
  );

  const contactSuggestions = useMemo(() => {
    const isContactField =
      type === 'income' ||
      (type === 'transfer' && (transferMode === 'person' || transferMode === 'person_from'));
    if (!isContactField) return [];
    if (label.length < 3) return [];
    return searchContactSuggestions(savedContacts, label, 5, contactDirectoryRows);
  }, [contactDirectoryRows, label, savedContacts, transferMode, type]);

  useEffect(() => {
    void getCategories().then((cats) => {
      setCategories(cats);
      if (editId && editingTransaction) {
        const isPersonTransferEdit =
          Boolean(parseDestinataireFromNote(editingTransaction.note)) ||
          Boolean(parseExpediteurFromNote(editingTransaction.note));
        if (editingTransaction.type === type || (isPersonTransferEdit && type === 'transfer')) return;
      }
      if (type === 'transfer' && (transferMode === 'person' || transferMode === 'person_from')) {
        const budgetCats = cats.filter(
          (c) => c.name !== 'Revenus' && c.id !== TRANSFER_CATEGORY.id && budgetCategoryIds.has(c.id),
        );
        const defaultCat = budgetCats[0] ?? null;
        setCategoryManuallySelected(false);
        setCategoryId(defaultCat?.id ?? null);
        return;
      }
      const defaultCat =
        type === 'transfer'
          ? cats.find((c) => c.id === TRANSFER_CATEGORY.id) ?? TRANSFER_CATEGORY
          : cats.find((c) => (type === 'income' ? c.name === 'Revenus' : c.name !== 'Revenus')) ??
        cats[0];
      setCategoryManuallySelected(false);
      setCategoryId(defaultCat?.id ?? null);
    });
  }, [budgetCategoryIds, editId, editingTransaction?.type, transferMode, type]);

  useEffect(() => {
    if (editId) return;
    if (routeType === 'income' || routeType === 'expense' || routeType === 'transfer') {
      setType(routeType);
    }
    if (routeLabel) setLabel(routeLabel);
    if (routeAccountId) setAccountId(routeAccountId);
    if (routeScanAmount && !amount) setAmount(formatMoneyInput(parseMoney(routeScanAmount)));
  }, [amount, editId, routeAccountId, routeLabel, routeScanAmount, routeType]);

  useEffect(() => {
    if (scanPrefillApplied || !routeScanItems) return;
    const scanned = parseScanItemsFromRoute(routeScanItems);
    if (scanned.length === 0) return;

    setType('expense');
    setItemizedExpenses(
      scanned.map((item, index) => ({
        id: `${Date.now()}-scan-${index}`,
        name: item.name,
        price: formatMoneyInput(item.price),
        categoryId: item.categoryId ?? null,
      })),
    );
    if (routeReceiptUri) {
      setReceiptUri(routeReceiptUri);
      setReceiptStatus('attached');
    }
    const scanTotal = scanned.reduce((sum, item) => sum + item.price, 0);
    if (scanTotal > 0) setAmount(formatMoneyInput(scanTotal));
    setScanPrefillApplied(true);
  }, [routeReceiptUri, routeScanItems, scanPrefillApplied]);

  useEffect(() => {
    void getSimulatedAccounts().then(setSimulatedAccounts);
  }, []);

  useEffect(() => {
    void getCategoryBudgets().then((budgets) => {
      setBudgetCategoryIds(new Set(filterActiveCategoryBudgets(budgets).map((b) => b.categoryId)));
    });
  }, []);

  useEffect(() => {
    void getContacts().then(setSavedContacts);
  }, []);

  useEffect(() => {
    void getTransactions().then(setAllTransactions);
  }, []);

  useEffect(() => {
    void getSavingsGoals().then(setSavingsGoals);
  }, []);

  useEffect(() => {
    if (type !== 'expense') return;
    setItemizedExpenses((rows) => (rows.length > 0 ? rows : [createEmptyItemizedRow()]));
  }, [type]);

  useEffect(() => {
    if (type === 'expense') return;
    setReceiptUri('');
    setReceiptStatus(null);
  }, [type]);

  useEffect(() => {
    if (editId) return;
    if (type === 'expense') {
      setFallbackIcon(EXPENSE_DEFAULT_ICON);
      return;
    }
    setFallbackIcon((current) => (current === EXPENSE_DEFAULT_ICON ? 'receipt-outline' : current));
  }, [editId, type]);

  useEffect(() => {
    if (type === 'transfer' && (transferMode === 'person' || transferMode === 'person_from')) return;

    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    const interaction = InteractionManager.runAfterInteractions(() => {
      focusTimer = setTimeout(() => labelInputRef.current?.focus(), 180);
    });

    return () => {
      interaction.cancel();
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, [transferMode, type]);

  // When autocomplete suggestions appear while the keyboard is open, scroll the
  // sheet so the suggestion chips are visible above the keyboard.
  useEffect(() => {
    if (merchantSuggestions.length === 0 && contactSuggestions.length === 0) return;
    requestAnimationFrame(() => {
      sheetScrollRef.current?.scrollTo({
        y: Math.max(nameSectionYRef.current - 16, 0),
        animated: true,
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactSuggestions.length, merchantSuggestions.length]);

  const visibleCats = useMemo(() => {
    if (type === 'transfer' && transferMode === 'person') {
      return categories.filter(
        (c) => c.name !== 'Revenus' && c.id !== TRANSFER_CATEGORY.id && budgetCategoryIds.has(c.id),
      );
    }
    if (type === 'transfer' && transferMode === 'person_from') {
      return categories.filter((c) => c.name === 'Revenus');
    }
    if (type === 'transfer') {
      return [categories.find((c) => c.id === TRANSFER_CATEGORY.id) ?? TRANSFER_CATEGORY];
    }
    if (type === 'income') {
      return categories.filter((c) => c.name === 'Revenus');
    }
    // expense: only show categories that exist in the budget page
    return categories.filter((c) => c.name !== 'Revenus' && budgetCategoryIds.has(c.id));
  }, [categories, transferMode, type, budgetCategoryIds]);
  const accountOptions = useMemo<PaymentAccountOption[]>(() => {
    if (simulatedAccounts.length > 0) {
      return simulatedAccounts.map((account) => ({
        id: account.id,
        label: account.last4 ? `${account.name} • ${account.last4}` : account.name,
        isSimulated: true,
      }));
    }

    return MANUAL_ENTRY_ACCOUNTS.map((account) => ({
      id: account.id,
      label: account.label,
      isSimulated: false,
    }));
  }, [simulatedAccounts]);

  const transferEndpoints = useMemo<TransferEndpoint[]>(() => {
    const accountEntries: TransferEndpoint[] = accountOptions.map((a) => ({
      id: a.id,
      label: a.label.split(' • ')[0] ?? a.label,
      sublabel: a.label.includes(' • ') ? `••${a.label.split(' • ')[1]}` : 'Compte',
      kind: 'account',
      isSimulated: a.isSimulated,
      icon: 'card-outline',
      color: colors.textSecondary,
    }));
    const goalEntries: TransferEndpoint[] = savingsGoals.map((g) => ({
      id: g.id,
      label: g.name,
      sublabel: `${Math.round(g.currentAmount).toLocaleString('fr-CA')} $`,
      kind: 'goal',
      isSimulated: false,
      icon: (g.icon as string) || 'flag-outline',
      color: g.color || colors.primary,
    }));
    return [...accountEntries, ...goalEntries];
  }, [accountOptions, colors.primary, colors.textSecondary, savingsGoals]);

  useEffect(() => {
    if (!editId || prefilledEditId === editId || categories.length === 0 || accountOptions.length === 0) return;

    let cancelled = false;
    void getTransactionById(editId).then((tx) => {
      if (cancelled || !tx) return;
      const transferAccounts = parseTransferAccountsFromNote(tx.note);
      const destinataire = parseDestinataireFromNote(tx.note);
      const expediteur = parseExpediteurFromNote(tx.note);
      const incomeSource = parseIncomeSourceFromNote(tx.note);
      const existingContactId = parseContactIdFromNote(tx.note);
      const sourceAccountId = tx.type === 'transfer' ? transferAccounts.sourceId : parseAccountIdFromNote(tx.note);
      const fallbackAccount = accountOptions[0];
      const fallbackDestination = accountOptions[1] ?? fallbackAccount;

      const isKnownEndpoint = (id: string | null) =>
        id ? (accountOptions.some((a) => a.id === id) || savingsGoals.some((g) => g.id === id)) : false;

      const resolvedSourceId = isKnownEndpoint(sourceAccountId) ? sourceAccountId! : fallbackAccount.id;
      const resolvedDestinationId = isKnownEndpoint(transferAccounts.destinationId)
        ? transferAccounts.destinationId!
        : fallbackDestination.id;
      const sourceEndpointLabel =
        transferEndpoints.find((e) => e.id === resolvedSourceId)?.label ??
        accountOptions.find((a) => a.id === resolvedSourceId)?.label ??
        resolvedSourceId;
      const destinationEndpointLabel =
        transferEndpoints.find((e) => e.id === resolvedDestinationId)?.label ??
        accountOptions.find((a) => a.id === resolvedDestinationId)?.label ??
        resolvedDestinationId;

      setEditingTransaction(tx);
      setLinkedContactId(existingContactId);
      if (destinataire) {
        setType('transfer');
        setTransferMode('person');
        setLabel(destinataire);
        setTransferReason(parseRaisonFromNote(tx.note) ?? '');
      } else if (expediteur) {
        setType('transfer');
        setTransferMode('person_from');
        setLabel(expediteur);
        setTransferReason(parseRaisonFromNote(tx.note) ?? '');
      } else if (tx.type === 'income' && (incomeSource || existingContactId)) {
        setType('income');
        setTransferMode('accounts');
        setLabel(incomeSource ?? tx.label);
        setTransferReason('');
      } else {
        setType(tx.type);
        setTransferMode('accounts');
        if (tx.type === 'transfer') {
          const motif = parseMotifFromNote(tx.note);
          setTransferReason(
            isAutoTransferLabel(tx.label, sourceEndpointLabel, destinationEndpointLabel)
              ? motif ?? ''
              : tx.label,
          );
          setLabel('');
        } else {
          setLabel(tx.label);
          setTransferReason('');
        }
      }
      setAmount(formatMoneyInput(tx.amount));
      setDate(toDateInputValue(tx.date));
      setCategoryId(tx.categoryId);
      setCategoryManuallySelected(true);
      setAccountId(resolvedSourceId);
      setDestinationAccountId(resolvedDestinationId);
      const resolvedIcon =
        tx.type === 'expense'
          ? isExpenseDefaultIcon(tx.transactionIcon)
            ? EXPENSE_MDI_ICON
            : tx.transactionIcon ?? EXPENSE_MDI_ICON
          : tx.transactionIcon ?? 'AttachMoney';
      setFallbackIcon(resolvedIcon);
      setIconPickedManually(
        tx.type === 'expense'
          ? Boolean(tx.transactionIcon && !isExpenseDefaultIcon(tx.transactionIcon))
          : Boolean(tx.transactionIcon),
      );
      setShowLogoPicker(false);
      if (routeScanItems) {
        const scanned = parseScanItemsFromRoute(routeScanItems);
        setItemizedExpenses(
          scanned.map((item, index) => ({
            id: `${Date.now()}-scan-${index}`,
            name: item.name,
            price: formatMoneyInput(item.price),
            categoryId: item.categoryId ?? null,
          })),
        );
        if (routeReceiptUri) {
          setReceiptUri(routeReceiptUri);
          setReceiptStatus('attached');
        }
        setScanPrefillApplied(true);
      } else {
        setItemizedExpenses(tx.type === 'expense' ? parseItemizedRowsFromNote(tx.note) : []);
      }
      setReceiptUri(tx.receiptUri ?? '');
      setReceiptStatus(tx.receiptStatus ?? null);
      setPrefilledEditId(editId);
    });

    return () => {
      cancelled = true;
    };
  }, [accountOptions, categories.length, editId, prefilledEditId, routeReceiptUri, routeScanItems, savingsGoals, transferEndpoints]);

  useEffect(() => {
    if (accountOptions.length === 0) return;
    const firstAccount = accountOptions[0];
    const defaultDestination = accountOptions[1] ?? firstAccount;
    if (!firstAccount) return;

    setAccountId((current) =>
      accountOptions.some((account) => account.id === current) ? current : firstAccount.id,
    );
    setDestinationAccountId((current) =>
      accountOptions.some((account) => account.id === current)
        ? current
        : defaultDestination.id,
    );
  }, [accountOptions]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const hasItemizedItems = type === 'expense' && itemizedExpenses.some((item) => item.name.trim() || parseMoney(item.price) > 0);
  const categorySearchText = useMemo(() => {
    if (type === 'transfer' && (transferMode === 'person' || transferMode === 'person_from')) {
      return [transferReason, label].filter(Boolean).join(' ');
    }
    return [label, ...itemizedExpenses.map((item) => item.name)].filter(Boolean).join(' ');
  }, [itemizedExpenses, label, transferMode, transferReason, type]);
  const inferredExpenseCategoryId = useMemo(() => {
    if (type === 'transfer' && transferMode === 'person') {
      return inferCategoryIdFromTransferReason(transferReason, visibleCats, inferCategoryId(label, visibleCats, null));
    }
    if (type === 'expense') {
      return inferCategoryId(categorySearchText, visibleCats, null);
    }
    return null;
  }, [categorySearchText, label, transferMode, transferReason, type, visibleCats]);
  useEffect(() => {
    if (categoryManuallySelected) return;
    if (!inferredExpenseCategoryId || categoryId === inferredExpenseCategoryId) return;
    setCategoryId(inferredExpenseCategoryId);
  }, [categoryId, categoryManuallySelected, inferredExpenseCategoryId]);

  const applyScannedItems = (uri: string, scannedItems: ReturnType<typeof mapScannedItemsToCategories>) => {
    setReceiptUri(uri);
    setReceiptStatus('attached');
    setItemizedExpenses(
      scannedItems.map((item, index) => ({
        id: `${Date.now()}-scan-${index}`,
        name: item.name,
        price: formatMoneyInput(item.price),
        categoryId: item.categoryId ?? null,
      })),
    );
    const total = scannedItems.reduce((sum, item) => sum + item.price, 0);
    if (total > 0) setAmount(formatMoneyInput(total));
  };

  const processReceiptImage = async (uri: string) => {
    if (!uri) return;
    setScanningReceipt(true);
    setFormFeedback(null);
    try {
      const result = await scanReceiptImage(uri, {
        merchantHint: label.trim() || routeLabel,
        totalHint: parseMoney(amount) || parseMoney(routeScanAmount),
      });
      const mapped = mapScannedItemsToCategories(result.items, visibleCats, label.trim() || routeLabel);
      applyScannedItems(uri, mapped);
    } catch {
      setFormFeedback(formValidationError('Scan impossible', 'Réessaie avec une photo plus nette.'));
    } finally {
      setScanningReceipt(false);
    }
  };

  const openDedicatedScan = () => {
    tapHaptic();
    router.push({
      pathname: '/scan',
      params: {
        editId: editId || undefined,
        merchant: label.trim() || routeLabel || undefined,
        amount: amount || routeScanAmount || undefined,
      },
    });
  };

  const pickReceiptImage = async () => {
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

  const captureReceiptImage = async () => {
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

  const displayAmount = useMemo(() => {
    const amt = amount.length ? formatMoneyAmountInput(amount) : '0';
    const sign =
      type === 'transfer' && transferMode === 'accounts'
        ? ''
        : type === 'income'
          ? '+'
          : '−';
    return `${sign}${amt} $`;
  }, [amount, transferMode, type]);
  const labelHasLogo = useMemo(() => hasMerchantLogoCandidate(label), [label]);
  const autoLogoUrl = useMemo(() => getMerchantLogoUrl(label.trim()), [label]);
  const fallbackIconColor = colors.textSecondary;
  const fallbackSourceAccount = accountOptions[0] ?? { id: 'checking', label: 'Chèques', isSimulated: false };
  const sourceAccount = accountOptions.find((account) => account.id === accountId) ?? fallbackSourceAccount;
  const destinationAccount =
    accountOptions.find((account) => account.id === destinationAccountId) ?? accountOptions[1] ?? fallbackSourceAccount;
  const sourceEndpoint = transferEndpoints.find((e) => e.id === accountId);
  const destinationEndpoint = transferEndpoints.find((e) => e.id === destinationAccountId);
  const isTransfer = type === 'transfer';
  const isPersonTransferTo = isTransfer && transferMode === 'person';
  const isPersonTransferFrom = isTransfer && transferMode === 'person_from';
  const isAnyPersonTransfer = isPersonTransferTo || isPersonTransferFrom;
  const usesContactField = type === 'income' || isAnyPersonTransfer;
  const isStandardTransfer = isTransfer && transferMode === 'accounts';
  const hasAccountOptions = accountOptions.length > 0;
  const hasSavingsGoalsList = savingsGoals.length > 0;
  const hasTransferEndpoints = transferEndpoints.length > 0;
  const hasMerchantSuggestions = merchantSuggestions.length > 0;
  const hasContactSuggestions = contactSuggestions.length > 0;
  const hasNameSuggestions = hasMerchantSuggestions || hasContactSuggestions;
  const isEditing = Boolean(editingTransaction);
  const sheetTitle = isEditing
    ? 'Modifier la transaction'
    : type === 'income'
      ? 'Nouveau revenu'
      : isTransfer
        ? 'Nouveau transfert'
        : 'Nouvelle dépense';
  const themed = useMemo(
    () => ({
      modalBackdrop: { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' },
      sheet: { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
      handle: { backgroundColor: colors.borderStrong },
      closeButton: {
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      control: {
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      controlStrong: {
        backgroundColor: colors.input,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      selected: {
        backgroundColor: colors.successMuted,
        borderColor: colors.primary,
      },
      selectedText: { color: colors.primary },
      text: { color: colors.text },
      textMuted: { color: colors.textMuted },
      detectedCategory: { backgroundColor: colors.successMuted },
    }),
    [colors, isLight],
  );

  const canSubmit =
    (isAnyPersonTransfer || isStandardTransfer || Boolean(label.trim())) &&
    Boolean(amount) &&
    parseMoney(amount) > 0 &&
    Boolean(categoryId) &&
    (!isPersonTransferTo || Boolean(transferReason.trim())) &&
    (!isStandardTransfer || accountId !== destinationAccountId);

  const scrollToAmountSection = () => {
    if (isStandardTransfer) return;

    Keyboard.dismiss();
    requestAnimationFrame(() => {
      setTimeout(() => {
        sheetScrollRef.current?.scrollTo({
          y: Math.max(amountSectionYRef.current - 16, 0),
          animated: true,
        });
      }, 220);
    });
  };

  const updateContactLabel = (value: string) => {
    setLabel(value);
    if (!usesContactField) return;
    setLinkedContactId(findContactByName(savedContacts, value)?.id ?? null);
  };

  const isKnownContactName = (name: string) => {
    const normalized = normalizeSearch(name);
    if (!normalized) return false;
    return contactDirectoryRows.some((row) => row.key === normalized);
  };

  const selectNameSuggestion = (name: string) => {
    tapHaptic();
    setLabel(name);
    if (usesContactField) {
      setLinkedContactId(resolveContactIdForName(savedContacts, name));
    }
    scrollToAmountSection();
  };

  const handleCreateContact = async () => {
    const name = label.trim();
    if (!name || isKnownContactName(name) || linkedContactId) return;

    setCreatingContact(true);
    setFormFeedback(null);
    try {
      const contact = await upsertContactByName(name);
      setSavedContacts((current) => {
        const key = contact.normalizedName;
        const without = current.filter((item) => item.normalizedName !== key);
        return [...without, contact].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      });
      setLinkedContactId(contact.id);
      successHaptic();
    } catch {
      setFormFeedback(formValidationError('Erreur', 'Impossible de créer ce contact.'));
    } finally {
      setCreatingContact(false);
    }
  };

  const save = async () => {
    const saveAsPersonTransferTo = isPersonTransferTo;
    const saveAsPersonTransferFrom = isPersonTransferFrom;
    const saveAsStandardTransfer = isStandardTransfer;
    const persistedType: TransactionType = saveAsPersonTransferTo
      ? 'expense'
      : saveAsPersonTransferFrom
        ? 'income'
        : type;

    if (isAnyPersonTransfer && !label.trim()) {
      setFormFeedback(formValidationError('Champ requis', 'Indique le nom du contact.'));
      return;
    }
    if (saveAsPersonTransferTo && !transferReason.trim()) {
      setFormFeedback(formValidationError('Champ requis', 'Indique la raison du transfert.'));
      return;
    }
    if (!isAnyPersonTransfer && !saveAsStandardTransfer && !label.trim()) {
      setFormFeedback(formValidationError('Champ requis', 'Indiquez un marchand ou une description.'));
      return;
    }
    const itemNotes =
      persistedType === 'expense' && !saveAsPersonTransferTo
        ? itemizedRowsToNotePayload(itemizedExpenses, categoryById, categoryId, label.trim())
        : [];
    const parsed = parseMoney(amount);
    if (!parsed || parsed <= 0) {
      setFormFeedback(formValidationError('Montant invalide', 'Saisissez un montant positif.'));
      return;
    }
    if (!categoryId) {
      setFormFeedback(formValidationError('Catégorie', 'Choisissez une catégorie.'));
      return;
    }
    if (saveAsStandardTransfer && accountId === destinationAccountId) {
      setFormFeedback(formValidationError('Transfert invalide', 'Choisis deux comptes différents.'));
      return;
    }

    let note = saveAsPersonTransferTo
      ? `compte:${accountId}\ndestinataire:${label.trim()}\nraison:${transferReason.trim()}`
      : saveAsPersonTransferFrom
        ? [
            `compte:${accountId}`,
            `expediteur:${label.trim()}`,
            transferReason.trim() ? `raison:${transferReason.trim()}` : null,
          ]
            .filter(Boolean)
            .join('\n')
        : saveAsStandardTransfer
          ? transferReason.trim()
            ? `transfert:${accountId}->${destinationAccountId}\nmotif:${transferReason.trim()}`
            : `transfert:${accountId}->${destinationAccountId}`
          : type === 'income' && label.trim()
            ? `compte:${accountId}\nsource:${label.trim()}`
            : itemNotes.length > 0
              ? `compte:${accountId}\narticles:${JSON.stringify(itemNotes)}`
              : `compte:${accountId}`;

    const resolvedContactId =
      linkedContactId ?? resolveContactIdForName(savedContacts, label.trim()) ?? null;
    if (
      resolvedContactId &&
      (saveAsPersonTransferTo || saveAsPersonTransferFrom || type === 'income')
    ) {
      note = appendContactIdToNote(note, resolvedContactId);
    }
    const nextDeltas = getTransactionAccountDeltas({ amount: parsed, type: persistedType, note });
    const insufficientFunds = findInsufficientFundsViolation(
      simulatedAccounts,
      nextDeltas,
      editingTransaction,
    );
    if (insufficientFunds) {
      setFormFeedback(
        formValidationError(
          'Fonds insuffisants',
          `Le solde de ${insufficientFunds.accountLabel} est insuffisant pour cette opération.`,
        ),
      );
      return;
    }

    setFormFeedback(null);

    if (saveAsStandardTransfer) {
      await upsertCategory(TRANSFER_CATEGORY);
    }

    setSaving(true);
    const srcLabel = sourceEndpoint?.label ?? sourceAccount.label;
    const dstLabel = destinationEndpoint?.label ?? destinationAccount.label;
    const autoTransferLabel = buildAutoTransferLabel(srcLabel, dstLabel);
    const transactionLabel = saveAsPersonTransferTo
      ? label.trim()
      : saveAsPersonTransferFrom
        ? transferReason.trim() || label.trim()
        : saveAsStandardTransfer
          ? transferReason.trim() || autoTransferLabel
          : label.trim();
    const transactionDate = toTransactionDate(date);
    const transactionIcon = saveAsStandardTransfer
      ? 'SwapHoriz'
      : iconPickedManually
        ? fallbackIcon
        : labelHasLogo
          ? null
          : persistedType === 'expense' && isExpenseDefaultIcon(fallbackIcon)
            ? null
            : fallbackIcon;
    const normalizedReceiptUri = persistedType === 'expense' && !saveAsPersonTransferTo ? receiptUri.trim() : '';
    const normalizedReceiptStatus =
      persistedType === 'expense' && !saveAsPersonTransferTo
        ? receiptStatus === 'scan_pending'
          ? receiptStatus
          : normalizedReceiptUri
            ? 'attached'
            : null
        : null;

    const tx = editingTransaction
      ? {
          ...editingTransaction,
          label: transactionLabel,
          amount: parsed,
          type: persistedType,
          date: transactionDate,
          categoryId: saveAsStandardTransfer ? TRANSFER_CATEGORY.id : categoryId,
          transactionIcon,
          receiptUri: normalizedReceiptUri || (normalizedReceiptStatus === 'scan_pending' ? receiptUri : null),
          receiptStatus: normalizedReceiptStatus,
          note,
        }
      : createLocalTransaction({
      label: transactionLabel,
      amount: parsed,
      type: persistedType,
      date: transactionDate,
      categoryId: saveAsStandardTransfer ? TRANSFER_CATEGORY.id : categoryId,
      transactionIcon,
      receiptUri: normalizedReceiptUri || (normalizedReceiptStatus === 'scan_pending' ? receiptUri : null),
      receiptStatus: normalizedReceiptStatus,
      note,
    });
    await insertTransaction({
      id: tx.id,
      label: tx.label,
      amount: tx.amount,
      type: tx.type,
      date: tx.date,
      categoryId: tx.categoryId,
      transactionIcon: tx.transactionIcon,
      receiptUri: tx.receiptUri,
      receiptStatus: tx.receiptStatus,
      note: tx.note,
      syncStatus: 'pending',
    });

    if (editingTransaction) {
      const previousDeltas = getTransactionAccountDeltas(editingTransaction);
      const nextDeltas = getTransactionAccountDeltas({ amount: parsed, type: persistedType, note });
      for (const delta of previousDeltas) {
        await adjustSimulatedAccountBalance(delta.id, -delta.delta);
      }
      for (const delta of nextDeltas) {
        await adjustSimulatedAccountBalance(delta.id, delta.delta);
      }
      if (editingTransaction.type === 'transfer') {
        await applyLinkedSavingsGoalDeltas(simulatedAccounts, previousDeltas, -1);
      }
      if (saveAsStandardTransfer) {
        await applyLinkedSavingsGoalDeltas(simulatedAccounts, nextDeltas);
      }
    } else if (saveAsStandardTransfer) {
      if (sourceEndpoint?.kind === 'goal') {
        await adjustSavingsGoalCurrentAmount(sourceEndpoint.id, -parsed);
      } else if (sourceAccount.isSimulated) {
        await adjustSimulatedAccountBalance(sourceAccount.id, -parsed);
      }
      if (destinationEndpoint?.kind === 'goal') {
        await adjustSavingsGoalCurrentAmount(destinationEndpoint.id, parsed);
      } else if (destinationAccount.isSimulated) {
        await adjustSimulatedAccountBalance(destinationAccount.id, parsed);
      }
      if (sourceEndpoint?.kind !== 'goal' && destinationEndpoint?.kind !== 'goal') {
        await applyLinkedSavingsGoalDeltas(
          simulatedAccounts,
          getTransactionAccountDeltas({ amount: parsed, type: persistedType, note }),
        );
      }
    } else if (sourceAccount.isSimulated) {
      await adjustSimulatedAccountBalance(sourceAccount.id, persistedType === 'income' ? parsed : -parsed);
    }
    await syncWithServer();
    setSaving(false);
    successHaptic();
    router.back();
  };

  return (
    <View style={[styles.screen, styles.modalBackdrop, themed.modalBackdrop]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalKeyboard}
      >
        <ScrollView
              ref={sheetScrollRef}
              style={[styles.sheet, themed.sheet]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
            >
              <View style={[styles.handle, themed.handle]} />
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, themed.text]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                  {sheetTitle}
                </Text>
                <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.sheetClose, themed.closeButton]}>
                  <Ionicons name="close" size={19} color={colors.textMuted} />
                </Pressable>
              </View>

              {!routeType && (
                <View style={styles.section}>
                  <DashboardSectionLabel>Type</DashboardSectionLabel>
                  <View style={styles.wrapRow}>
                    {(['expense', 'income', 'transfer'] as const).map((t) => {
                      const on = type === t;
                      return (
                        <Pressable
                          key={t}
                          onPress={() => {
                            tapHaptic();
                            setCategoryManuallySelected(false);
                            if (t !== 'transfer') {
                              setTransferMode('accounts');
                              setTransferReason('');
                            }
                            setLinkedContactId(null);
                            setType(t);
                          }}
                          style={[styles.chip, themed.control, styles.chipShell, on && themed.selected]}
                        >
                          <Text
                            style={[styles.chipText, singleLineLabelStyle, themed.text, on && themed.selectedText]}
                            {...chipLabelTextProps()}
                          >
                            {t === 'expense' ? 'Dépense' : t === 'income' ? 'Revenu' : 'Transfert'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {isTransfer ? (
                <TransferModePicker
                  value={transferMode}
                  onChange={(mode) => {
                    setCategoryManuallySelected(false);
                    setTransferMode(mode);
                    if (mode === 'person' || mode === 'person_from') {
                      setTransferReason('');
                      setLinkedContactId(null);
                    }
                  }}
                />
              ) : null}

              {!isStandardTransfer ? (
                <View
                  style={styles.section}
                  onLayout={(e) => { nameSectionYRef.current = e.nativeEvent.layout.y; }}
                >
                  <DashboardSectionLabel>
                    {type === 'income'
                      ? 'Source du revenu'
                      : isPersonTransferFrom
                        ? 'Contact (expéditeur)'
                        : isPersonTransferTo
                          ? 'Contact'
                          : 'Marchand / paiement'}
                  </DashboardSectionLabel>
                  <TextInput
                    ref={labelInputRef}
                    style={[styles.input, themed.controlStrong, themed.text]}
                    placeholder={
                      type === 'income'
                        ? 'Ex. Paie, pension, employeur...'
                        : isAnyPersonTransfer
                          ? 'Ex. Marie, Jean, loyer à un ami...'
                          : 'Ex. Starbucks, loyer, épicerie...'
                    }
                    placeholderTextColor={colors.textMuted}
                    value={label}
                    onChangeText={usesContactField ? updateContactLabel : setLabel}
                  />
                  {hasNameSuggestions ? (
                    <View style={styles.suggestionRow}>
                      {(usesContactField ? contactSuggestions : merchantSuggestions).map((name) => (
                        <Pressable
                          key={name}
                          onPress={() => selectNameSuggestion(name)}
                          style={({ pressed }) => [styles.suggestionChip, themed.control, pressed && styles.pressed]}
                        >
                          <Ionicons
                            name={usesContactField ? 'person-outline' : 'sparkles-outline'}
                            size={13}
                            color={colors.textMuted}
                          />
                          <Text style={[styles.suggestionText, themed.text]} numberOfLines={1}>
                            {name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {usesContactField && label.trim() && !linkedContactId && !isKnownContactName(label) ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Créer le contact"
                      onPress={() => void handleCreateContact()}
                      disabled={creatingContact}
                      style={({ pressed }) => [
                        styles.createContactButton,
                        themed.control,
                        pressed && styles.pressed,
                        creatingContact && styles.createContactButtonDisabled,
                      ]}
                    >
                      <Ionicons name="person-add-outline" size={16} color={colors.primary} />
                      <Text style={[styles.createContactButtonText, themed.selectedText]}>
                        {creatingContact ? 'Création...' : 'Créer le contact'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {usesContactField && linkedContactId ? (
                    <Text style={[styles.linkedContactHint, themed.textMuted]}>
                      Lié au contact existant — aucun doublon ne sera créé.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {isPersonTransferTo ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Raison du transfert</DashboardSectionLabel>
                  <TextInput
                    style={[styles.input, themed.controlStrong, themed.text]}
                    placeholder="Ex. remboursement repas, cadeau anniversaire, part du loyer..."
                    placeholderTextColor={colors.textMuted}
                    value={transferReason}
                    onChangeText={(value) => {
                      setTransferReason(value);
                      setCategoryManuallySelected(false);
                    }}
                  />
                </View>
              ) : null}

              {isPersonTransferFrom ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Description (optionnel)</DashboardSectionLabel>
                  <TextInput
                    style={[styles.input, themed.controlStrong, themed.text]}
                    placeholder="Ex. remboursement, cadeau, partage de frais..."
                    placeholderTextColor={colors.textMuted}
                    value={transferReason}
                    onChangeText={setTransferReason}
                  />
                </View>
              ) : null}

              <View
                style={styles.amountWrap}
                onLayout={(event) => {
                  amountSectionYRef.current = event.nativeEvent.layout.y;
                }}
              >
                <Text
                  style={[styles.amountText, themed.text, { fontSize: amountFontSize(amount) }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.35}
                >
                  {displayAmount}
                </Text>
              </View>

              <MotiView
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 260 }}
              >
                <GhostNumpad value={amount} onChange={setAmount} />
              </MotiView>

              <DatePickerField
                label="Date"
                value={date}
                placeholder="Choisir une date"
                variant="sheet"
                onChangeDate={setDate}
              />

              {type === 'expense' ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Compte utilisé comme paiement</DashboardSectionLabel>
                  <View style={styles.accountRow}>
                    {accountOptions.map((a) => {
                      const on = accountId === a.id;
                      return (
                        <Pressable
                          key={a.id}
                          onPress={() => {
                            tapHaptic();
                            setAccountId(a.id);
                          }}
                          style={[styles.accountChip, themed.control, styles.chipShell, on && themed.selected]}
                        >
                          <Text
                            style={[styles.accountText, singleLineLabelStyle, themed.text, on && themed.selectedText]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            adjustsFontSizeToFit
                            minimumFontScale={0.78}
                          >
                            {a.label.replace(' • ', '\n')}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {type === 'expense' && !hasItemizedItems ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Catégorie</DashboardSectionLabel>
                  <BudgetCategoryPicker
                    categories={visibleCats}
                    searchText={categorySearchText}
                    selectedId={categoryId}
                    onSelect={(id) => {
                      setCategoryManuallySelected(true);
                      setCategoryId(id);
                    }}
                  />
                </View>
              ) : null}

              {!isTransfer ? (
                <View style={[styles.logoSection, themed.control]}>
                  <View style={styles.logoHeader}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Changer le logo ou l'icône"
                      onPress={() => {
                        tapHaptic();
                        setShowLogoPicker((visible) => !visible);
                      }}
                    >
                      {autoLogoUrl && !iconPickedManually ? (
                        <LogoIconFrame uri={autoLogoUrl} size={52} />
                      ) : (
                        <UserPickedIconBadge icon={fallbackIcon} color={fallbackIconColor} size={52} iconSize={22} />
                      )}
                    </Pressable>
                    <View style={styles.logoCopy}>
                      <DashboardSectionLabel>Logo</DashboardSectionLabel>
                      <Text style={[styles.logoHint, themed.textMuted]}>
                        {autoLogoUrl && !iconPickedManually
                          ? 'Logo automatique trouvé avec le nom.'
                          : 'Touche l\'icône pour choisir dans la bibliothèque MDI.'}
                      </Text>
                    </View>
                  </View>

                  {showLogoPicker ? (
                    <View style={styles.logoPicker}>
                      {autoLogoUrl ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Utiliser le logo automatique"
                          onPress={() => {
                            tapHaptic();
                            setIconPickedManually(false);
                            setShowLogoPicker(false);
                          }}
                          style={({ pressed }) => [styles.logoOption, themed.control, pressed && styles.pressed]}
                        >
                          <LogoIconFrame uri={autoLogoUrl} size={40} />
                          <Text style={[styles.logoPickerHint, themed.textMuted]}>Auto</Text>
                        </Pressable>
                      ) : null}
                      <Text style={[styles.logoPickerHint, themed.textMuted]}>Icônes MDI</Text>
                      <MdiIconPicker
                        selectedIcon={fallbackIcon}
                        onSelect={(icon: MdiIconName) => {
                          setFallbackIcon(icon);
                          setIconPickedManually(true);
                          setShowLogoPicker(false);
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}

              {type !== 'expense' && !isTransfer ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Compte de dépôt</DashboardSectionLabel>
                  <View style={styles.accountRow}>
                    {accountOptions.map((a) => {
                      const on = accountId === a.id;
                      return (
                        <Pressable
                          key={a.id}
                          onPress={() => { tapHaptic(); setAccountId(a.id); }}
                          style={[styles.accountChip, themed.control, styles.chipShell, on && themed.selected]}
                        >
                          <Text
                            style={[styles.accountText, singleLineLabelStyle, themed.text, on && themed.selectedText]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            adjustsFontSizeToFit
                            minimumFontScale={0.78}
                          >
                            {a.label.replace(' • ', '\n')}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {isStandardTransfer ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Raison du transfert</DashboardSectionLabel>
                  <TextInput
                    style={[styles.input, themed.controlStrong, themed.text]}
                    placeholder="Motif (optionnel) — ex. épargne vacances, remboursement..."
                    placeholderTextColor={colors.textMuted}
                    value={transferReason}
                    onChangeText={setTransferReason}
                  />
                </View>
              ) : null}

              {isPersonTransferTo ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Catégorie</DashboardSectionLabel>
                  <BudgetCategoryPicker
                    categories={visibleCats}
                    searchText={categorySearchText}
                    selectedId={categoryId}
                    transferReason={transferReason}
                    onSelect={(id) => {
                      setCategoryManuallySelected(true);
                      setCategoryId(id);
                    }}
                  />
                </View>
              ) : null}

              {isPersonTransferFrom ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Compte de dépôt</DashboardSectionLabel>
                  <View style={styles.accountRow}>
                    {accountOptions.map((a) => {
                      const on = accountId === a.id;
                      return (
                        <Pressable
                          key={a.id}
                          onPress={() => { tapHaptic(); setAccountId(a.id); }}
                          style={[styles.accountChip, themed.control, styles.chipShell, on && themed.selected]}
                        >
                          <Text
                            style={[styles.accountText, singleLineLabelStyle, themed.text, on && themed.selectedText]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            adjustsFontSizeToFit
                            minimumFontScale={0.78}
                          >
                            {a.label.replace(' • ', '\n')}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {isPersonTransferFrom ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Catégorie</DashboardSectionLabel>
                  <View style={styles.wrapRow}>
                    {visibleCats.map((c) => {
                      const on = categoryId === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => {
                            tapHaptic();
                            setCategoryManuallySelected(true);
                            setCategoryId(c.id);
                          }}
                          style={[styles.categoryChip, themed.control, styles.chipShell, on && themed.selected]}
                        >
                          <Ionicons
                            name={getCategoryIconName(c)}
                            size={14}
                            color={on ? colors.primary : colors.textSecondary}
                            style={styles.categoryChipIcon}
                          />
                          <Text
                            style={[styles.categoryChipText, singleLineLabelStyle, themed.text, on && themed.selectedText]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            adjustsFontSizeToFit
                            minimumFontScale={0.82}
                          >
                            {c.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {isStandardTransfer ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>De</DashboardSectionLabel>
                  {!hasTransferEndpoints ? (
                    <Text style={[styles.sectionHint, themed.textMuted]}>Aucun compte ou objectif trouvé.</Text>
                  ) : null}
                  {hasAccountOptions ? (
                    <>
                      <Text style={[styles.transferGroupLabel, themed.textMuted]}>Comptes</Text>
                      <View style={styles.accountRow}>
                        {accountOptions.map((a) => {
                          const on = accountId === a.id;
                          return (
                            <Pressable
                              key={a.id}
                              onPress={() => { tapHaptic(); setAccountId(a.id); }}
                              style={[styles.accountChip, themed.control, styles.chipShell, on && themed.selected]}
                            >
                              <Text
                                style={[styles.accountText, singleLineLabelStyle, themed.text, on && themed.selectedText]}
                                numberOfLines={2}
                                ellipsizeMode="tail"
                                adjustsFontSizeToFit
                                minimumFontScale={0.78}
                              >
                                {a.label.replace(' • ', '\n')}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                  {hasSavingsGoalsList ? (
                    <>
                      <Text style={[styles.transferGroupLabel, themed.textMuted]}>{'Objectifs d\u2019épargne'}</Text>
                      <View style={styles.accountRow}>
                        {savingsGoals.map((g) => {
                          const on = accountId === g.id;
                          return (
                            <Pressable
                              key={g.id}
                              onPress={() => { tapHaptic(); setAccountId(g.id); }}
                              style={[styles.transferGoalChip, themed.control, styles.chipShell, on && themed.selected]}
                            >
                              <TransferGoalChipIcon
                                icon={g.icon}
                                selected={on}
                                selectedColor={colors.primary}
                                mutedColor={colors.textSecondary}
                              />
                              <Text
                                style={[styles.transferGoalName, singleLineLabelStyle, themed.text, on && themed.selectedText]}
                                {...chipLabelTextProps()}
                              >
                                {g.name}
                              </Text>
                              <Text
                                style={[styles.transferGoalBalance, singleLineLabelStyle, on ? themed.selectedText : themed.textMuted]}
                                {...chipLabelTextProps()}
                              >
                                {Math.round(g.currentAmount).toLocaleString('fr-CA')} $
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                </View>
              ) : null}

              {isPersonTransferTo ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Compte source</DashboardSectionLabel>
                  {!hasAccountOptions ? (
                    <Text style={[styles.sectionHint, themed.textMuted]}>Aucun compte trouvé.</Text>
                  ) : (
                    <View style={styles.accountRow}>
                      {accountOptions.map((a) => {
                        const on = accountId === a.id;
                        return (
                          <Pressable
                            key={a.id}
                            onPress={() => { tapHaptic(); setAccountId(a.id); }}
                            style={[styles.accountChip, themed.control, styles.chipShell, on && themed.selected]}
                          >
                            <Text
                              style={[styles.accountText, singleLineLabelStyle, themed.text, on && themed.selectedText]}
                              numberOfLines={2}
                              ellipsizeMode="tail"
                              adjustsFontSizeToFit
                              minimumFontScale={0.78}
                            >
                              {a.label.replace(' • ', '\n')}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              ) : null}

              {isStandardTransfer ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Vers</DashboardSectionLabel>
                  {hasAccountOptions ? (
                    <>
                      <Text style={[styles.transferGroupLabel, themed.textMuted]}>Comptes</Text>
                      <View style={styles.accountRow}>
                        {accountOptions.map((a) => {
                          const on = destinationAccountId === a.id;
                          return (
                            <Pressable
                              key={a.id}
                              onPress={() => { tapHaptic(); setDestinationAccountId(a.id); }}
                              style={[styles.accountChip, themed.control, styles.chipShell, on && themed.selected]}
                            >
                              <Text
                                style={[styles.accountText, singleLineLabelStyle, themed.text, on && themed.selectedText]}
                                numberOfLines={2}
                                ellipsizeMode="tail"
                                adjustsFontSizeToFit
                                minimumFontScale={0.78}
                              >
                                {a.label.replace(' • ', '\n')}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                  {hasSavingsGoalsList ? (
                    <>
                      <Text style={[styles.transferGroupLabel, themed.textMuted]}>{'Objectifs d\u2019épargne'}</Text>
                      <View style={styles.accountRow}>
                        {savingsGoals.map((g) => {
                          const on = destinationAccountId === g.id;
                          return (
                            <Pressable
                              key={g.id}
                              onPress={() => { tapHaptic(); setDestinationAccountId(g.id); }}
                              style={[styles.transferGoalChip, themed.control, styles.chipShell, on && themed.selected]}
                            >
                              <TransferGoalChipIcon
                                icon={g.icon}
                                selected={on}
                                selectedColor={colors.primary}
                                mutedColor={colors.textSecondary}
                              />
                              <Text
                                style={[styles.transferGoalName, singleLineLabelStyle, themed.text, on && themed.selectedText]}
                                {...chipLabelTextProps()}
                              >
                                {g.name}
                              </Text>
                              <Text
                                style={[styles.transferGoalBalance, singleLineLabelStyle, on ? themed.selectedText : themed.textMuted]}
                                {...chipLabelTextProps()}
                              >
                                {Math.round(g.currentAmount).toLocaleString('fr-CA')} $
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                  {accountId === destinationAccountId ? (
                    <Text style={[styles.transferWarning, { color: colors.warning }]}>Sélectionne deux sources différentes.</Text>
                  ) : null}
                </View>
              ) : null}

              {type === 'income' ? (
                <View style={styles.section}>
                  <DashboardSectionLabel>Catégorie</DashboardSectionLabel>
                  <View style={styles.wrapRow}>
                    {visibleCats.map((c) => {
                      const on = categoryId === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => {
                            tapHaptic();
                            setCategoryManuallySelected(true);
                            setCategoryId(c.id);
                          }}
                          style={[styles.categoryChip, themed.control, styles.chipShell, on && themed.selected]}
                        >
                          <Ionicons
                            name={getCategoryIconName(c)}
                            size={14}
                            color={on ? colors.primary : colors.textSecondary}
                            style={styles.categoryChipIcon}
                          />
                          <Text
                            style={[styles.categoryChipText, singleLineLabelStyle, themed.text, on && themed.selectedText]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            adjustsFontSizeToFit
                            minimumFontScale={0.82}
                          >
                            {c.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {type === 'expense' ? (
                <View style={styles.section}>
                  <ItemizedArticlesEditor
                    items={itemizedExpenses}
                    categories={visibleCats}
                    merchantHint={label}
                    onChange={(next) => {
                      const cleaned = next.filter((item, index) => index === 0 || item.name.trim() || item.price.trim());
                      setItemizedExpenses(cleaned.length > 0 ? cleaned : [createEmptyItemizedRow()]);
                    }}
                  />
                </View>
              ) : null}

              {type === 'expense' ? (
                <View style={styles.section}>
                  <View style={styles.sectionTitleRow}>
                    <DashboardSectionLabel>Reçu (optionnel)</DashboardSectionLabel>
                    {receiptUri.trim() || receiptStatus ? (
                      <View style={[styles.receiptStatusPill, themed.control]}>
                        <Ionicons name="receipt-outline" size={13} color={colors.textMuted} />
                        <Text style={[styles.receiptStatusText, themed.textMuted]}>
                          {receiptStatus === 'scan_pending' ? 'À scanner' : 'Joint'}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <ReceiptCaptureActions
                    variant="premium"
                    onScan={openDedicatedScan}
                    onCapture={() => void captureReceiptImage()}
                    onImport={() => void pickReceiptImage()}
                  />

                  {scanningReceipt ? (
                    <Text style={[styles.sectionHint, themed.textMuted]}>Analyse du reçu en cours…</Text>
                  ) : null}
                </View>
              ) : null}

              {formFeedback ? (
                <ThemedFormMessage
                  variant={formFeedback.variant}
                  title={formFeedback.title}
                  message={formFeedback.message}
                />
              ) : null}

              <PrimarySaveButton
                label={saving ? 'Enregistrement...' : isEditing ? 'Enregistrer les modifications' : 'Enregistrer'}
                onPress={() => void save()}
                disabled={saving || !canSubmit}
              />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalKeyboard: { flex: 1, justifyContent: 'flex-end' },
  pressed: { opacity: 0.72 },
  sheet: {
    marginTop: 88,
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitle: {
    flex: 1,
    ...interExtraBoldText,
    fontSize: typography.title,
    letterSpacing: -0.4,
  },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 2,
  },
  amountText: {
    ...interExtraBoldText,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  section: { gap: spacing.sm },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  receiptSectionCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionHint: {
    ...interMediumText,
    fontSize: typography.micro,
    lineHeight: 17,
    marginTop: 2,
  },
  input: {
    minHeight: 50,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...interBoldText,
    fontSize: typography.body,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  createContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  createContactButtonDisabled: {
    opacity: 0.6,
  },
  createContactButtonText: {
    ...interBoldText,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  linkedContactHint: {
    ...interMediumText,
    fontSize: typography.micro,
    lineHeight: 15,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  suggestionText: {
    ...interBoldText,
    fontSize: typography.meta,
    maxWidth: 138,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  addItemText: {
    ...interExtraBoldText,
    fontSize: typography.caption,
  },
  itemCard: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  itemNameWrap: {
    flex: 1,
    gap: 5,
  },
  itemInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    fontSize: typography.caption,
  },
  priceInputWrap: {
    width: 92,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: spacing.sm,
    paddingRight: 9,
  },
  priceInput: {
    minWidth: 0,
    flex: 1,
    paddingVertical: 9,
    ...interBoldText,
    fontSize: typography.caption,
    textAlign: 'right',
  },
  priceCurrency: {
    marginLeft: spacing.xs,
    ...interExtraBoldText,
    fontSize: typography.meta,
  },
  removeItemBtn: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCategoryBlock: {
    gap: 6,
  },
  itemCategorySummary: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
  },
  itemCategoryLabel: {
    ...interExtraBoldText,
    fontSize: typography.micro,
    paddingHorizontal: 2,
  },
  changeCategoryBtn: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeCategoryText: {
    ...interExtraBoldText,
    fontSize: typography.micro,
  },
  itemCategoryPicker: {
    gap: 6,
  },
  categorySearchInput: {
    minHeight: 40,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...interBoldText,
    fontSize: typography.caption,
  },
  itemCategoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemCategoryChip: {
    minWidth: 0,
    flexShrink: 1,
    maxWidth: '100%',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  itemCategoryChipText: {
    ...interExtraBoldText,
    fontSize: typography.micro,
    lineHeight: 15,
    flexShrink: 1,
  },
  detectedCategory: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detectedCategoryText: {
    fontSize: 11,
    fontWeight: '800',
    maxWidth: 150,
  },
  itemTotalText: {
    ...interExtraBoldText,
    fontSize: typography.meta,
    textAlign: 'right',
  },
  inlineScanControl: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineScanLabel: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineScanText: {
    flexShrink: 1,
    ...interExtraBoldText,
    fontSize: typography.meta,
  },
  receiptStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  receiptStatusText: {
    ...interExtraBoldText,
    fontSize: typography.micro,
  },
  receiptAttachButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  receiptActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  receiptAction: {
    flexGrow: 1,
    flexBasis: '31%',
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  receiptActionText: {
    ...interExtraBoldText,
    fontSize: typography.meta,
    textAlign: 'center',
  },
  premiumBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 2,
  },
  premiumBadgeText: {
    ...interExtraBoldText,
    fontSize: 10,
  },
  logoSection: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.md,
  },
  logoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  logoHint: {
    ...interMediumText,
    fontSize: typography.micro,
    lineHeight: 15,
  },
  logoEditButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPicker: {
    gap: 10,
  },
  logoPickerHint: {
    ...interExtraBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.2,
  },
  logoOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  logoOption: {
    width: 54,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
  },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipShell: {
    borderWidth: CHIP_BORDER_WIDTH,
  },
  chip: {
    flexGrow: 1,
    flexShrink: 0,
    minWidth: TYPE_TRANSACTION_CHIP_MIN_WIDTH,
    borderRadius: radius.md,
    paddingHorizontal: CHIP_PADDING_HORIZONTAL,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChip: {
    maxWidth: '100%',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  categoryChipIcon: {
    marginRight: 5,
  },
  chipText: {
    ...interBoldText,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: '100%',
  },
  categoryChipText: {
    ...interBoldText,
    fontSize: typography.meta,
    lineHeight: 16,
    flexShrink: 1,
  },
  accountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  accountChip: {
    flexGrow: 1,
    flexBasis: '31%',
    minHeight: 66,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: spacing.sm,
  },
  accountText: {
    textAlign: 'center',
    ...interBoldText,
    fontSize: typography.micro,
    lineHeight: 15,
    flexShrink: 1,
  },
  transferWarning: {
    ...interBoldText,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  transferGroupLabel: {
    ...interMediumText,
    fontSize: typography.micro,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
    marginBottom: 2,
  },
  transferGoalChip: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 66,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  transferGoalName: {
    textAlign: 'center',
    ...interBoldText,
    fontSize: typography.micro,
    lineHeight: 15,
    flexShrink: 1,
  },
  transferGoalBalance: {
    textAlign: 'center',
    ...interMediumText,
    fontSize: typography.micro,
    lineHeight: 14,
  },
});

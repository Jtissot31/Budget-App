import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  Dimensions,
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddArticleSheet } from '@/components/AddArticleSheet';
import { PaymentMethodField, type PaymentMethodAccount } from '@/components/PaymentMethodField';
import { BudgetCategoryPicker } from '@/components/BudgetCategoryPicker';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { GhostNumpad } from '@/components/GhostNumpad';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { TransferModePicker, type TransferMode } from '@/components/TransferModePicker';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { formValidationError, type FormFeedback } from '@/lib/formFeedback';
import { DatePickerField } from '@/components/MinimalDatePicker';
import {
  articlesReceiptTypography,
  CHIP_BORDER_WIDTH,
  CHIP_PADDING_HORIZONTAL,
  TYPE_TRANSACTION_CHIP_MIN_WIDTH,
  ICON_WELL_SIZE,
  chipSelectableShellStyle,
  colors,
  containerSurfaceStyle,
  detailSectionLabelStyle,
  detailSubSectionHeaderStyle,
  jakartaBoldText,
  jakartaExtraBoldText,
  jakartaMediumText,
  radius,
  spacing,
  tagContainerStyle,
  tagTypography,
  typography,
  typographyKit,
} from '@/constants/theme';
import { chipLabelTextProps, singleLineLabelStyle } from '@/lib/textLayout';
import { hasMerchantLogoCandidate } from '@/components/TransactionAvatar';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import {
  TRANSFER_CATEGORY,
  UNCATEGORIZED_TRANSACTION_CATEGORY,
  getCategoryIconName,
  type IconName,
} from '@/constants/categoryOptions';
import { EXPENSE_DEFAULT_ICON, isExpenseDefaultIcon } from '@/lib/expenseIcon';
import { EXPENSE_MDI_ICON } from '@/lib/mdiIconCatalog';
import { MANUAL_ENTRY_ACCOUNTS } from '@/constants/manualEntryAccounts';
import { KNOWN_MERCHANT_NAMES } from '@/lib/merchantLogo';
import { useAppTheme } from '@/lib/themeContext';
import {
  adjustSavingsGoalCurrentAmount,
  adjustSimulatedAccountBalance,
  filterActiveCategoryBudgets,
  getCategories,
  getCategoryBudgets,
  getContacts,
  getLoans,
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
  isRegisteredEmployerName,
  resemblesExistingContact,
  resolveContactIdForName,
  searchContactSuggestions,
  searchIncomeSourceSuggestions,
} from '@/lib/contactHistory';
import { TransactionAmountLabel, type TransactionAmountDirection } from '@/components/TransactionAmountLabel';
import { formatMoneyAmountInput } from '@/lib/formatMoneyAmountInput';
import {
  formatNumberDisplay,
  formatNumberInputFromValue,
  parseFormattedNumber,
  parseFormattedNumberOrZero,
} from '@/lib/formatNumber';
import {
  inferCategoryId,
  inferCategoryIdFromTransferReason,
  normalizeSearch,
} from '@/lib/categoryInference';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import { buildArticlesNoteLine, getRemainingArticleBudget, isArticlePriceWithinBudget, parseItemizedNote, type ItemizedNote } from '@/lib/itemizedNote';
import { parseScanItemsFromRoute } from '@/lib/receiptScan';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { getLocalDateInputValue, toLocalDateInputValue } from '@/lib/localDateInput';
import { createLocalTransaction, syncWithServer } from '@/lib/sync';
import {
  getIncomeReasonSuggestions,
  resolveIncomeReasonForSelectedContact,
  saveIncomeReasonSuggestion,
} from '@/lib/incomeReasonSuggestions';
import {
  getEmployerIncomeAccountMap,
  resolveIncomeAccountForSelectedContact,
  saveEmployerIncomeAccount,
  type EmployerIncomeAccountMap,
} from '@/lib/incomeAccountPreferences';
import {
  getTransferReasonSuggestions,
  saveTransferReasonSuggestion,
} from '@/lib/transferReasonSuggestions';
import type { AccountKind, Category, Contact, Loan, SavingsGoal, SimulatedAccount, Transaction, TransactionType } from '@/types';
import { getChildSupportSalaryNotices } from '@/lib/childSupportLoan';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

type TransferEntryStep = 'reason' | 'amount';

/** Tracks whether an income source was picked from the suggestion list (not typed or created). */
type IncomeContactPickStatus = 'none' | 'employer' | 'contact';

type FormFieldKey =
  | 'label'
  | 'transferReason'
  | 'incomeReason'
  | 'amount'
  | 'category'
  | 'sourceAccount'
  | 'destinationAccount';

type PaymentAccountOption = {
  id: string;
  label: string;
  isSimulated: boolean;
};

function manualAccountKind(accountId: string): AccountKind {
  if (accountId === 'credit') return 'credit';
  if (accountId === 'savings') return 'savings';
  return 'checking';
}
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
  return parseFormattedNumberOrZero(raw);
}

function formatMoneyInput(value: number): string {
  return formatNumberInputFromValue(value);
}

function toDateInputValue(value: string): string {
  return toLocalDateInputValue(value);
}

function toTransactionDate(value: string): string {
  const day = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return new Date().toISOString();
  return new Date(`${day}T12:00:00`).toISOString();
}

function resolveExpenseCategoryId(
  articles: ItemizedNote[],
  merchantLabel: string,
  categories: Category[],
  inferredId: string | null,
  manualCategoryId: string | null,
  categoryManuallySelected: boolean,
): string | null {
  const fromArticle = articles.find((article) => article.categoryId)?.categoryId ?? null;
  if (fromArticle) return fromArticle;
  if (categoryManuallySelected && manualCategoryId) return manualCategoryId;
  if (inferredId) return inferredId;
  const trimmedMerchant = merchantLabel.trim();
  if (trimmedMerchant) {
    const fromMerchant = inferCategoryId(trimmedMerchant, categories, null);
    if (fromMerchant) return fromMerchant;
  }
  return UNCATEGORIZED_TRANSACTION_CATEGORY.id;
}

function isIconName(value?: string | null): value is IconName {
  return Boolean(value && value in Ionicons.glyphMap);
}

const TRANSFER_GOAL_ICON_WELL_SIZE = 22;
const TRANSFER_GOAL_ICON_GLYPH_SIZE = 13;

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
  accountDeltas: { id: string; delta: number }[],
  multiplier = 1,
  options?: { emit?: boolean },
) {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const goalDeltas = new Map<string, number>();

  for (const { id, delta } of accountDeltas) {
    const linkedGoalId = accountById.get(id)?.linkedSavingsGoalId?.trim();
    if (!linkedGoalId) continue;
    goalDeltas.set(linkedGoalId, (goalDeltas.get(linkedGoalId) ?? 0) + delta * multiplier);
  }

  for (const [goalId, delta] of goalDeltas) {
    await adjustSavingsGoalCurrentAmount(goalId, delta, options);
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
  const routeScanAmount = typeof params.amount === 'string' ? params.amount : '';
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetCategoryIds, setBudgetCategoryIds] = useState<Set<string>>(new Set());
  const [savedContacts, setSavedContacts] = useState<Contact[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [simulatedAccounts, setSimulatedAccounts] = useState<SimulatedAccount[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [prefilledEditId, setPrefilledEditId] = useState<string | null>(null);
  const [type, setType] = useState<TransactionType>('expense');
  const [label, setLabel] = useState('');
  const debouncedLabel = useDebouncedValue(label, 200);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getLocalDateInputValue);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryManuallySelected, setCategoryManuallySelected] = useState(false);
  const [accountId, setAccountId] = useState<string>(MANUAL_ENTRY_ACCOUNTS[0].id);
  const [destinationAccountId, setDestinationAccountId] = useState<string>(MANUAL_ENTRY_ACCOUNTS[1].id);
  const [transferMode, setTransferMode] = useState<TransferMode>('accounts');
  const [transferReason, setTransferReason] = useState('');
  const [transferReasonSuggestions, setTransferReasonSuggestions] = useState<string[]>([]);
  const [transferEntryStep, setTransferEntryStep] = useState<TransferEntryStep>('reason');
  const [incomeReason, setIncomeReason] = useState('');
  const [incomeReasonSuggestions, setIncomeReasonSuggestions] = useState<string[]>([]);
  const [employerIncomeAccountMap, setEmployerIncomeAccountMap] = useState<EmployerIncomeAccountMap>({});
  const [linkedContactId, setLinkedContactId] = useState<string | null>(null);
  const [incomeContactPickStatus, setIncomeContactPickStatus] = useState<IncomeContactPickStatus>('none');
  const [creatingContact, setCreatingContact] = useState(false);
  const [fallbackIcon, setFallbackIcon] = useState<string>(EXPENSE_MDI_ICON);
  const [articles, setArticles] = useState<ItemizedNote[]>([]);
  const [inlineArticleExpanded, setInlineArticleExpanded] = useState(false);
  const [scanPrefillApplied, setScanPrefillApplied] = useState(false);
  const [iconPickedManually, setIconPickedManually] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formFeedback, setFormFeedback] = useState<FormFeedback | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<FormFieldKey>>(() => new Set());
  const labelInputRef = useRef<TextInput>(null);
  const transferReasonInputRef = useRef<TextInput>(null);
  const sheetScrollRef = useRef<ScrollView>(null);
  const amountSectionYRef = useRef(0);
  const nameSectionYRef = useRef(0);
  const incomeSourceFieldBottomYRef = useRef(0);
  const transferReasonSectionYRef = useRef(0);
  const incomeReasonSectionYRef = useRef(0);
  const categorySectionYRef = useRef(0);
  const sourceAccountSectionYRef = useRef(0);
  const destinationAccountSectionYRef = useRef(0);
  const articlesSectionYRef = useRef(0);
  const inlineArticleLocalYRef = useRef(0);
  const lastAutocompleteScrollKeyRef = useRef('');
  const labelInputFocusedRef = useRef(false);
  const pendingIncomeContactScrollRef = useRef(false);

  const merchantSuggestions = useMemo(() => {
    if (type !== 'expense') return [];
    const query = normalizeSearch(debouncedLabel);
    if (query.length < 2) return [];

    return KNOWN_MERCHANT_NAMES.filter((merchant) => {
      const normalized = normalizeSearch(merchant);
      return normalized !== query && (normalized.startsWith(query) || normalized.includes(query));
    }).slice(0, 5);
  }, [debouncedLabel, type]);

  const contactDirectoryRows = useMemo(
    () => buildContactDirectoryRows(allTransactions, savedContacts),
    [allTransactions, savedContacts],
  );

  const contactSuggestions = useMemo(() => {
    const isContactField =
      type === 'income' ||
      (type === 'transfer' && (transferMode === 'person' || transferMode === 'person_from'));
    if (!isContactField) return [];
    if (type === 'income' && incomeContactPickStatus !== 'none') return [];
    if (type === 'income') {
      return searchIncomeSourceSuggestions(savedContacts, debouncedLabel, contactDirectoryRows, 8);
    }
    if (debouncedLabel.length < 3) return [];
    return searchContactSuggestions(savedContacts, debouncedLabel, 5, contactDirectoryRows);
  }, [contactDirectoryRows, debouncedLabel, incomeContactPickStatus, savedContacts, transferMode, type]);

  const incomeContactActions = useMemo(() => {
    if (type !== 'income' || !label.trim()) {
      return { showAddEmployer: false, showAddContact: false, isRegisteredEmployer: false };
    }

    const trimmed = label.trim();
    const resembles = resemblesExistingContact(savedContacts, trimmed, contactDirectoryRows);
    const isRegisteredEmployer = isRegisteredEmployerName(savedContacts, trimmed, contactDirectoryRows);

    return {
      showAddEmployer: !isRegisteredEmployer,
      showAddContact: !resembles,
      isRegisteredEmployer,
    };
  }, [contactDirectoryRows, label, savedContacts, type]);

  useEffect(() => {
    if (editId && prefilledEditId !== editId) return;

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
  }, [budgetCategoryIds, editId, editingTransaction, prefilledEditId, transferMode, type]);

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
    setArticles(
      scanned.map((item) => ({
        name: item.name,
        price: item.price,
        categoryId: item.categoryId ?? null,
        categoryName: null,
      })),
    );
    const scanTotal = scanned.reduce((sum, item) => sum + item.price, 0);
    if (scanTotal > 0) setAmount(formatMoneyInput(scanTotal));
    setScanPrefillApplied(true);
  }, [routeScanItems, scanPrefillApplied]);

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
    void getLoans().then(setLoans);
  }, []);

  useEffect(() => {
    if (type !== 'income') return;
    void getIncomeReasonSuggestions().then(setIncomeReasonSuggestions);
    void getEmployerIncomeAccountMap().then(setEmployerIncomeAccountMap);
  }, [type]);

  useEffect(() => {
    if (type !== 'transfer') return;
    void getTransferReasonSuggestions().then(setTransferReasonSuggestions);
  }, [type]);

  useEffect(() => {
    setInvalidFields((current) => (current.size === 0 ? current : new Set()));
    setFormFeedback((current) => (current === null ? current : null));
    setIncomeContactPickStatus((current) => (current === 'none' ? current : 'none'));
    pendingIncomeContactScrollRef.current = false;
    lastAutocompleteScrollKeyRef.current = '';
  }, [type, transferMode]);

  useEffect(() => {
    if (type !== 'expense') {
      setArticles((current) => (current.length === 0 ? current : []));
    }
  }, [type]);

  useEffect(() => {
    if (editId) return;
    if (type === 'expense') {
      setFallbackIcon(EXPENSE_DEFAULT_ICON);
      return;
    }
    setFallbackIcon((current) => (current === EXPENSE_DEFAULT_ICON ? 'receipt-outline' : current));
  }, [editId, type]);

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

  const paymentMethodAccounts = useMemo<PaymentMethodAccount[]>(() => {
    if (simulatedAccounts.length > 0) {
      return simulatedAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        last4: account.last4,
        kind: account.kind,
      }));
    }

    return MANUAL_ENTRY_ACCOUNTS.map((account) => ({
      id: account.id,
      name: account.label,
      kind: manualAccountKind(account.id),
    }));
  }, [simulatedAccounts]);

  const destinationPaymentMethodAccounts = useMemo(
    () => paymentMethodAccounts.filter((account) => account.id !== accountId),
    [accountId, paymentMethodAccounts],
  );

  const destinationSavingsGoals = useMemo(
    () => savingsGoals.filter((goal) => goal.id !== accountId),
    [accountId, savingsGoals],
  );

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
      sublabel: `${formatNumberDisplay(Math.round(g.currentAmount))} $`,
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
      setIncomeContactPickStatus('none');
      if (destinataire) {
        setType('transfer');
        setTransferMode('person');
        setLabel(destinataire);
        setTransferReason(parseRaisonFromNote(tx.note) ?? '');
        setIncomeReason('');
      } else if (expediteur) {
        setType('transfer');
        setTransferMode('person_from');
        setLabel(expediteur);
        setTransferReason(parseRaisonFromNote(tx.note) ?? '');
        setIncomeReason('');
      } else if (tx.type === 'income' && (incomeSource || existingContactId)) {
        setType('income');
        setTransferMode('accounts');
        setLabel(incomeSource ?? tx.label);
        setTransferReason('');
        setIncomeReason(parseRaisonFromNote(tx.note) ?? '');
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
          setIncomeReason('');
        } else {
          setLabel(tx.label);
          setTransferReason('');
          setIncomeReason(tx.type === 'income' ? parseRaisonFromNote(tx.note) ?? '' : '');
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
      if (routeScanItems) {
        const scanned = parseScanItemsFromRoute(routeScanItems);
        const catsById = new Map(categories.map((category) => [category.id, category]));
        setArticles(
          scanned.map((item) => ({
            name: item.name,
            price: item.price,
            categoryId: item.categoryId ?? null,
            categoryName: item.categoryId ? catsById.get(item.categoryId)?.name ?? null : null,
          })),
        );
        setScanPrefillApplied(true);
      } else {
        setArticles(tx.type === 'expense' ? parseItemizedNote(tx.note) : []);
      }
      setPrefilledEditId(editId);
    });

    return () => {
      cancelled = true;
    };
  }, [accountOptions, categories, editId, prefilledEditId, routeScanItems, savingsGoals, transferEndpoints]);

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
  const articlesTotal = useMemo(
    () => articles.reduce((sum, article) => sum + article.price, 0),
    [articles],
  );
  const maxArticlePrice = useMemo(() => {
    if (type !== 'expense') return undefined;
    const transactionTotal = parseFormattedNumber(amount);
    if (!Number.isFinite(transactionTotal) || transactionTotal <= 0) return 0;
    return getRemainingArticleBudget(transactionTotal, articles);
  }, [amount, articles, type]);
  const categorySearchText = useMemo(() => {
    if (type === 'transfer' && (transferMode === 'person' || transferMode === 'person_from')) {
      return [transferReason, label].filter(Boolean).join(' ');
    }
    return [label, ...articles.map((item) => item.name)].filter(Boolean).join(' ');
  }, [articles, label, transferMode, transferReason, type]);
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

  const handleAddArticle = useCallback(
    (name: string, price: string, articleCategoryId: string | null, categoryName: string | null) => {
      const priceValue = parseFormattedNumber(price);
      if (!Number.isFinite(priceValue) || priceValue <= 0) return;
      if (type === 'expense') {
        const transactionTotal = parseFormattedNumber(amount);
        if (!Number.isFinite(transactionTotal) || transactionTotal <= 0) return;
        const remaining = getRemainingArticleBudget(transactionTotal, articles);
        if (!isArticlePriceWithinBudget(priceValue, remaining)) return;
      }
      setArticles((current) => [
        ...current,
        {
          name,
          price: priceValue,
          categoryId: articleCategoryId,
          categoryName,
        },
      ]);
    },
    [amount, articles, type],
  );

  const handleRemoveArticle = useCallback((index: number) => {
    tapHaptic();
    setArticles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const displayAmount = useMemo(() => {
    const amt = amount.length ? formatMoneyAmountInput(amount) : '0';
    return `${amt} $`;
  }, [amount]);
  const amountDirection = useMemo((): TransactionAmountDirection => {
    if (type === 'income') return 'income';
    if (type === 'transfer' && transferMode === 'accounts') return 'neutral';
    return 'expense';
  }, [transferMode, type]);
  const childSupportSalaryNotices = useMemo(
    () =>
      type === 'income'
        ? getChildSupportSalaryNotices(loans, accountId, label, incomeReason)
        : [],
    [accountId, incomeReason, label, loans, type],
  );
  const labelHasLogo = useMemo(() => hasMerchantLogoCandidate(label), [label]);
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
  const hasDestinationSavingsGoals = destinationSavingsGoals.length > 0;
  const hasTransferEndpoints = transferEndpoints.length > 0;

  useEffect(() => {
    if (!isStandardTransfer || accountId !== destinationAccountId) return;

    const nextDestinationId =
      destinationPaymentMethodAccounts[0]?.id ?? destinationSavingsGoals[0]?.id ?? null;
    if (nextDestinationId && nextDestinationId !== destinationAccountId) {
      setDestinationAccountId(nextDestinationId);
    }
  }, [
    accountId,
    destinationAccountId,
    destinationPaymentMethodAccounts,
    destinationSavingsGoals,
    isStandardTransfer,
  ]);
  const hasMerchantSuggestions = merchantSuggestions.length > 0;
  const hasContactSuggestions = contactSuggestions.length > 0;
  const incomeContactSelected = type === 'income' && incomeContactPickStatus !== 'none';
  const hasNameSuggestions =
    (hasMerchantSuggestions || hasContactSuggestions) && !incomeContactSelected;
  const isEditing = Boolean(editingTransaction);
  const sheetTitle = isEditing
    ? 'Modifier la transaction'
    : type === 'income'
      ? 'Nouveau revenu'
      : isTransfer
        ? 'Nouveau virement'
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

  const inputSurface = containerSurfaceStyle(isLight);
  const isTransferAmountStep = isTransfer && transferEntryStep === 'amount';
  const isTransferReasonStep = isTransfer && transferEntryStep === 'reason';
  const fieldHasError = useCallback((field: FormFieldKey) => invalidFields.has(field), [invalidFields]);
  const fieldErrorBorder = useMemo(
    () => ({ borderColor: colors.danger, borderWidth: 1.5 }),
    [colors.danger],
  );

  const clearFieldError = useCallback((field: FormFieldKey) => {
    setInvalidFields((current) => {
      if (!current.has(field)) return current;
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  }, []);

  const scrollToField = useCallback((field: FormFieldKey) => {
    const yByField: Record<FormFieldKey, number> = {
      label: nameSectionYRef.current,
      transferReason: transferReasonSectionYRef.current,
      incomeReason: incomeReasonSectionYRef.current,
      amount: amountSectionYRef.current,
      category: categorySectionYRef.current,
      sourceAccount: sourceAccountSectionYRef.current,
      destinationAccount: destinationAccountSectionYRef.current,
    };

    requestAnimationFrame(() => {
      sheetScrollRef.current?.scrollTo({
        y: Math.max(yByField[field] - 16, 0),
        animated: true,
      });
    });
  }, []);

  const scrollToInlineArticle = useCallback((localY: number, offset = 16) => {
    requestAnimationFrame(() => {
      sheetScrollRef.current?.scrollTo({
        y: Math.max(articlesSectionYRef.current + inlineArticleLocalYRef.current + localY - offset, 0),
        animated: true,
      });
    });
  }, []);

  useEffect(() => {
    if (!isTransfer) return;
    setTransferEntryStep('reason');
  }, [isTransfer, transferMode]);

  useEffect(() => {
    if (!isTransfer || !isTransferReasonStep) return;
    if (isAnyPersonTransfer && !label.trim()) return;

    const timer = setTimeout(() => transferReasonInputRef.current?.focus(), 200);
    return () => clearTimeout(timer);
  }, [isAnyPersonTransfer, isTransfer, isTransferReasonStep, label, transferMode]);

  useEffect(() => {
    if (editId) return;

    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    const interaction = InteractionManager.runAfterInteractions(() => {
      focusTimer = setTimeout(() => {
        if (isTransfer) {
          if (isAnyPersonTransfer) {
            labelInputRef.current?.focus();
            return;
          }
          if (isStandardTransfer) {
            setTransferEntryStep('reason');
            transferReasonInputRef.current?.focus();
            return;
          }
        }
        // Income: keep sheet scrolled to top so "Nouveau revenu" stays visible on open.
        if (type === 'income') return;
        labelInputRef.current?.focus();
      }, 180);
    });

    return () => {
      interaction.cancel();
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, [editId, isAnyPersonTransfer, isStandardTransfer, isTransfer, transferMode, type]);

  const advanceToTransferAmountStep = useCallback(() => {
    Keyboard.dismiss();
    transferReasonInputRef.current?.blur();
    setTransferEntryStep('amount');
    requestAnimationFrame(() => {
      setTimeout(() => {
        sheetScrollRef.current?.scrollTo({
          y: Math.max(amountSectionYRef.current - 16, 0),
          animated: true,
        });
      }, 120);
    });
  }, []);

  const focusTransferReasonStep = useCallback(() => {
    setTransferEntryStep('reason');
    Keyboard.dismiss();
    requestAnimationFrame(() => {
      setTimeout(() => transferReasonInputRef.current?.focus(), 180);
    });
  }, []);

  const scrollToAmountSection = () => {
    if (isTransfer) {
      advanceToTransferAmountStep();
      return;
    }

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

  const scrollToIncomeContactSelectedSection = useCallback(() => {
    Keyboard.dismiss();
    labelInputRef.current?.blur();
    requestAnimationFrame(() => {
      setTimeout(() => {
        const viewportHeight = Dimensions.get('window').height;
        const hideNameScrollY = Math.max(incomeSourceFieldBottomYRef.current + 8, 0);
        const keepReasonScrollY = Math.max(incomeReasonSectionYRef.current - 16, 0);
        const numpadRevealY = Math.max(amountSectionYRef.current - viewportHeight * 0.55, 0);
        const scrollY = Math.min(keepReasonScrollY, Math.max(hideNameScrollY, numpadRevealY));
        sheetScrollRef.current?.scrollTo({
          y: scrollY,
          animated: true,
        });
      }, 220);
    });
  }, []);

  const applyIncomeContactSelectedFlow = useCallback(
    (contactName: string, isEmployer: boolean) => {
      const nextReason = resolveIncomeReasonForSelectedContact(allTransactions, contactName, isEmployer);
      const nextStatus: IncomeContactPickStatus = isEmployer ? 'employer' : 'contact';
      const validAccountIds = accountOptions.map((account) => account.id);
      const nextAccount = resolveIncomeAccountForSelectedContact(
        allTransactions,
        employerIncomeAccountMap,
        contactName,
        validAccountIds,
      );
      setIncomeReason((current) => (current === nextReason ? current : nextReason));
      if (nextAccount) {
        setAccountId((current) => (current === nextAccount ? current : nextAccount));
      }
      setIncomeContactPickStatus((current) => {
        if (current === nextStatus) return current;
        pendingIncomeContactScrollRef.current = true;
        return nextStatus;
      });
    },
    [accountOptions, allTransactions, employerIncomeAccountMap],
  );

  // When autocomplete suggestions appear while the keyboard is open, scroll the
  // sheet so the suggestion list stays visible above the keyboard.
  useEffect(() => {
    if (!hasNameSuggestions || !labelInputFocusedRef.current) {
      lastAutocompleteScrollKeyRef.current = '';
      return;
    }
    const scrollKey = `${type}:${merchantSuggestions.length}:${contactSuggestions.length}`;
    if (lastAutocompleteScrollKeyRef.current === scrollKey) return;
    lastAutocompleteScrollKeyRef.current = scrollKey;
    requestAnimationFrame(() => {
      sheetScrollRef.current?.scrollTo({
        y: Math.max(nameSectionYRef.current - 16, 0),
        animated: true,
      });
    });
  }, [contactSuggestions.length, hasNameSuggestions, merchantSuggestions.length, type]);

  useEffect(() => {
    if (type !== 'income' || incomeContactPickStatus === 'none' || !pendingIncomeContactScrollRef.current) {
      return;
    }
    pendingIncomeContactScrollRef.current = false;
    scrollToIncomeContactSelectedSection();
  }, [incomeContactPickStatus, scrollToIncomeContactSelectedSection, type]);

  const selectTransferReasonSuggestion = (reason: string) => {
    tapHaptic();
    setTransferReason(reason);
    if (isPersonTransferTo) {
      setCategoryManuallySelected(false);
    }
    advanceToTransferAmountStep();
  };

  const handleTransferReasonSubmit = () => {
    if (isPersonTransferTo && !transferReason.trim()) return;
    advanceToTransferAmountStep();
  };

  const handleIncomeSourceSubmit = () => {
    if (type !== 'income' || !label.trim()) return;
    Keyboard.dismiss();
    labelInputRef.current?.blur();
  };

  const selectIncomeReasonSuggestion = (reason: string) => {
    tapHaptic();
    setIncomeReason(reason);
    scrollToAmountSection();
  };

  const handleIncomeReasonSubmit = () => {
    if (type !== 'income' || !incomeReason.trim()) return;
    scrollToAmountSection();
  };

  const updateContactLabel = (value: string) => {
    setLabel(value);
    clearFieldError('label');
    if (type === 'income') {
      setIncomeContactPickStatus('none');
    }
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
    if (isAnyPersonTransfer) {
      focusTransferReasonStep();
      return;
    }
    if (type === 'income') {
      const isEmployer = isRegisteredEmployerName(savedContacts, name, contactDirectoryRows);
      applyIncomeContactSelectedFlow(name, isEmployer);
      return;
    }
    scrollToAmountSection();
  };

  const handleAddEmployer = async () => {
    const name = label.trim();
    if (!name || isRegisteredEmployerName(savedContacts, name, contactDirectoryRows)) return;

    setCreatingContact(true);
    setFormFeedback(null);
    try {
      const contact = await upsertContactByName(name, { isEmployer: true });
      setSavedContacts((current) => {
        const key = contact.normalizedName;
        const without = current.filter((item) => item.normalizedName !== key);
        return [...without, contact].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      });
      setLinkedContactId(contact.id);
      successHaptic();
      applyIncomeContactSelectedFlow(name, true);
    } catch {
      setFormFeedback(formValidationError('Erreur', 'Impossible d’ajouter cet employeur.'));
    } finally {
      setCreatingContact(false);
    }
  };

  const handleAddContact = async () => {
    const name = label.trim();
    if (!name || resemblesExistingContact(savedContacts, name, contactDirectoryRows)) return;

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
      applyIncomeContactSelectedFlow(name, false);
    } catch {
      setFormFeedback(formValidationError('Erreur', 'Impossible d’ajouter ce contact.'));
    } finally {
      setCreatingContact(false);
    }
  };

  const handleCreateTransferContact = async () => {
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
      focusTransferReasonStep();
    } catch {
      setFormFeedback(formValidationError('Erreur', 'Impossible de créer ce contact.'));
    } finally {
      setCreatingContact(false);
    }
  };

  const save = async () => {
    if (saving) return;

    const saveAsPersonTransferTo = isPersonTransferTo;
    const saveAsPersonTransferFrom = isPersonTransferFrom;
    const saveAsStandardTransfer = isStandardTransfer;
    const persistedType: TransactionType = saveAsPersonTransferTo
      ? 'expense'
      : saveAsPersonTransferFrom
        ? 'income'
        : type;

    const nextInvalidFields = new Set<FormFieldKey>();
    let firstInvalidField: FormFieldKey | null = null;
    let validationFeedback: FormFeedback | null = null;

    const markInvalid = (field: FormFieldKey, feedback: FormFeedback) => {
      nextInvalidFields.add(field);
      if (!firstInvalidField) {
        firstInvalidField = field;
        validationFeedback = feedback;
      }
    };

    if (isAnyPersonTransfer && !label.trim()) {
      markInvalid('label', formValidationError('Champ requis', 'Indique le nom du contact.'));
    }
    if (saveAsPersonTransferTo && !transferReason.trim()) {
      markInvalid('transferReason', formValidationError('Champ requis', 'Indique la raison du virement.'));
    }
    if (!isAnyPersonTransfer && !saveAsStandardTransfer && !label.trim()) {
      markInvalid(
        'label',
        formValidationError(
          'Champ requis',
          type === 'income' ? 'Indique ton employeur ou la source du revenu.' : 'Indiquez un marchand ou une description.',
        ),
      );
    }

    const parsed = parseMoney(amount);
    if (!parsed || parsed <= 0) {
      markInvalid('amount', formValidationError('Montant invalide', 'Saisissez un montant positif.'));
    }

    const isExpenseSave = persistedType === 'expense' && !saveAsPersonTransferTo;
    const resolvedCategoryId = saveAsStandardTransfer
      ? TRANSFER_CATEGORY.id
      : isExpenseSave
        ? resolveExpenseCategoryId(
            articles,
            label.trim(),
            visibleCats,
            inferredExpenseCategoryId,
            categoryId,
            categoryManuallySelected,
          )
        : categoryId;

    if (!resolvedCategoryId) {
      markInvalid(
        'category',
        formValidationError('Catégorie', 'Choisissez une catégorie.'),
      );
    }
    if (saveAsStandardTransfer && accountId === destinationAccountId) {
      markInvalid('sourceAccount', formValidationError('Virement invalide', 'Choisis deux comptes différents.'));
      markInvalid('destinationAccount', formValidationError('Virement invalide', 'Choisis deux comptes différents.'));
    }

    if (nextInvalidFields.size > 0) {
      setInvalidFields(nextInvalidFields);
      if (validationFeedback) setFormFeedback(validationFeedback);
      if (firstInvalidField) scrollToField(firstInvalidField);
      return;
    }

    setInvalidFields(new Set());
    const articleNotes: ItemizedNote[] =
      persistedType === 'expense' && !saveAsPersonTransferTo
        ? articles
            .filter((item) => item.name.trim())
            .map((item) => ({
              name: item.name.trim(),
              price: Math.round(item.price * 100) / 100,
              categoryId: item.categoryId ?? null,
              categoryName: item.categoryName ?? (item.categoryId ? categoryById.get(item.categoryId)?.name ?? null : null),
            }))
        : [];

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
            ? [
                `compte:${accountId}`,
                `source:${label.trim()}`,
                incomeReason.trim() ? `raison:${incomeReason.trim()}` : null,
              ]
                .filter(Boolean)
                .join('\n')
            : type === 'income'
              ? [
                  `compte:${accountId}`,
                  incomeReason.trim() ? `raison:${incomeReason.trim()}` : null,
                ]
                  .filter(Boolean)
                  .join('\n')
            : articleNotes.length > 0
              ? `compte:${accountId}\n${buildArticlesNoteLine(articleNotes)}`
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
    if (
      isExpenseSave &&
      resolvedCategoryId === UNCATEGORIZED_TRANSACTION_CATEGORY.id
    ) {
      await upsertCategory(UNCATEGORIZED_TRANSACTION_CATEGORY);
    }

    setSaving(true);
    const balanceEmit = { emit: false as const };

    try {
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
      : persistedType === 'expense'
        ? null
        : iconPickedManually
          ? fallbackIcon
          : labelHasLogo
            ? null
            : fallbackIcon;
    const preservedReceiptUri = isExpenseSave && editingTransaction ? editingTransaction.receiptUri ?? null : null;
    const preservedReceiptStatus = isExpenseSave && editingTransaction ? editingTransaction.receiptStatus ?? null : null;

    const tx = editingTransaction
      ? {
          ...editingTransaction,
          label: transactionLabel,
          amount: parsed,
          type: persistedType,
          date: transactionDate,
          categoryId: resolvedCategoryId!,
          transactionIcon,
          receiptUri: preservedReceiptUri,
          receiptStatus: preservedReceiptStatus,
          note,
        }
      : createLocalTransaction({
      label: transactionLabel,
      amount: parsed,
      type: persistedType,
      date: transactionDate,
      categoryId: resolvedCategoryId!,
      transactionIcon,
      receiptUri: null,
      receiptStatus: null,
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
        await adjustSimulatedAccountBalance(delta.id, -delta.delta, balanceEmit);
      }
      for (const delta of nextDeltas) {
        await adjustSimulatedAccountBalance(delta.id, delta.delta, balanceEmit);
      }
      if (editingTransaction.type === 'transfer') {
        await applyLinkedSavingsGoalDeltas(simulatedAccounts, previousDeltas, -1, balanceEmit);
      }
      if (saveAsStandardTransfer) {
        await applyLinkedSavingsGoalDeltas(simulatedAccounts, nextDeltas, 1, balanceEmit);
      }
    } else if (saveAsStandardTransfer) {
      if (sourceEndpoint?.kind === 'goal') {
        await adjustSavingsGoalCurrentAmount(sourceEndpoint.id, -parsed, balanceEmit);
      } else if (sourceAccount.isSimulated) {
        await adjustSimulatedAccountBalance(sourceAccount.id, -parsed, balanceEmit);
      }
      if (destinationEndpoint?.kind === 'goal') {
        await adjustSavingsGoalCurrentAmount(destinationEndpoint.id, parsed, balanceEmit);
      } else if (destinationAccount.isSimulated) {
        await adjustSimulatedAccountBalance(destinationAccount.id, parsed, balanceEmit);
      }
      if (sourceEndpoint?.kind !== 'goal' && destinationEndpoint?.kind !== 'goal') {
        await applyLinkedSavingsGoalDeltas(
          simulatedAccounts,
          getTransactionAccountDeltas({ amount: parsed, type: persistedType, note }),
          1,
          balanceEmit,
        );
      }
    } else if (sourceAccount.isSimulated) {
      await adjustSimulatedAccountBalance(
        sourceAccount.id,
        persistedType === 'income' ? parsed : -parsed,
        balanceEmit,
      );
    }

    void syncWithServer().catch(() => {});

    if (type === 'income' && incomeReason.trim()) {
      await saveIncomeReasonSuggestion(incomeReason);
      setIncomeReasonSuggestions(await getIncomeReasonSuggestions());
    }
    if (type === 'income' && label.trim()) {
      await saveEmployerIncomeAccount(label.trim(), accountId);
      setEmployerIncomeAccountMap(await getEmployerIncomeAccountMap());
    }
    if (isTransfer && transferReason.trim()) {
      await saveTransferReasonSuggestion(transferReason);
      setTransferReasonSuggestions(await getTransferReasonSuggestions());
    }

    successHaptic();
    router.back();
    } catch {
      setFormFeedback(
        formValidationError(
          'Erreur',
          'Impossible d’enregistrer la transaction. Réessaie dans un instant.',
        ),
      );
    } finally {
      setSaving(false);
    }
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
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
            >
              <View style={[styles.handle, themed.handle]} />
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, themed.text]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                  {sheetTitle}
                </Text>
                <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.sheetClose, themed.closeButton]}>
                  <AppIcon family="ionicons" name="close" size={19} color={colors.textMuted} />
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
                            if (t !== 'income') {
                              setIncomeReason('');
                            }
                            setLinkedContactId(null);
                            setIncomeContactPickStatus('none');
                            setType(t);
                          }}
                          style={[styles.chip, themed.control, styles.chipShell, on && themed.selected]}
                        >
                          <Text
                            style={[styles.chipText, singleLineLabelStyle, themed.text, on && themed.selectedText]}
                            {...chipLabelTextProps()}
                          >
                            {t === 'expense' ? 'Dépense' : t === 'income' ? 'Revenu' : 'Virement'}
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
                      ? 'Employeur / Client'
                      : isPersonTransferFrom
                        ? 'Contact (expéditeur)'
                        : isPersonTransferTo
                          ? 'Contact'
                          : 'Marchand / paiement'}
                  </DashboardSectionLabel>
                  <TextInput
                    ref={labelInputRef}
                    style={[
                      styles.input,
                      themed.controlStrong,
                      themed.text,
                      fieldHasError('label') && fieldErrorBorder,
                    ]}
                    placeholder={
                      type === 'income'
                        ? 'Ex. Desjardins, Employeur Inc....'
                        : isAnyPersonTransfer
                          ? 'Ex. Marie, Jean, loyer à un ami...'
                          : 'Ex. Starbucks, loyer, épicerie...'
                    }
                    placeholderTextColor={colors.textMuted}
                    value={label}
                    onLayout={(e) => {
                      const { y, height } = e.nativeEvent.layout;
                      incomeSourceFieldBottomYRef.current = nameSectionYRef.current + y + height;
                    }}
                    onChangeText={(value) => {
                      clearFieldError('label');
                      if (usesContactField) {
                        updateContactLabel(value);
                        return;
                      }
                      setLabel(value);
                    }}
                    onFocus={() => {
                      labelInputFocusedRef.current = true;
                    }}
                    onBlur={() => {
                      labelInputFocusedRef.current = false;
                    }}
                    returnKeyType={type === 'income' ? 'next' : 'done'}
                    blurOnSubmit={type === 'income'}
                    onSubmitEditing={type === 'income' ? handleIncomeSourceSubmit : undefined}
                  />
                  {hasNameSuggestions ? (
                    <View style={styles.suggestionRow}>
                      {(type === 'income' ? contactSuggestions : usesContactField ? contactSuggestions : merchantSuggestions).map((name) => (
                        <Pressable
                          key={name}
                          accessibilityRole="button"
                          accessibilityLabel={`Sélectionner ${name}`}
                          onPress={() => selectNameSuggestion(name)}
                          style={({ pressed }) => [styles.suggestionChip, themed.control, pressed && styles.pressed]}
                        >
                          <AppIcon family="ionicons"
                            name={
                              type === 'income'
                                ? 'business-outline'
                                : usesContactField
                                  ? 'person-outline'
                                  : 'sparkles-outline'
                            }
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
                  {type === 'income' &&
                  (incomeContactActions.showAddEmployer || incomeContactActions.showAddContact) ? (
                    <View style={styles.createContactActionsColumn}>
                      {incomeContactActions.showAddEmployer ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Ajouter un employeur"
                          onPress={() => void handleAddEmployer()}
                          disabled={creatingContact}
                          style={({ pressed }) => [
                            styles.createContactButton,
                            themed.control,
                            pressed && styles.pressed,
                            creatingContact && styles.createContactButtonDisabled,
                          ]}
                        >
                          <AppIcon family="ionicons" name="business-outline" size={16} color={colors.primary} />
                          <Text style={[styles.createContactButtonText, themed.selectedText]}>
                            {creatingContact ? 'Ajout...' : 'Ajouter un employeur'}
                          </Text>
                        </Pressable>
                      ) : null}
                      {incomeContactActions.showAddContact ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Ajouter un contact"
                          onPress={() => void handleAddContact()}
                          disabled={creatingContact}
                          style={({ pressed }) => [
                            styles.createContactButton,
                            themed.control,
                            pressed && styles.pressed,
                            creatingContact && styles.createContactButtonDisabled,
                          ]}
                        >
                          <AppIcon family="ionicons" name="person-add-outline" size={16} color={colors.primary} />
                          <Text style={[styles.createContactButtonText, themed.selectedText]}>
                            {creatingContact ? 'Création...' : 'Ajouter un contact'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                  {usesContactField && type !== 'income' && label.trim() && !linkedContactId && !isKnownContactName(label) ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Ajouter un contact"
                      onPress={() => void handleCreateTransferContact()}
                      disabled={creatingContact}
                      style={({ pressed }) => [
                        styles.createContactButton,
                        themed.control,
                        pressed && styles.pressed,
                        creatingContact && styles.createContactButtonDisabled,
                      ]}
                    >
                      <AppIcon family="ionicons" name="person-add-outline" size={16} color={colors.primary} />
                      <Text style={[styles.createContactButtonText, themed.selectedText]}>
                        {creatingContact ? 'Création...' : 'Ajouter un contact'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {type === 'income' && incomeContactPickStatus === 'employer' ? (
                    <Text style={[styles.linkedContactHint, themed.textMuted]}>
                      Employeur existant sélectionné
                    </Text>
                  ) : null}
                  {type === 'income' && incomeContactPickStatus === 'contact' ? (
                    <Text style={[styles.linkedContactHint, themed.textMuted]}>
                      Contact existant sélectionné
                    </Text>
                  ) : null}
                  {usesContactField && type !== 'income' && linkedContactId ? (
                    <Text style={[styles.linkedContactHint, themed.textMuted]}>
                      Lié au contact existant — aucun doublon ne sera créé.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {isTransfer ? (
                <View
                  style={styles.section}
                  onLayout={(e) => { transferReasonSectionYRef.current = e.nativeEvent.layout.y; }}
                >
                  <DashboardSectionLabel>
                    {isPersonTransferFrom ? 'Description (optionnel)' : 'Raison du virement'}
                  </DashboardSectionLabel>
                  <TextInput
                    ref={transferReasonInputRef}
                    style={[
                      styles.input,
                      themed.controlStrong,
                      themed.text,
                      fieldHasError('transferReason') && fieldErrorBorder,
                    ]}
                    placeholder={
                      isPersonTransferFrom
                        ? 'Ex. remboursement, cadeau, partage de frais...'
                        : isStandardTransfer
                          ? 'Motif (optionnel) — ex. épargne vacances, remboursement...'
                          : 'Ex. remboursement repas, cadeau anniversaire, part du loyer...'
                    }
                    placeholderTextColor={colors.textMuted}
                    value={transferReason}
                    onChangeText={(value) => {
                      clearFieldError('transferReason');
                      setTransferReason(value);
                      if (isPersonTransferTo) {
                        setCategoryManuallySelected(false);
                      }
                      if (isTransferAmountStep) {
                        setTransferEntryStep('reason');
                      }
                    }}
                    onFocus={() => setTransferEntryStep('reason')}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={handleTransferReasonSubmit}
                  />
                  {transferReasonSuggestions.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="always"
                      style={styles.transferReasonChipsScroll}
                      contentContainerStyle={styles.transferReasonChipsContent}
                    >
                      {transferReasonSuggestions.map((reason) => {
                        const selected =
                          transferReason.trim().toLowerCase() === reason.trim().toLowerCase();
                        return (
                          <Pressable
                            key={reason}
                            onPress={() => selectTransferReasonSuggestion(reason)}
                            style={({ pressed }) => [
                              tagContainerStyle({
                                backgroundColor: selected ? colors.successMuted : colors.surfaceElevated,
                                borderColor: selected ? colors.primary : colors.border,
                                bordered: true,
                                pill: true,
                              }),
                              chipSelectableShellStyle(selected ? colors.primary : colors.border),
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={tagTypography({ color: selected ? colors.primary : colors.text })}>
                              {reason}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : null}
                </View>
              ) : null}

              {type === 'income' ? (
                <View
                  style={styles.section}
                  onLayout={(e) => { incomeReasonSectionYRef.current = e.nativeEvent.layout.y; }}
                >
                  <DashboardSectionLabel>Raison du revenu</DashboardSectionLabel>
                  <TextInput
                    style={[styles.input, themed.controlStrong, themed.text]}
                    placeholder="Ex. travail, vente, don, prime..."
                    placeholderTextColor={colors.textMuted}
                    value={incomeReason}
                    onChangeText={setIncomeReason}
                    returnKeyType="next"
                    blurOnSubmit
                    onSubmitEditing={handleIncomeReasonSubmit}
                  />
                  {incomeReasonSuggestions.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="always"
                      style={styles.transferReasonChipsScroll}
                      contentContainerStyle={styles.transferReasonChipsContent}
                    >
                      {incomeReasonSuggestions.map((reason) => {
                        const selected =
                          incomeReason.trim().toLowerCase() === reason.trim().toLowerCase();
                        return (
                          <Pressable
                            key={reason}
                            onPress={() => selectIncomeReasonSuggestion(reason)}
                            style={({ pressed }) => [
                              tagContainerStyle({
                                backgroundColor: selected ? colors.successMuted : colors.surfaceElevated,
                                borderColor: selected ? colors.primary : colors.border,
                                bordered: true,
                                pill: true,
                              }),
                              chipSelectableShellStyle(selected ? colors.primary : colors.border),
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={tagTypography({ color: selected ? colors.primary : colors.text })}>
                              {reason}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : null}
                </View>
              ) : null}

              <View
                style={[
                  fieldHasError('amount') ? styles.amountValidationSection : styles.amountSection,
                  fieldHasError('amount') && {
                    backgroundColor: inputSurface.backgroundColor,
                    borderColor: colors.danger,
                    borderWidth: 1.5,
                  },
                ]}
                onLayout={(event) => {
                  amountSectionYRef.current = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.amountWrap}>
                  <TransactionAmountLabel
                    amount={displayAmount}
                    direction={amountDirection}
                    color={themed.text.color ?? colors.text}
                    textStyle={[styles.amountText, themed.text, { fontSize: amountFontSize(amount) }]}
                    iconSize={Math.max(18, Math.round(amountFontSize(amount) * 0.38))}
                    containerStyle={{ justifyContent: 'center' }}
                    showDirectionIcon={amountDirection !== 'neutral'}
                  />
                </View>

                <MotiView
                  from={{ opacity: 0, translateY: 8 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 260 }}
                >
                  <GhostNumpad
                    value={amount}
                    onChange={(value) => {
                      clearFieldError('amount');
                      setAmount(value);
                    }}
                  />
                </MotiView>
              </View>

              <DatePickerField
                label="Date"
                value={date}
                placeholder="Choisir une date"
                variant="sheet"
                onChangeDate={setDate}
              />

              {type === 'expense' ? (
                <View style={styles.section}>
                  <PaymentMethodField
                    accounts={paymentMethodAccounts}
                    selectedAccountId={accountId}
                    onSelectAccount={(id) => {
                      tapHaptic();
                      setAccountId(id);
                    }}
                    chipControlStyle={themed.control}
                    chipSelectedStyle={themed.selected}
                    selectedTextStyle={themed.selectedText}
                    textSecondaryStyle={{ color: colors.textSecondary }}
                  />
                </View>
              ) : null}

              {type === 'expense' ? (
                <View
                  style={[
                    styles.section,
                    fieldHasError('category') && styles.validationOutline,
                    fieldHasError('category') && fieldErrorBorder,
                  ]}
                  onLayout={(event) => {
                    categorySectionYRef.current = event.nativeEvent.layout.y;
                  }}
                >
                  <DashboardSectionLabel>Catégorie</DashboardSectionLabel>
                  <BudgetCategoryPicker
                    categories={visibleCats}
                    searchText={categorySearchText}
                    selectedId={categoryId}
                    onSelect={(id) => {
                      clearFieldError('category');
                      setCategoryManuallySelected(true);
                      setCategoryId(id);
                    }}
                  />
                </View>
              ) : null}


              {type !== 'expense' && !isTransfer ? (
                <View style={styles.section}>
                  <PaymentMethodField
                    label="Compte de dépôt"
                    accounts={paymentMethodAccounts}
                    selectedAccountId={accountId}
                    onSelectAccount={(id) => { tapHaptic(); setAccountId(id); }}
                    chipControlStyle={themed.control}
                    chipSelectedStyle={themed.selected}
                    selectedTextStyle={themed.selectedText}
                    textSecondaryStyle={{ color: colors.textSecondary }}
                  />
                </View>
              ) : null}

              {childSupportSalaryNotices.map((notice) => (
                <ThemedFormMessage
                  key={`${notice.variant}-${notice.title}`}
                  variant={notice.variant}
                  title={notice.title}
                  message={notice.message}
                />
              ))}

              {isPersonTransferTo ? (
                <View
                  style={[
                    styles.section,
                    fieldHasError('category') && styles.validationOutline,
                    fieldHasError('category') && fieldErrorBorder,
                  ]}
                  onLayout={(e) => { categorySectionYRef.current = e.nativeEvent.layout.y; }}
                >
                  <DashboardSectionLabel>Catégorie</DashboardSectionLabel>
                  <BudgetCategoryPicker
                    categories={visibleCats}
                    searchText={categorySearchText}
                    selectedId={categoryId}
                    transferReason={transferReason}
                    onSelect={(id) => {
                      clearFieldError('category');
                      setCategoryManuallySelected(true);
                      setCategoryId(id);
                    }}
                  />
                </View>
              ) : null}

              {isPersonTransferFrom ? (
                <View style={styles.section}>
                  <PaymentMethodField
                    label="Compte de dépôt"
                    accounts={paymentMethodAccounts}
                    selectedAccountId={accountId}
                    onSelectAccount={(id) => { tapHaptic(); setAccountId(id); }}
                    chipControlStyle={themed.control}
                    chipSelectedStyle={themed.selected}
                    selectedTextStyle={themed.selectedText}
                    textSecondaryStyle={{ color: colors.textSecondary }}
                  />
                </View>
              ) : null}

              {isPersonTransferFrom ? (
                <View
                  style={[
                    styles.section,
                    fieldHasError('category') && styles.validationOutline,
                    fieldHasError('category') && fieldErrorBorder,
                  ]}
                  onLayout={(e) => { categorySectionYRef.current = e.nativeEvent.layout.y; }}
                >
                  <DashboardSectionLabel>Catégorie</DashboardSectionLabel>
                  <View style={styles.wrapRow}>
                    {visibleCats.map((c) => {
                      const on = categoryId === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => {
                            tapHaptic();
                            clearFieldError('category');
                            setCategoryManuallySelected(true);
                            setCategoryId(c.id);
                          }}
                          style={[styles.categoryChip, themed.control, styles.chipShell, on && themed.selected]}
                        >
                          <AppIcon family="ionicons"
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
                <View
                  style={[
                    styles.section,
                    fieldHasError('sourceAccount') && styles.validationOutline,
                    fieldHasError('sourceAccount') && fieldErrorBorder,
                  ]}
                  onLayout={(e) => { sourceAccountSectionYRef.current = e.nativeEvent.layout.y; }}
                >
                  <DashboardSectionLabel>De</DashboardSectionLabel>
                  {!hasTransferEndpoints ? (
                    <Text style={[styles.sectionHint, themed.textMuted]}>Aucun compte ou objectif trouvé.</Text>
                  ) : null}
                  {hasAccountOptions ? (
                    <PaymentMethodField
                      label="Comptes"
                      accounts={paymentMethodAccounts}
                      selectedAccountId={accountId}
                      onSelectAccount={(id) => {
                        tapHaptic();
                        clearFieldError('sourceAccount');
                        clearFieldError('destinationAccount');
                        setAccountId(id);
                      }}
                      chipControlStyle={themed.control}
                      chipSelectedStyle={themed.selected}
                      selectedTextStyle={themed.selectedText}
                      textSecondaryStyle={{ color: colors.textSecondary }}
                    />
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
                              onPress={() => {
                                tapHaptic();
                                clearFieldError('sourceAccount');
                                clearFieldError('destinationAccount');
                                setAccountId(g.id);
                              }}
                              style={[styles.transferGoalChip, on ? themed.selected : themed.control]}
                            >
                              <TransferGoalChipIcon
                                icon={g.icon}
                                selected={on}
                                selectedColor={colors.primary}
                                mutedColor={colors.textSecondary}
                              />
                              <Text
                                style={[
                                  styles.transferGoalChipText,
                                  on ? themed.selectedText : { color: colors.textSecondary },
                                ]}
                                numberOfLines={1}
                              >
                                {g.name} • {formatNumberDisplay(Math.round(g.currentAmount))} $
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
                <View
                  style={[
                    styles.section,
                    fieldHasError('sourceAccount') && styles.validationOutline,
                    fieldHasError('sourceAccount') && fieldErrorBorder,
                  ]}
                  onLayout={(e) => { sourceAccountSectionYRef.current = e.nativeEvent.layout.y; }}
                >
                  <PaymentMethodField
                    label="Compte source"
                    accounts={paymentMethodAccounts}
                    selectedAccountId={accountId}
                    onSelectAccount={(id) => {
                      tapHaptic();
                      clearFieldError('sourceAccount');
                      setAccountId(id);
                    }}
                    chipControlStyle={themed.control}
                    chipSelectedStyle={themed.selected}
                    selectedTextStyle={themed.selectedText}
                    textSecondaryStyle={{ color: colors.textSecondary }}
                    emptyHint="Aucun compte trouvé."
                  />
                </View>
              ) : null}

              {isStandardTransfer ? (
                <View
                  style={[
                    styles.section,
                    fieldHasError('destinationAccount') && styles.validationOutline,
                    fieldHasError('destinationAccount') && fieldErrorBorder,
                  ]}
                  onLayout={(e) => { destinationAccountSectionYRef.current = e.nativeEvent.layout.y; }}
                >
                  <DashboardSectionLabel>Vers</DashboardSectionLabel>
                  {destinationPaymentMethodAccounts.length > 0 ? (
                    <PaymentMethodField
                      label="Comptes"
                      accounts={destinationPaymentMethodAccounts}
                      selectedAccountId={destinationAccountId}
                      onSelectAccount={(id) => {
                        tapHaptic();
                        clearFieldError('sourceAccount');
                        clearFieldError('destinationAccount');
                        setDestinationAccountId(id);
                      }}
                      chipControlStyle={themed.control}
                      chipSelectedStyle={themed.selected}
                      selectedTextStyle={themed.selectedText}
                      textSecondaryStyle={{ color: colors.textSecondary }}
                    />
                  ) : null}
                  {hasDestinationSavingsGoals ? (
                    <>
                      <Text style={[styles.transferGroupLabel, themed.textMuted]}>{'Objectifs d\u2019épargne'}</Text>
                      <View style={styles.accountRow}>
                        {destinationSavingsGoals.map((g) => {
                          const on = destinationAccountId === g.id;
                          return (
                            <Pressable
                              key={g.id}
                              onPress={() => {
                                tapHaptic();
                                clearFieldError('sourceAccount');
                                clearFieldError('destinationAccount');
                                setDestinationAccountId(g.id);
                              }}
                              style={[styles.transferGoalChip, on ? themed.selected : themed.control]}
                            >
                              <TransferGoalChipIcon
                                icon={g.icon}
                                selected={on}
                                selectedColor={colors.primary}
                                mutedColor={colors.textSecondary}
                              />
                              <Text
                                style={[
                                  styles.transferGoalChipText,
                                  on ? themed.selectedText : { color: colors.textSecondary },
                                ]}
                                numberOfLines={1}
                              >
                                {g.name} • {formatNumberDisplay(Math.round(g.currentAmount))} $
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
                <View
                  style={[
                    styles.section,
                    fieldHasError('category') && styles.validationOutline,
                    fieldHasError('category') && fieldErrorBorder,
                  ]}
                  onLayout={(e) => { categorySectionYRef.current = e.nativeEvent.layout.y; }}
                >
                  <DashboardSectionLabel>Catégorie</DashboardSectionLabel>
                  <View style={styles.wrapRow}>
                    {visibleCats.map((c) => {
                      const on = categoryId === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => {
                            tapHaptic();
                            clearFieldError('category');
                            setCategoryManuallySelected(true);
                            setCategoryId(c.id);
                          }}
                          style={[styles.categoryChip, themed.control, styles.chipShell, on && themed.selected]}
                        >
                          <AppIcon family="ionicons"
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
                <View
                  style={[
                    styles.articlesSectionCard,
                    {
                      backgroundColor: isLight ? '#FAFAFA' : '#0F0F10',
                      borderColor: colors.containerBorder,
                    },
                  ]}
                  onLayout={(event) => {
                    articlesSectionYRef.current = event.nativeEvent.layout.y;
                  }}
                >
                    <View style={styles.articlesHeaderRow}>
                      <View style={styles.articlesHeaderLeft}>
                        <View style={[styles.articlesIconWell, { backgroundColor: colors.successMuted }]}>
                          <AppIcon family="ionicons" name="receipt-outline" size={14} color={colors.primary} />
                        </View>
                        <Text style={[detailSectionLabelStyle(), { color: colors.text }]}>Articles</Text>
                        {articles.length > 0 ? (
                          <View style={[styles.articlesCountBadge, { backgroundColor: colors.successMuted }]}>
                            <Text style={[styles.articlesCountBadgeText, { color: colors.primary }]}>
                              {articles.length}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {!inlineArticleExpanded && articles.length > 0 ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Ajouter un article"
                          hitSlop={8}
                          onPress={() => {
                            tapHaptic();
                            setInlineArticleExpanded(true);
                          }}
                          style={({ pressed }) => [
                            styles.articlesAddButton,
                            {
                              backgroundColor: colors.successMuted,
                              borderColor: colors.primary,
                            },
                            pressed && styles.pressed,
                          ]}
                        >
                          <AppIcon family="ionicons" name="add" size={14} color={colors.primary} />
                          <Text style={[styles.articlesAddButtonText, { color: colors.primary }]}>Ajouter</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    <View
                      style={[
                        styles.articlesTearLine,
                        { borderColor: isLight ? 'rgba(0,0,0,0.11)' : 'rgba(255,255,255,0.11)' },
                      ]}
                    />

                    {!inlineArticleExpanded && articles.length === 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Ajouter un article"
                        onPress={() => {
                          tapHaptic();
                          setInlineArticleExpanded(true);
                        }}
                        style={({ pressed }) => [
                          styles.articlesPrimaryAddButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <AppIcon family="ionicons" name="add-circle-outline" size={18} color={colors.textSecondary} />
                        <Text style={styles.articlesPrimaryAddButtonText}>
                          Ajouter un article
                        </Text>
                      </Pressable>
                    ) : null}

                    {inlineArticleExpanded ? (
                      <View
                        style={styles.articlesInlineFormWrap}
                        onLayout={(event) => {
                          inlineArticleLocalYRef.current = event.nativeEvent.layout.y;
                        }}
                      >
                        <AddArticleSheet
                          variant="inline"
                          visible={inlineArticleExpanded}
                          maxArticlePrice={maxArticlePrice}
                          scrollToOffset={scrollToInlineArticle}
                          onAdd={(name, price, articleCategoryId, categoryName) =>
                            handleAddArticle(name, price, articleCategoryId, categoryName)
                          }
                          onClose={() => setInlineArticleExpanded(false)}
                        />
                      </View>
                    ) : null}

                    {articles.length > 0 ? (
                      <View
                        style={[
                          styles.articlesBlock,
                          {
                            backgroundColor: isLight ? '#FFFFFF' : colors.surfaceElevated,
                            borderColor: isLight ? 'rgba(0,0,0,0.06)' : colors.border,
                          },
                        ]}
                      >
                        <View style={styles.articlesTableHead}>
                          <Text
                            style={[
                              detailSubSectionHeaderStyle(),
                              styles.articlesTableHeadLabel,
                              { color: colors.textMuted },
                            ]}
                          >
                            Article
                          </Text>
                          <Text
                            style={[
                              detailSubSectionHeaderStyle(),
                              styles.articlesTableHeadAmount,
                              { color: colors.textMuted },
                            ]}
                          >
                            Montant
                          </Text>
                          <View style={styles.articlesTableHeadAction} />
                        </View>
                        {articles.map((article, index) => (
                          <View
                            key={`${article.name}-${index}`}
                            style={[
                              styles.articleRow,
                              index > 0 && {
                                borderTopWidth: StyleSheet.hairlineWidth,
                                borderTopColor: isLight ? 'rgba(0,0,0,0.06)' : colors.border,
                              },
                            ]}
                          >
                            <View style={styles.articleCopy}>
                              <Text
                                style={[styles.articleName, articlesReceiptTypography('regular'), themed.text]}
                                numberOfLines={1}
                              >
                                {article.name}
                              </Text>
                              {article.categoryName ? (
                                <Text
                                  style={[
                                    styles.articleCategory,
                                    articlesReceiptTypography('regular'),
                                    themed.textMuted,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {article.categoryName}
                                </Text>
                              ) : null}
                            </View>
                            <Text style={[styles.articlePrice, articlesReceiptTypography('medium'), themed.text]}>
                              {formatDisplayMoneyAbsolute(article.price)}
                            </Text>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Retirer ${article.name}`}
                              hitSlop={8}
                              onPress={() => handleRemoveArticle(index)}
                              style={({ pressed }) => [styles.articleRemoveBtn, pressed && styles.pressed]}
                            >
                              <AppIcon family="ionicons" name="close" size={13} color={colors.textMuted} />
                            </Pressable>
                          </View>
                        ))}
                        {articlesTotal > 0 ? (
                          <View
                            style={[
                              styles.articleTotalRow,
                              {
                                borderTopColor: isLight ? 'rgba(0,0,0,0.11)' : 'rgba(255,255,255,0.11)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.articleTotalLabel,
                                articlesReceiptTypography('medium'),
                                themed.textMuted,
                              ]}
                            >
                              TOTAL
                            </Text>
                            <Text
                              style={[styles.articleTotalValue, articlesReceiptTypography('medium'), themed.text]}
                            >
                              {formatDisplayMoneyAbsolute(articlesTotal)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : !inlineArticleExpanded ? (
                      <Text
                        style={[
                          styles.articlesEmptyText,
                          articlesReceiptTypography('regular'),
                          themed.textMuted,
                        ]}
                      >
                        Détaillez votre achat article par article
                      </Text>
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
                disabled={saving}
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
    ...jakartaExtraBoldText,
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
  amountSection: {
    gap: spacing.sm,
  },
  amountValidationSection: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  transferReasonChipsScroll: {
    marginTop: 2,
  },
  transferReasonChipsContent: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  amountText: {
    ...jakartaExtraBoldText,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  section: { gap: spacing.sm },
  validationOutline: {
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
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
    ...jakartaMediumText,
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
    ...jakartaBoldText,
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
  createContactActionsColumn: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  createContactButtonDisabled: {
    opacity: 0.6,
  },
  createContactButtonText: {
    ...jakartaBoldText,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  linkedContactHint: {
    ...jakartaMediumText,
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
    ...jakartaBoldText,
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
    ...jakartaExtraBoldText,
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
    ...jakartaBoldText,
    fontSize: typography.caption,
    textAlign: 'right',
  },
  priceCurrency: {
    marginLeft: spacing.xs,
    ...jakartaExtraBoldText,
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
    ...jakartaExtraBoldText,
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
    ...jakartaExtraBoldText,
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
    ...jakartaBoldText,
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
    ...jakartaExtraBoldText,
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
    ...jakartaExtraBoldText,
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
    ...jakartaExtraBoldText,
    fontSize: typography.meta,
  },
  articlesSectionCard: {
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  articlesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  articlesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  articlesIconWell: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  articlesCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  articlesCountBadgeText: {
    ...jakartaExtraBoldText,
    fontSize: typography.micro,
    lineHeight: 14,
  },
  articlesTearLine: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  articlesPrimaryAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  articlesPrimaryAddButtonText: {
    ...jakartaMediumText,
    fontSize: typography.caption,
    letterSpacing: 0.2,
    color: colors.textSecondary,
  },
  articlesAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  articlesAddButtonText: {
    ...jakartaExtraBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.2,
  },
  articlesInlineFormWrap: {
    gap: spacing.sm,
  },
  articlesBlock: {
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  articlesTableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  articlesTableHeadLabel: {
    flex: 1,
    minWidth: 0,
  },
  articlesTableHeadAmount: {
    textAlign: 'right',
    minWidth: 72,
  },
  articlesTableHeadAction: {
    width: 26,
    flexShrink: 0,
  },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  articleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  articleName: {
    fontSize: 13,
    letterSpacing: 0.3,
    lineHeight: 18,
  },
  articleCategory: {
    fontSize: 10,
    letterSpacing: 0.4,
    lineHeight: 14,
  },
  articlePrice: {
    fontSize: 13,
    letterSpacing: 0.3,
    flexShrink: 0,
    minWidth: 72,
    textAlign: 'right',
  },
  articleRemoveBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  articleTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  articleTotalLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  articleTotalValue: {
    fontSize: 13,
    letterSpacing: 0.4,
  },
  articlesEmptyText: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    letterSpacing: 0.4,
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
    ...jakartaMediumText,
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
    ...jakartaExtraBoldText,
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
    ...jakartaBoldText,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: '100%',
  },
  categoryChipText: {
    ...jakartaBoldText,
    fontSize: typography.meta,
    lineHeight: 16,
    flexShrink: 1,
  },
  accountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
    ...jakartaBoldText,
    fontSize: typography.micro,
    lineHeight: 15,
    flexShrink: 1,
  },
  transferWarning: {
    ...jakartaBoldText,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  transferGroupLabel: {
    ...typographyKit.eyebrow,
  },
  transferGoalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  transferGoalChipText: {
    ...typographyKit.metaMedium,
    flexShrink: 1,
  },
});

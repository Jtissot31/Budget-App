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
  useWindowDimensions,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDraggableSheetGesture } from '@/lib/sheet/useDraggableSheetGesture';
import {
  isInlineArticleScrollTargetReady,
  type InlineArticleScrollTarget,
} from '@/components/AddArticleSheet';
import { BudgetCategoryPicker } from '@/components/BudgetCategoryPicker';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { SettingsSelectField } from '@/components/SettingsSelectField';
import type { SettingsPickerOption } from '@/components/SettingsPickerSheet';
import { GhostNumpad } from '@/components/GhostNumpad';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { TransactionArticlesReceiptCard } from '@/components/TransactionArticlesReceiptCard';
import { TransferModePicker, type TransferMode } from '@/components/TransferModePicker';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { formValidationError, type FormFeedback } from '@/lib/formFeedback';
import { DatePickerField } from '@/components/MinimalDatePicker';
import {
  CHIP_BORDER_WIDTH,
  CHIP_PADDING_HORIZONTAL,
  TYPE_TRANSACTION_CHIP_MIN_WIDTH,
  ICON_WELL_SIZE,
  chipSelectableShellStyle,
  colors,
  containerSurfaceStyle,
  FORM_SECTION_LABEL_STYLE,
  jakartaBoldText,
  jakartaExtraBoldText,
  interNumericExtraBoldText,
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
import {
  INCOME_CATEGORY,
  TRANSFER_CATEGORY,
  UNCATEGORIZED_TRANSACTION_CATEGORY,
  type IconName,
} from '@/constants/categoryOptions';
import { EXPENSE_DEFAULT_ICON, isExpenseDefaultIcon } from '@/lib/expenseIcon';
import { EXPENSE_MDI_ICON } from '@/lib/mdiIconCatalog';
import { MANUAL_ENTRY_ACCOUNTS } from '@/constants/manualEntryAccounts';
import {
  accountBalanceIconForKind,
  accountPickerRowPresentation,
} from '@/lib/accountBalancePresentation';
import {
  buildMerchantOverrideByNormalizedName,
  getMerchantOverrideForLabel,
  normalizeMerchantKey,
  searchMerchantNameSuggestions,
} from '@/lib/merchantLogo';
import { rememberMerchantLogo } from '@/lib/merchantLogoMemory';
import { useAppTheme } from '@/lib/themeContext';
import {
  adjustSavingsGoalCurrentAmount,
  adjustSimulatedAccountBalance,
  filterActiveCategoryBudgets,
  getCategories,
  getCategoryBudgets,
  getContacts,
  getLoans,
  getMerchantOverrides,
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
import { buildArticlesNoteLine, getRemainingArticleBudget, parseItemizedNote, type ItemizedNote } from '@/lib/itemizedNote';
import { parseScanItemsFromRoute } from '@/lib/receiptScan';
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
  countPaymentAccountUsage,
  sortByPaymentAccountUsage,
} from '@/lib/paymentAccountUsage';
import {
  getTransferReasonSuggestions,
  saveTransferReasonSuggestion,
} from '@/lib/transferReasonSuggestions';
import type {
  Category,
  Contact,
  Loan,
  MerchantOverride,
  SavingsGoal,
  SimulatedAccount,
  Transaction,
  TransactionType,
} from '@/types';
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

type TransferEndpoint = {
  id: string;
  label: string;
  sublabel: string;
  kind: 'account' | 'goal';
  isSimulated: boolean;
  icon: string;
  logoUrl?: string | null;
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
  const sectionLabelStyle = [FORM_SECTION_LABEL_STYLE, { color: colors.text }];
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
  const [merchantOverrides, setMerchantOverrides] = useState<MerchantOverride[]>([]);
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
  /** Once the user (or route/edit/income flow) picks an account, stop auto-syncing to most-used. */
  const accountManuallySelectedRef = useRef(Boolean(routeAccountId));
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
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [scanPrefillApplied, setScanPrefillApplied] = useState(false);
  const [iconPickedManually, setIconPickedManually] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formFeedback, setFormFeedback] = useState<FormFeedback | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<FormFieldKey>>(() => new Set());
  const { height: windowHeight } = useWindowDimensions();
  const labelInputRef = useRef<TextInput>(null);
  const transferReasonInputRef = useRef<TextInput>(null);
  const sheetScrollRef = useRef<Animated.ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const inlineArticleFormRef = useRef<View>(null);
  const inlineArticleEditingRef = useRef(false);
  const inlineArticleScrollTargetRef = useRef<InlineArticleScrollTarget>({
    nameTop: 0,
    nameBottom: 0,
    extentBottom: 0,
  });
  const inlineArticleScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inlineArticleScrollRafRef = useRef<number | null>(null);
  const sheetScrollViewportHeightRef = useRef(0);
  const amountSectionYRef = useRef(0);
  const nameSectionYRef = useRef(0);
  const incomeSourceFieldBottomYRef = useRef(0);
  const transferReasonSectionYRef = useRef(0);
  const incomeReasonSectionYRef = useRef(0);
  const categorySectionYRef = useRef(0);
  const sourceAccountSectionYRef = useRef(0);
  const destinationAccountSectionYRef = useRef(0);
  const lastAutocompleteScrollKeyRef = useRef('');
  const labelInputFocusedRef = useRef(false);
  const pendingIncomeContactScrollRef = useRef(false);

  const merchantOverrideMap = useMemo(
    () => buildMerchantOverrideByNormalizedName(merchantOverrides),
    [merchantOverrides],
  );

  const merchantHistoryNames = useMemo(() => {
    const names: string[] = [];
    for (const tx of allTransactions) {
      if (tx.type !== 'expense') continue;
      const trimmed = tx.label.trim();
      if (trimmed) names.push(trimmed);
    }
    for (const override of merchantOverrides) {
      if (override.hidden) continue;
      names.push(override.displayName?.trim() || override.originalName);
    }
    return names;
  }, [allTransactions, merchantOverrides]);

  const merchantSuggestions = useMemo(() => {
    if (type !== 'expense') return [];
    if (normalizeMerchantKey(debouncedLabel).length < 2) return [];
    return searchMerchantNameSuggestions(debouncedLabel, merchantHistoryNames, 5);
  }, [debouncedLabel, merchantHistoryNames, type]);

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
          : type === 'income'
            ? cats.find((c) => c.id === INCOME_CATEGORY.id || c.name === 'Revenus') ?? INCOME_CATEGORY
            : cats.find((c) => c.name !== 'Revenus') ?? cats[0];
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
    if (routeAccountId) {
      accountManuallySelectedRef.current = true;
      setAccountId(routeAccountId);
    }
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
    void getMerchantOverrides().then(setMerchantOverrides);
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
  const paymentAccountUsageCounts = useMemo(
    () => countPaymentAccountUsage(allTransactions),
    [allTransactions],
  );

  const accountOptions = useMemo<PaymentAccountOption[]>(() => {
    const unsorted: PaymentAccountOption[] =
      simulatedAccounts.length > 0
        ? simulatedAccounts.map((account) => {
            const row = accountPickerRowPresentation(account);
            return {
              id: account.id,
              label: row.fieldLabel,
              isSimulated: true,
            };
          })
        : MANUAL_ENTRY_ACCOUNTS.map((account) => ({
            id: account.id,
            label: account.label,
            isSimulated: false,
          }));
    return sortByPaymentAccountUsage(unsorted, paymentAccountUsageCounts);
  }, [paymentAccountUsageCounts, simulatedAccounts]);

  const accountPickerOptions = useMemo<SettingsPickerOption<string>[]>(() => {
    const unsorted: SettingsPickerOption<string>[] =
      simulatedAccounts.length > 0
        ? simulatedAccounts.map((account) => {
            const row = accountPickerRowPresentation(account);
            return {
              id: account.id,
              label: row.label,
              description: row.description,
              fieldLabel: row.fieldLabel,
              icon: row.icon,
              logoUrl: row.logoUrl,
            };
          })
        : (() => {
            const manualIcons: Record<string, string> = {
              checking: 'wallet-outline',
              credit: 'card-outline',
              savings: 'cash-outline',
            };
            return MANUAL_ENTRY_ACCOUNTS.map((account) => ({
              id: account.id,
              label: account.label,
              description:
                account.id === 'checking' ? 'Chèque' : account.id === 'credit' ? 'Crédit' : 'Épargne',
              icon: manualIcons[account.id] ?? 'wallet-outline',
            }));
          })();
    return sortByPaymentAccountUsage(unsorted, paymentAccountUsageCounts);
  }, [paymentAccountUsageCounts, simulatedAccounts]);

  const transferEndpoints = useMemo<TransferEndpoint[]>(() => {
    const accountEntries: TransferEndpoint[] =
      simulatedAccounts.length > 0
        ? simulatedAccounts.map((account) => {
            const row = accountPickerRowPresentation(account);
            return {
              id: account.id,
              label: row.label,
              sublabel: row.description,
              kind: 'account' as const,
              isSimulated: true,
              icon: row.icon,
              logoUrl: row.logoUrl,
              color: colors.textSecondary,
            };
          })
        : accountOptions.map((a) => ({
            id: a.id,
            label: a.label.split(' · ')[0] ?? a.label.split(' • ')[0] ?? a.label,
            sublabel: a.label.includes(' · ')
              ? `••${a.label.split(' · ')[1]}`
              : a.label.includes(' • ')
                ? `••${a.label.split(' • ')[1]}`
                : 'Compte',
            kind: 'account' as const,
            isSimulated: a.isSimulated,
            icon: accountBalanceIconForKind(
              a.id === 'credit' ? 'credit' : a.id === 'savings' ? 'savings' : a.id === 'cash' ? 'cash' : 'checking',
            ),
            logoUrl: null,
            color: colors.textSecondary,
          }));
    const sortedAccountEntries = sortByPaymentAccountUsage(accountEntries, paymentAccountUsageCounts);
    const goalEntries: TransferEndpoint[] = savingsGoals.map((g) => ({
      id: g.id,
      label: g.name,
      sublabel: `${formatNumberDisplay(Math.round(g.currentAmount))} $`,
      kind: 'goal',
      isSimulated: false,
      icon: (g.icon as string) || 'flag-outline',
      logoUrl: null,
      color: g.color || colors.primary,
    }));
    return [...sortedAccountEntries, ...goalEntries];
  }, [
    accountOptions,
    colors.primary,
    colors.textSecondary,
    paymentAccountUsageCounts,
    savingsGoals,
    simulatedAccounts,
  ]);

  const transferSourcePickerOptions = useMemo<SettingsPickerOption<string>[]>(
    () =>
      transferEndpoints.map((endpoint) => {
        const last4Match = endpoint.sublabel.match(/••(\d{4})/);
        return {
          id: endpoint.id,
          label: endpoint.label,
          description: endpoint.sublabel,
          fieldLabel:
            endpoint.kind === 'account' && last4Match
              ? `${endpoint.label} · ${last4Match[1]}`
              : undefined,
          icon: endpoint.icon,
          logoUrl: endpoint.logoUrl,
        };
      }),
    [transferEndpoints],
  );

  const transferDestinationPickerOptions = useMemo(
    () => transferSourcePickerOptions.filter((option) => option.id !== accountId),
    [accountId, transferSourcePickerOptions],
  );

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
      accountManuallySelectedRef.current = true;
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

    setAccountId((current) => {
      if (!accountOptions.some((account) => account.id === current)) return firstAccount.id;
      // New expense/income: prefer most-used (first after usage sort) until the user picks.
      if (!editId && !accountManuallySelectedRef.current) return firstAccount.id;
      return current;
    });
    setDestinationAccountId((current) =>
      accountOptions.some((account) => account.id === current)
        ? current
        : defaultDestination.id,
    );
  }, [accountOptions, editId]);

  const selectPaymentAccount = useCallback((id: string) => {
    accountManuallySelectedRef.current = true;
    setAccountId(id);
  }, []);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const maxArticlePrice = useMemo(() => {
    if (type !== 'expense') return undefined;
    const transactionTotal = parseFormattedNumber(amount);
    // No cap until a positive transaction amount is set — avoids false « entièrement réparti ».
    if (!Number.isFinite(transactionTotal) || transactionTotal <= 0) return undefined;
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
    [],
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
  const labelHasLogo = useMemo(() => {
    const override = getMerchantOverrideForLabel(label, merchantOverrideMap);
    return hasMerchantLogoCandidate(label, override);
  }, [label, merchantOverrideMap]);
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
  const hasTransferEndpoints = transferEndpoints.length > 0;

  useEffect(() => {
    if (!isStandardTransfer || accountId !== destinationAccountId) return;

    const nextDestinationId = transferDestinationPickerOptions[0]?.id ?? null;
    if (nextDestinationId && nextDestinationId !== destinationAccountId) {
      setDestinationAccountId(nextDestinationId);
    }
  }, [
    accountId,
    destinationAccountId,
    isStandardTransfer,
    transferDestinationPickerOptions,
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

  const INLINE_ARTICLE_FORM_PADDING = 96;
  const INLINE_ARTICLE_FORM_TOP_OFFSET = 16;
  const INLINE_ARTICLE_NAME_VIEWPORT_RATIO = 0.22;
  const INLINE_ARTICLE_NAME_MIN_TOP = spacing.lg + INLINE_ARTICLE_FORM_TOP_OFFSET;
  const INLINE_ARTICLE_SCROLL_OFFSET = 24;
  const SHEET_TOP_MARGIN = 88;
  const inlineArticleForcedScrollExtent = Math.round(windowHeight * 0.12);

  const estimateInlineArticleKeyboardInset = useCallback(() => {
    if (keyboardInset > 0) return keyboardInset;
    if (!inlineArticleEditingRef.current) return 0;
    return Math.min(Math.round(windowHeight * 0.38), 360);
  }, [keyboardInset, windowHeight]);

  const cancelPendingInlineArticleScroll = useCallback(() => {
    if (inlineArticleScrollTimerRef.current != null) {
      clearTimeout(inlineArticleScrollTimerRef.current);
      inlineArticleScrollTimerRef.current = null;
    }
    if (inlineArticleScrollRafRef.current != null) {
      cancelAnimationFrame(inlineArticleScrollRafRef.current);
      inlineArticleScrollRafRef.current = null;
    }
  }, []);

  const performInlineArticleScroll = useCallback(() => {
    const content = scrollContentRef.current;
    const field = inlineArticleFormRef.current;
    if (!content || !field) return;

    const { nameTop, nameBottom, extentBottom } = inlineArticleScrollTargetRef.current;
    if (!isInlineArticleScrollTargetReady({ nameTop, nameBottom, extentBottom })) {
      // Form just opened — scroll the articles card into a comfortable band
      // before name/layout metrics are ready.
      field.measureLayout(
        content,
        (_x, formY) => {
          const viewportHeight = Math.max(
            sheetScrollViewportHeightRef.current > 0
              ? sheetScrollViewportHeightRef.current
              : windowHeight - SHEET_TOP_MARGIN,
            1,
          );
          const desiredTop = Math.max(
            INLINE_ARTICLE_NAME_MIN_TOP,
            Math.round(viewportHeight * INLINE_ARTICLE_NAME_VIEWPORT_RATIO),
          );
          sheetScrollRef.current?.scrollTo({
            y: Math.max(formY - desiredTop, 0),
            animated: true,
          });
        },
        () => {},
      );
      return;
    }

    field.measureLayout(
      content,
      (_x, formY) => {
        const viewportHeight = Math.max(
          sheetScrollViewportHeightRef.current > 0
            ? sheetScrollViewportHeightRef.current
            : windowHeight - SHEET_TOP_MARGIN,
          1,
        );
        const effectiveKeyboardInset = estimateInlineArticleKeyboardInset();
        const visibleBottom = viewportHeight - effectiveKeyboardInset;

        const nameTopY = formY + nameTop;
        const extentBottomY = formY + (extentBottom > 0 ? extentBottom : nameBottom);

        const desiredNameTop = Math.max(
          INLINE_ARTICLE_NAME_MIN_TOP,
          Math.round(visibleBottom * INLINE_ARTICLE_NAME_VIEWPORT_RATIO),
        );

        let scrollY = Math.max(nameTopY - desiredNameTop, 0);

        if (effectiveKeyboardInset > 0 && extentBottom > 0) {
          const scrollForKeyboard = extentBottomY - visibleBottom + INLINE_ARTICLE_SCROLL_OFFSET;
          if (scrollForKeyboard > 0) {
            scrollY = Math.max(scrollY, scrollForKeyboard);
          }
        }

        const maxScrollBeforeOvershoot = Math.max(nameTopY - INLINE_ARTICLE_NAME_MIN_TOP, 0);
        if (effectiveKeyboardInset <= 0) {
          scrollY = Math.min(scrollY, maxScrollBeforeOvershoot);
        }

        sheetScrollRef.current?.scrollTo({
          y: Math.max(scrollY, 0),
          animated: true,
        });
      },
      () => {},
    );
  }, [estimateInlineArticleKeyboardInset, windowHeight]);

  const scheduleInlineArticleScroll = useCallback((delayMs = 100) => {
    cancelPendingInlineArticleScroll();
    inlineArticleScrollTimerRef.current = setTimeout(() => {
      inlineArticleScrollTimerRef.current = null;
      inlineArticleScrollRafRef.current = requestAnimationFrame(() => {
        inlineArticleScrollRafRef.current = requestAnimationFrame(() => {
          inlineArticleScrollRafRef.current = null;
          performInlineArticleScroll();
        });
      });
    }, delayMs);
  }, [cancelPendingInlineArticleScroll, performInlineArticleScroll]);

  const handleInlineArticleScrollTargetChange = useCallback((target: InlineArticleScrollTarget) => {
    if (!isInlineArticleScrollTargetReady(target)) return;
    const prev = inlineArticleScrollTargetRef.current;
    const changed =
      prev.nameTop !== target.nameTop
      || prev.nameBottom !== target.nameBottom
      || prev.extentBottom !== target.extentBottom;
    inlineArticleScrollTargetRef.current = target;
    if (changed) {
      scheduleInlineArticleScroll();
    }
  }, [scheduleInlineArticleScroll]);

  const scrollToInlineArticle = useCallback((localY: number, offset = 16) => {
    const content = scrollContentRef.current;
    const field = inlineArticleFormRef.current;
    if (!content || !field) return;

    field.measureLayout(
      content,
      (_x, formY) => {
        requestAnimationFrame(() => {
          sheetScrollRef.current?.scrollTo({
            y: Math.max(formY + localY - offset, 0),
            animated: true,
          });
        });
      },
      () => {},
    );
  }, []);

  const handleInlineArticleContentLayout = useCallback(() => {
    if (!inlineArticleExpanded) return;
    scheduleInlineArticleScroll();
  }, [inlineArticleExpanded, scheduleInlineArticleScroll]);

  const handleInlineArticleNameFocusChange = useCallback((focused: boolean) => {
    inlineArticleEditingRef.current = focused;
    if (focused) {
      scheduleInlineArticleScroll();
    }
  }, [scheduleInlineArticleScroll]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates.height);
      if (inlineArticleEditingRef.current) {
        scheduleInlineArticleScroll();
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scheduleInlineArticleScroll]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const syncWebKeyboardInset = () => {
      if (!inlineArticleExpanded) return;
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardInset((current) => {
        const next = inset > 72 ? Math.round(inset) : 0;
        return current === next ? current : next;
      });
      if (inset > 72 && inlineArticleEditingRef.current) {
        scheduleInlineArticleScroll();
      }
    };

    viewport.addEventListener('resize', syncWebKeyboardInset);
    viewport.addEventListener('scroll', syncWebKeyboardInset);
    return () => {
      viewport.removeEventListener('resize', syncWebKeyboardInset);
      viewport.removeEventListener('scroll', syncWebKeyboardInset);
    };
  }, [inlineArticleExpanded, scheduleInlineArticleScroll]);

  useEffect(() => () => cancelPendingInlineArticleScroll(), [cancelPendingInlineArticleScroll]);

  useEffect(() => {
    if (!inlineArticleExpanded) return;
    scheduleInlineArticleScroll(120);
  }, [inlineArticleExpanded, scheduleInlineArticleScroll]);

  const sheetContentContainerStyle = useMemo(() => {
    const basePaddingBottom = Math.max(insets.bottom, 20);
    let activePaddingBottom = basePaddingBottom;

    if (inlineArticleExpanded) {
      activePaddingBottom = Math.max(
        activePaddingBottom,
        basePaddingBottom + INLINE_ARTICLE_FORM_PADDING,
        inlineArticleForcedScrollExtent,
      );
    }

    if (inlineArticleExpanded && keyboardInset > 0) {
      activePaddingBottom = Math.max(
        activePaddingBottom,
        keyboardInset + spacing.xl + INLINE_ARTICLE_FORM_PADDING,
      );
    }

    const minHeight =
      inlineArticleExpanded && keyboardInset > 0
        ? Math.max(
            (sheetScrollViewportHeightRef.current > 0
              ? sheetScrollViewportHeightRef.current
              : windowHeight - SHEET_TOP_MARGIN) + keyboardInset + spacing.lg,
            0,
          )
        : undefined;

    return [
      styles.sheetContent,
      {
        paddingBottom: activePaddingBottom,
        ...(minHeight != null ? { minHeight } : {}),
      },
    ];
  }, [
    inlineArticleExpanded,
    inlineArticleForcedScrollExtent,
    insets.bottom,
    keyboardInset,
    windowHeight,
  ]);

  const handleSheetContentSizeChange = useCallback(() => {
    if (!inlineArticleExpanded) return;
    scheduleInlineArticleScroll();
  }, [inlineArticleExpanded, scheduleInlineArticleScroll]);

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
        accountManuallySelectedRef.current = true;
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
    const isIncomeSave = type === 'income' && !saveAsPersonTransferFrom && !saveAsStandardTransfer;
    const resolvedCategoryId = saveAsStandardTransfer
      ? TRANSFER_CATEGORY.id
      : isIncomeSave
        ? INCOME_CATEGORY.id
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

    // Income never asks for a budget category — expense (and person transfers) still require one.
    if (
      !isIncomeSave &&
      (!resolvedCategoryId ||
        (isExpenseSave && resolvedCategoryId === UNCATEGORIZED_TRANSACTION_CATEGORY.id))
    ) {
      markInvalid(
        'category',
        formValidationError('Catégorie', 'Sélectionne une catégorie pour continuer'),
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
    if (isIncomeSave) {
      await upsertCategory(INCOME_CATEGORY);
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

    if (isExpenseSave && transactionLabel) {
      // Learn merchant → logo so future typing auto-applies the same mark.
      void rememberMerchantLogo(transactionLabel).catch(() => {});
    }

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

  const sheetDragHeight = Math.min(windowHeight * 0.92, Math.max(windowHeight - SHEET_TOP_MARGIN, 1));
  const closeSheet = useCallback(() => {
    router.back();
  }, [router]);
  const {
    panGesture,
    scrollNativeGesture,
    scrollHandler,
    sheetAnimatedStyle,
    backdropAnimatedStyle,
    requestClose,
  } = useDraggableSheetGesture({
    onClose: closeSheet,
    sheetHeight: sheetDragHeight,
    scrollable: true,
  });

  return (
    <GestureHandlerRootView style={[styles.screen, styles.modalBackdrop]}>
      <Animated.View style={[styles.dragBackdrop, themed.modalBackdrop, backdropAnimatedStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Fermer" />
      </Animated.View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalKeyboard}
      >
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.sheet, themed.sheet, sheetAnimatedStyle]}>
            <GestureDetector gesture={scrollNativeGesture}>
              <Animated.ScrollView
                ref={sheetScrollRef}
                style={styles.sheetScroll}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScrollBeginDrag={() => Keyboard.dismiss()}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={sheetContentContainerStyle}
                onLayout={(event) => {
                  sheetScrollViewportHeightRef.current = event.nativeEvent.layout.height;
                }}
                onContentSizeChange={handleSheetContentSizeChange}
              >
              <View ref={scrollContentRef} collapsable={false} style={styles.sheetContentInner}>
              <View style={styles.handleHitArea}>
                <View style={[styles.handle, themed.handle]} />
              </View>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, themed.text]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                  {sheetTitle}
                </Text>
                <Pressable onPress={requestClose} hitSlop={12} style={[styles.sheetClose, themed.closeButton]}>
                  <AppIcon family="ionicons" name="close" size={19} color={colors.textMuted} />
                </Pressable>
              </View>

              {!routeType && (
                <View style={styles.section}>
                  <DashboardSectionLabel style={sectionLabelStyle}>Type</DashboardSectionLabel>
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
                  <DashboardSectionLabel style={sectionLabelStyle}>
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
                  <DashboardSectionLabel style={sectionLabelStyle}>
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
                  <DashboardSectionLabel style={sectionLabelStyle}>Raison du revenu</DashboardSectionLabel>
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
                labelStyle={sectionLabelStyle}
              />

              {type === 'expense' ? (
                <View style={styles.section}>
                  <SettingsSelectField
                    label="Méthode de paiement"
                    options={accountPickerOptions}
                    selectedId={accountId}
                    onSelect={(id) => {
                      tapHaptic();
                      selectPaymentAccount(id);
                    }}
                    pickerTitle="Compte de paiement"
                    placeholder="Choisir un compte"
                    emptyHint="Ajoute un compte pour enregistrer la dépense."
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
                  <SettingsSelectField
                    label="Compte de dépôt"
                    options={accountPickerOptions}
                    selectedId={accountId}
                    onSelect={(id) => {
                      tapHaptic();
                      selectPaymentAccount(id);
                    }}
                    pickerTitle="Compte de paiement"
                    placeholder="Choisir un compte"
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
                  <SettingsSelectField
                    label="Compte de dépôt"
                    options={accountPickerOptions}
                    selectedId={accountId}
                    onSelect={(id) => {
                      tapHaptic();
                      selectPaymentAccount(id);
                    }}
                    pickerTitle="Compte de paiement"
                    placeholder="Choisir un compte"
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

              {isStandardTransfer ? (
                <View
                  style={[
                    styles.section,
                    fieldHasError('sourceAccount') && styles.validationOutline,
                    fieldHasError('sourceAccount') && fieldErrorBorder,
                  ]}
                  onLayout={(e) => { sourceAccountSectionYRef.current = e.nativeEvent.layout.y; }}
                >
                  {!hasTransferEndpoints ? (
                    <Text style={[styles.sectionHint, themed.textMuted]}>Aucun compte ou objectif trouvé.</Text>
                  ) : (
                    <SettingsSelectField
                      label="De"
                      options={transferSourcePickerOptions}
                      selectedId={accountId}
                      onSelect={(id) => {
                        tapHaptic();
                        clearFieldError('sourceAccount');
                        clearFieldError('destinationAccount');
                        selectPaymentAccount(id);
                      }}
                      pickerTitle="Compte source"
                      placeholder="Choisir une source"
                    />
                  )}
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
                  <SettingsSelectField
                    label="Compte source"
                    options={accountPickerOptions}
                    selectedId={accountId}
                    onSelect={(id) => {
                      tapHaptic();
                      clearFieldError('sourceAccount');
                      selectPaymentAccount(id);
                    }}
                    pickerTitle="Compte source"
                    placeholder="Choisir un compte"
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
                  <SettingsSelectField
                    label="Vers"
                    options={transferDestinationPickerOptions}
                    selectedId={destinationAccountId}
                    onSelect={(id) => {
                      tapHaptic();
                      clearFieldError('sourceAccount');
                      clearFieldError('destinationAccount');
                      setDestinationAccountId(id);
                    }}
                    pickerTitle="Compte destination"
                    placeholder="Choisir une destination"
                    emptyHint="Aucun compte ou objectif trouvé."
                  />
                  {accountId === destinationAccountId ? (
                    <Text style={[styles.transferWarning, { color: colors.warning }]}>Sélectionne deux sources différentes.</Text>
                  ) : null}
                </View>
              ) : null}

              {type === 'expense' ? (
                <TransactionArticlesReceiptCard
                  articles={articles}
                  colors={colors}
                  inlineArticleExpanded={inlineArticleExpanded}
                  maxArticlePrice={maxArticlePrice ?? null}
                  inlineArticleFormRef={inlineArticleFormRef}
                  scrollToOffset={scrollToInlineArticle}
                  onInlineScrollTargetChange={handleInlineArticleScrollTargetChange}
                  onNameFocusChange={handleInlineArticleNameFocusChange}
                  onContentLayout={handleInlineArticleContentLayout}
                  onOpenInlineArticle={() => {
                    tapHaptic();
                    setInlineArticleExpanded(true);
                    scheduleInlineArticleScroll(120);
                  }}
                  onCloseInlineArticle={() => {
                    setInlineArticleExpanded(false);
                    inlineArticleEditingRef.current = false;
                    inlineArticleScrollTargetRef.current = {
                      nameTop: 0,
                      nameBottom: 0,
                      extentBottom: 0,
                    };
                  }}
                  onAddArticle={(name, price, articleCategoryId, categoryName) =>
                    handleAddArticle(name, price, articleCategoryId, categoryName)
                  }
                  onRemoveArticle={handleRemoveArticle}
                />
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
              </View>
              </Animated.ScrollView>
            </GestureDetector>
          </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
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
  dragBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalKeyboard: { flex: 1, justifyContent: 'flex-end' },
  pressed: { opacity: 0.72 },
  sheet: {
    marginTop: 88,
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sheetContentInner: {
    // Major form blocks (merchant, amount, date, payment, category, articles)
    gap: spacing.xl,
  },
  handleHitArea: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 8,
    minHeight: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
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
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  amountValidationSection: {
    gap: spacing.md,
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
    ...interNumericExtraBoldText,
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
    borderRadius: radius.pill,
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
    borderRadius: radius.pill,
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
    borderRadius: radius.pill,
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
    borderRadius: radius.pill,
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
    borderRadius: radius.pill,
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { CASH_BANKNOTES_ICON } from '@/components/icons/CashBanknotesOutlineIcon';
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  DraggableSheetScrollView,
  DraggableSheetSurface,
} from '@/components/DraggableSheetSurface';
import {
  FormSheetModalBody,
  formSheetScrollContentStyle,
  formSheetScrollPaddingBottom,
  formSheetScrollViewStyle,
  useFormSheetHeight,
} from '@/lib/sheet/formSheetScroll';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { OnyxContainer } from '@/components/OnyxContainer';
import { ProtoSectionHeader } from '@/components/proto/ProtoSectionHeader';
import { AccountDetailHeroCard } from '@/components/wallet/AccountCardPrototypes';
import { IconPickerSheet } from '@/components/IconPickerSheet';
import { MdiIcon } from '@/components/MdiIcon';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import {
  FixedScreenHeader,
  fixedHeaderScrollStyle,
  fixedHeaderScreenStyle,
} from '@/components/FixedScreenHeader';
import { OverflowMenuButton } from '@/components/OverflowMenuButton';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { formValidationError, type FormFeedback } from '@/lib/formFeedback';
import { PageTransition } from '@/components/PageTransition';
import { LogoIconFrame } from '@/components/IconFrame';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { getMerchantLogoUrl } from '@/lib/merchantLogo';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TransactionRow } from '@/components/TransactionRow';
import {
  frequencyLabel,
  manualAccountOptions,
  RecurringPaymentFormModal,
  recurringPaymentToForm,
  saveRecurringPaymentForm,
  toAccountOptions,
  type PaymentForm,
} from '@/lib/recurringPaymentsForm';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import {
  colors,
  FLOATING_NAV_CONTENT_PADDING,
  FORM_SECTION_LABEL_STYLE,
  ICON_WELL_SIZE,
  containerSurfaceStyle,
  destructiveIconColor,
  destructiveTextActionStyle,
  jakartaBoldText,
  jakartaExtraBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  moneyAmountTypography,
  radius,
  spacing,
  subtleDeleteButtonStyle,
  typography,
  typographyKit,
} from '@/constants/theme';
import { nativeTextColumnFlex } from '@/lib/textLayout';
import {
  deleteSimulatedAccount,
  getCategoryBudgets,
  getLoans,
  getRecurringPayments,
  getSavingsGoals,
  getSimulatedAccounts,
  getTransactions,
  insertSimulatedAccount,
  sortTransactionsNewestFirst,
} from '@/lib/db';
import { ensureCategoryInPickerList, loadRecurringPickerCategories } from '@/lib/budgetCategories';
import { dataEvents } from '@/lib/events';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import { openTransactionDetail } from '@/lib/openTransactionDetail';
import {
  getAccountLogoAsset,
  getAccountLogoUrl,
  getStableAccountLogoUrl,
} from '@/lib/merchantLogo';
import {
  ACCOUNT_ICON_PICKER_OPTIONS,
  accountBalanceIconForKind,
} from '@/lib/accountBalancePresentation';
import type { MdiIconName } from '@/lib/mdiIconCatalog';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';import { useAppTheme } from '@/lib/themeContext';
import { parseIsoDay } from '@/lib/estimatedPaycheck';
import {
  buildLoanByRecurringPaymentId,
  resolveRecurringPaymentDisplayIconById,
} from '@/lib/recurringPaymentPresentation';
import { TransactionAmountLabel, recurringPaymentAmountDirection } from '@/components/TransactionAmountLabel';
import { formatDisplayMoneyAbsolute, formatRecurringPaymentAmount } from '@/lib/formatDisplayMoney';
import { parseFormattedNumber, sanitizeNumericInput } from '@/lib/formatNumber';
import { UNIFORM_SECTION_HEADER_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import {
  filterTransactionsByType,
  formatTransactionGroupDateLabel,
  groupTransactionsByDay,
  HISTORY_FILTER_OPTIONS,
  type HistoryTypeFilter,
  transactionMatchesSearch,
} from '@/lib/transactionListUtils';
import type { AccountKind, Category, CategoryBudget, Loan, RecurringPayment, SavingsGoal, SimulatedAccount, Transaction } from '@/types';

function formatMoney(value: number) {
  return formatDisplayMoneyAbsolute(value);
}

function accountEditFormTitle(kind: AccountKind) {
  if (kind === 'credit') return 'Modifier la carte de crédit';
  if (kind === 'savings') return 'Modifier le compte épargne';
  if (kind === 'cash') return 'Modifier Argent Cash';
  return 'Modifier le compte chèque';
}

const SUBSCRIPTION_CATEGORY_PATTERN = /abonnement|subscription|loisir|divertissement|streaming/;
const RECURRING_ICON_SIZE = 40;
const RECURRING_TRIGGER_ICON_SIZE = 17;

function recurringPaymentTypeLabel(payment: RecurringPayment) {
  if ((payment.kind ?? 'payment') === 'income') return 'Revenu récurrent';
  if (payment.categoryId === 'cat-fun') return 'Abonnement';
  if (SUBSCRIPTION_CATEGORY_PATTERN.test((payment.categoryName ?? '').trim().toLowerCase())) return 'Abonnement';
  return 'Facture';
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonthsClamped(date: Date, months: number) {
  const day = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const dim = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, dim));
  next.setHours(0, 0, 0, 0);
  return next;
}

function occurrenceDateAt(firstDate: Date, frequency: RecurringPayment['frequency'], index: number) {
  if (frequency === 'weekly') return addDays(firstDate, index * 7);
  if (frequency === 'biweekly') return addDays(firstDate, index * 14);
  if (frequency === 'yearly') return addMonthsClamped(firstDate, index * 12);
  return addMonthsClamped(firstDate, index);
}

function nextRecurringOccurrence(payment: RecurringPayment, from: Date) {
  const firstDate = parseIsoDay(payment.nextDate);
  if (!firstDate) return null;

  const endDate = parseIsoDay(payment.endDate);
  let index = 0;
  let occurrence = occurrenceDateAt(firstDate, payment.frequency, index);
  while (occurrence < from && index < 1200) {
    index += 1;
    occurrence = occurrenceDateAt(firstDate, payment.frequency, index);
  }
  if (occurrence < from) return null;
  if (endDate && occurrence > endDate) return null;
  return occurrence;
}

function formatRecurringNextDate(date: Date) {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function recurringPaymentDefinitionMeta(payment: RecurringPayment, from: Date) {
  const parts = [recurringPaymentTypeLabel(payment)];
  if (!payment.active) parts.push('Inactif');
  parts.push(frequencyLabel(payment.frequency));
  const next = payment.active ? nextRecurringOccurrence(payment, from) : null;
  if (next) parts.push(formatRecurringNextDate(next));
  return parts.join(' · ');
}

function DetailRow({
  label,
  value,
  valueColor,
  isLast,
}: {
  label: string;
  value: string;
  valueColor?: string;
  isLast?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.detailRow, !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: valueColor ?? colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function FlowStatColumn({
  label,
  value,
  valueColor,
  align = 'left',
}: {
  label: string;
  value: string;
  valueColor?: string;
  align?: 'left' | 'right';
}) {
  const { colors } = useAppTheme();
  const textAlign = align === 'right' ? 'right' : 'left';

  return (
    <View style={[styles.flowCol, align === 'right' && styles.flowColEnd]}>
      <Text
        style={[
          moneyAmountTypography({ tier: 'card', textAlign }),
          { color: valueColor ?? colors.text },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      <Text
        style={[typographyKit.microUpper, { color: colors.textMuted, textAlign }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function CheckingMonthlyStatsRow({
  revenues,
  expenses,
}: {
  revenues: number;
  expenses: number;
}) {
  const { colors } = useAppTheme();

  return (
    <OnyxContainer style={styles.flowCard}>
      <FlowStatColumn
        label="Revenu"
        value={`+${formatMoney(revenues)}`}
        valueColor={colors.success}
      />
      <View style={[styles.flowRule, { backgroundColor: colors.borderSubtle }]} />
      <FlowStatColumn
        label="Dépense"
        value={`−${formatMoney(expenses)}`}
        align="right"
      />
    </OnyxContainer>
  );
}

function StatementStatsRow({
  stats,
}: {
  stats: Array<{ label: string; value: string; valueColor?: string }>;
}) {
  const { colors } = useAppTheme();

  return (
    <OnyxContainer style={styles.flowCard}>
      {stats.flatMap((stat, index) => {
        const column = (
          <FlowStatColumn
            key={stat.label}
            label={stat.label}
            value={stat.value}
            valueColor={stat.valueColor}
            align={index === stats.length - 1 ? 'right' : 'left'}
          />
        );
        if (index === 0) return [column];
        return [
          <View
            key={`rule-${stat.label}`}
            style={[styles.flowRule, { backgroundColor: colors.borderSubtle }]}
          />,
          column,
        ];
      })}
    </OnyxContainer>
  );
}

function RecurringChevron({ expanded, color }: { expanded: boolean; color: string }) {
  const rotation = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    rotation.value = withTiming(expanded ? 1 : 0, { duration: 220 });
  }, [expanded, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <AppIcon family="ionicons" name="chevron-down" size={16} color={color} />
    </Animated.View>
  );
}

export default function AccountDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const accountId = typeof params.accountId === 'string' ? params.accountId : '';
  const insets = useSafeAreaInsets();
  const editAccountSheetHeight = useFormSheetHeight(0.92);
  const scrollRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const { colors, ghost, ghostCardShadow, isLight } = useAppTheme();
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [search, setSearch] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<HistoryTypeFilter>('all');
  const [historyFiltersExpanded, setHistoryFiltersExpanded] = useState(false);
  const [showRecurringPayments, setShowRecurringPayments] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formFeedback, setFormFeedback] = useState<FormFeedback | null>(null);
  const [editingAccount, setEditingAccount] = useState<SimulatedAccount | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('checking');
  const [balance, setBalance] = useState('');
  const [institution, setInstitution] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [fullIconPickerVisible, setFullIconPickerVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState<SimulatedAccount | null>(null);
  const [recurringForm, setRecurringForm] = useState<PaymentForm | null>(null);
  const [recurringAccounts, setRecurringAccounts] = useState<ReturnType<typeof manualAccountOptions>>([]);
  const [recurringCategories, setRecurringCategories] = useState<Category[]>([]);
  const [recurringCategoryBudgets, setRecurringCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [recurringFeedback, setRecurringFeedback] = useState<FormFeedback | null>(null);

  const load = useCallback(async () => {
    const [nextAccounts, nextSavingsGoals, nextTransactions, nextRecurringPayments, nextLoans] = await Promise.all([
      getSimulatedAccounts(),
      getSavingsGoals(),
      getTransactions(),
      getRecurringPayments(),
      getLoans(),
    ]);
    setAccounts(nextAccounts);
    setSavingsGoals(nextSavingsGoals);
    setTransactions(nextTransactions);
    setRecurringPayments(nextRecurringPayments);
    setLoans(nextLoans);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setSearch('');
    setSearchExpanded(false);
    void load();
  }, [accountId, load]);

  useEffect(() => {
    if (!searchExpanded) return;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [searchExpanded]);

  useRefreshOnFocus(load);
  useEffect(() => dataEvents.subscribe(load), [load]);

  const account = useMemo(() => accounts.find((item) => item.id === accountId) ?? null, [accountId, accounts]);
  const linkedSavingsGoal = useMemo(
    () => savingsGoals.find((goal) => goal.id === account?.linkedSavingsGoalId) ?? null,
    [account?.linkedSavingsGoalId, savingsGoals],
  );
  const accountTransactions = useMemo(() => {
    if (!account) return [];
    return sortTransactionsNewestFirst(transactions.filter((tx) => transactionBelongsToAccount(tx, account)));
  }, [account, transactions]);
  const filteredAccountTransactions = useMemo(() => {
    const searched = search.trim()
      ? accountTransactions.filter((tx) => transactionMatchesSearch(tx, search))
      : accountTransactions;
    return filterTransactionsByType(searched, historyTypeFilter);
  }, [accountTransactions, historyTypeFilter, search]);
  const groupedAccountTransactions = useMemo(
    () => groupTransactionsByDay(filteredAccountTransactions),
    [filteredAccountTransactions],
  );
  const historyHasActiveFilters = search.trim().length > 0 || historyTypeFilter !== 'all';
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const loanByRecurringPaymentId = useMemo(
    () => buildLoanByRecurringPaymentId(loans),
    [loans],
  );

  const accountRecurringPayments = useMemo(() => {
    if (!account) return [];
    return recurringPayments
      .filter((payment) => payment.accountId === account.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [account, recurringPayments]);
  const monthlyTransactionStats = useMemo(() => {
    if (!account || (account.kind !== 'checking' && account.kind !== 'credit' && account.kind !== 'cash')) return null;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    let revenues = 0;
    let expenses = 0;
    accountTransactions.forEach((tx) => {
      const date = new Date(tx.date);
      if (date.getFullYear() !== currentYear || date.getMonth() !== currentMonth) return;
      if (tx.type === 'income') revenues += Math.abs(tx.amount);
      else if (tx.type === 'expense') expenses += Math.abs(tx.amount);
    });
    return { revenues, expenses };
  }, [account, accountTransactions]);
  const logoSourceName = institution.trim() || name.trim();
  const manualIcon = icon?.trim() || null;
  const previewLogoAsset = useMemo(() => {
    if (manualIcon) return null;
    if (kind === 'cash') return CASH_BANKNOTES_ICON;
    if (!logoSourceName) return null;
    return getAccountLogoAsset(logoSourceName);
  }, [kind, logoSourceName, manualIcon]);
  const previewLogo = useMemo(() => {
    if (manualIcon || previewLogoAsset) return null;
    if (kind === 'cash') return null;
    if (!logoSourceName) return null;
    return getStableAccountLogoUrl(logoSourceName) ?? getAccountLogoUrl(logoSourceName);
  }, [kind, logoSourceName, manualIcon, previewLogoAsset]);
  const previewIcon = manualIcon || accountBalanceIconForKind(kind);
  const hasIdentityContent = Boolean(
    manualIcon || previewLogoAsset || previewLogo || name.trim() || institution.trim(),
  );
  const sectionLabelStyle = [FORM_SECTION_LABEL_STYLE, { color: colors.text }];
  const formThemed = usePortfolioFormTheme();

  const resetForm = () => {
    setEditingAccount(null);
    setName('');
    setKind('checking');
    setBalance('');
    setInstitution('');
    setCreditLimit('');
    setDueDay('');
    setInterestRate('');
    setIcon(null);
    setShowIconPicker(false);
    setFullIconPickerVisible(false);
  };

  const openEditAccountForm = (nextAccount: SimulatedAccount) => {
    tapHaptic();
    setEditingAccount(nextAccount);
    setName(nextAccount.name);
    setKind(nextAccount.kind);
    setBalance(String(nextAccount.kind === 'credit' ? Math.abs(nextAccount.balance) : nextAccount.balance));
    setInstitution(nextAccount.institution ?? '');
    setCreditLimit(typeof nextAccount.creditLimit === 'number' ? String(nextAccount.creditLimit) : '');
    setDueDay(typeof nextAccount.dueDay === 'number' ? String(nextAccount.dueDay) : '');
    setInterestRate(typeof nextAccount.interestRate === 'number' ? String(nextAccount.interestRate) : '');
    setIcon(nextAccount.icon?.trim() || null);
    setShowIconPicker(false);
    setFullIconPickerVisible(false);
    setShowForm(true);
  };

  const closeForm = () => {
    resetForm();
    setFormFeedback(null);
    setShowForm(false);
  };

  const saveAccount = async () => {
    const parsedBalance = parseMoney(balance);
    if (!editingAccount) return;
    if (!name.trim()) {
      setFormFeedback(formValidationError('Nom requis', 'Exemple : Visa Desjardins, Tangerine chèque.'));
      return;
    }
    if (Number.isNaN(parsedBalance)) {
      setFormFeedback(formValidationError('Solde invalide', 'Entre un montant valide.'));
      return;
    }

    setFormFeedback(null);

    const nextAccount: SimulatedAccount = {
      id: editingAccount.id,
      name: name.trim(),
      kind,
      balance: kind === 'credit' ? -Math.abs(parsedBalance) : parsedBalance,
      institution: kind === 'cash' ? undefined : institution.trim() || undefined,
      last4: kind === 'credit' ? editingAccount.last4 : undefined,
      creditLimit: kind === 'credit' ? parseOptionalMoney(creditLimit) : undefined,
      dueDay: kind === 'credit' ? parseOptionalInt(dueDay) : undefined,
      interestRate: kind === 'savings' ? parseOptionalMoney(interestRate) : undefined,
      logoUrl: kind === 'cash' ? undefined : getStableAccountLogoUrl(logoSourceName) ?? undefined,
      icon: manualIcon,
      linkedSavingsGoalId: editingAccount.linkedSavingsGoalId ?? null,
      hidden: editingAccount.hidden,
      displayOrder: editingAccount.displayOrder,
      createdAt: editingAccount.createdAt,
    };

    await insertSimulatedAccount(nextAccount);
    successHaptic();
    closeForm();
    await load();
  };

  const confirmDeleteAccount = (nextAccount: SimulatedAccount) => {
    tapHaptic();
    setPendingDeleteAccount(nextAccount);
    setConfirmDeleteVisible(true);
  };

  const openEditRecurringPayment = useCallback(async (payment: RecurringPayment) => {
    tapHaptic();
    const [categories, categoryBudgets, simulatedAccounts] = await Promise.all([
      loadRecurringPickerCategories(),
      getCategoryBudgets(),
      getSimulatedAccounts(),
    ]);
    const accounts = toAccountOptions(simulatedAccounts);
    const pickerCategories =
      payment.kind === 'income'
        ? categories
        : ensureCategoryInPickerList(categories.filter((c) => c.name !== 'Revenus'), {
            id: payment.categoryId ?? '',
            name: payment.categoryName ?? '',
            icon: payment.categoryIcon,
            color: payment.categoryColor,
          });
    setRecurringAccounts(accounts.length ? accounts : manualAccountOptions());
    setRecurringCategories(pickerCategories);
    setRecurringCategoryBudgets(categoryBudgets);
    setRecurringForm(recurringPaymentToForm(payment));
    setRecurringFeedback(null);
  }, []);

  const collapseSearch = useCallback(() => {
    setSearch('');
    setSearchExpanded(false);
    searchInputRef.current?.blur();
  }, []);

  const expandSearch = useCallback(() => {
    tapHaptic();
    setSearchExpanded(true);
  }, []);

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
    successHaptic();
    await load();
  };

  return (
    <PageTransition animate={false}>
    <View style={[fixedHeaderScreenStyle, styles.screen, { backgroundColor: colors.background }]}>
      <FixedScreenHeader
        title={account?.name ?? 'Compte'}
        onBack={() => router.back()}
        trailing={
          account ? (
            <OverflowMenuButton
              accessibilityLabel="Options du compte"
              style={[
                styles.backButton,
                { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
              ]}
              items={[
                {
                  key: 'edit',
                  label: 'Modifier',
                  onPress: () => openEditAccountForm(account),
                },
                ...(account.kind !== 'cash'
                  ? [
                      {
                        key: 'delete',
                        label: 'Supprimer',
                        icon: 'trash-outline' as const,
                        destructive: true,
                        onPress: () => confirmDeleteAccount(account),
                      },
                    ]
                  : []),
              ]}
            />
          ) : undefined
        }
      />

      <ScrollView
        ref={scrollRef}
        style={fixedHeaderScrollStyle}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING },
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
      >
        {account ? (
          <>
            <AccountDetailHeroCard account={account} />

            {monthlyTransactionStats ? (
              <CheckingMonthlyStatsRow
                revenues={monthlyTransactionStats.revenues}
                expenses={monthlyTransactionStats.expenses}
              />
            ) : null}

            {account.kind === 'savings' && linkedSavingsGoal ? (
              <StatementStatsRow
                stats={[
                  { label: 'Épargné', value: formatMoney(linkedSavingsGoal.currentAmount) },
                  { label: 'Objectif', value: formatMoney(linkedSavingsGoal.targetAmount) },
                  {
                    label: 'Atteint',
                    value: `${Math.round(
                      linkedSavingsGoal.targetAmount > 0
                        ? (linkedSavingsGoal.currentAmount / linkedSavingsGoal.targetAmount) * 100
                        : 0,
                    )} %`,
                    valueColor: colors.primary,
                  },
                ]}
              />
            ) : null}

            <View style={styles.recurringSection}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Paiements récurrents liés à ce compte"
                accessibilityHint="Affiche ou masque la liste des paiements récurrents"
                accessibilityState={{ expanded: showRecurringPayments }}
                android_ripple={null}
                onPress={() => {
                  tapHaptic();
                  setShowRecurringPayments((visible) => !visible);
                }}
                style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
              >
                <OnyxContainer style={onyxContainerRowLayoutStyle()}>
                  <View style={styles.recurringTriggerCopy}>
                    <View style={styles.recurringTriggerTitleRow}>
                      <AppIcon
                        family="ionicons"
                        name="calendar-outline"
                        size={RECURRING_TRIGGER_ICON_SIZE}
                        color={colors.textSecondary}
                      />
                      <Text style={[typographyKit.eyebrow, { color: colors.textMuted }]}>
                        Paiements récurrents
                      </Text>
                    </View>
                    {!showRecurringPayments ? (
                      <Text style={[styles.recurringTriggerHint, { color: colors.textMuted }]} numberOfLines={1}>
                        {accountRecurringPayments.length > 0
                          ? `${accountRecurringPayments.length} lié${accountRecurringPayments.length > 1 ? 's' : ''} à ce compte`
                          : 'Aucun paiement lié'}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.recurringTriggerMeta}>
                    <Text style={[styles.recurringTriggerCount, { color: colors.textMuted }]}>
                      {accountRecurringPayments.length}
                    </Text>
                    <RecurringChevron expanded={showRecurringPayments} color={colors.textMuted} />
                  </View>
                </OnyxContainer>
              </Pressable>

              {showRecurringPayments ? (
                accountRecurringPayments.length > 0 ? (
                  accountRecurringPayments.map((payment) => (
                    <Pressable
                      key={payment.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Modifier ${payment.name}`}
                      android_ripple={null}
                      onPress={() => void openEditRecurringPayment(payment)}
                      style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
                    >
                      <OnyxContainer style={onyxContainerRowLayoutStyle()}>
                        <UserPickedIconWell
                          icon={resolveRecurringPaymentDisplayIconById(payment, loanByRecurringPaymentId)}
                          color={payment.color}
                          size={RECURRING_ICON_SIZE}
                          wellGlyphWhite
                          logoUrl={payment.logoUrl?.trim() || getMerchantLogoUrl(payment.name) || null}
                        />
                        <View style={styles.recurringPaymentCopy}>
                          <Text style={[typographyKit.listPrimary, { color: colors.text }]} numberOfLines={1}>
                            {payment.name}
                          </Text>
                          <Text style={[typographyKit.microMedium, { color: colors.textMuted }]} numberOfLines={1}>
                            {recurringPaymentDefinitionMeta(payment, today)}
                          </Text>
                        </View>
                        <TransactionAmountLabel
                          amount={formatRecurringPaymentAmount(payment.amount, payment.kind ?? 'payment')}
                          direction={recurringPaymentAmountDirection(payment.kind ?? 'payment')}
                          color={payment.kind === 'income' ? colors.success : colors.text}
                          textStyle={styles.recurringPaymentAmount}
                        />
                      </OnyxContainer>
                    </Pressable>
                  ))
                ) : (
                  <OnyxContainer style={styles.emptyCard}>
                    <Text style={[styles.recurringPanelEmpty, { color: colors.textMuted }]}>
                      Aucun paiement récurrent pour ce compte.
                    </Text>
                  </OnyxContainer>
                )
              ) : null}
            </View>

            {account.kind === 'savings' && linkedSavingsGoal ? (
              <OnyxContainer style={styles.savingsCard}>
                <DetailRow label="Objectif" value={linkedSavingsGoal.name} isLast />
                <View style={styles.savingsProgressBlock}>
                  <View style={[styles.savingsProgressTrack, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.savingsProgressFill,
                        {
                          backgroundColor: colors.primary,
                          width: `${Math.min(
                            100,
                            linkedSavingsGoal.targetAmount > 0
                              ? (linkedSavingsGoal.currentAmount / linkedSavingsGoal.targetAmount) * 100
                              : 0,
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </OnyxContainer>
            ) : null}

            <View style={styles.transactionList}>
              {searchExpanded ? (
                <View style={[styles.searchRow, containerSurfaceStyle(isLight)]}>
                  <AppIcon family="ionicons" name="search-outline" size={18} color={colors.textMuted} />
                  <TextInput
                    ref={searchInputRef}
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Rechercher"
                    placeholderTextColor={colors.textMuted}
                    value={search}
                    onChangeText={setSearch}
                    returnKeyType="search"
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={search.trim().length > 0 ? 'Effacer la recherche' : 'Fermer la recherche'}
                    hitSlop={8}
                    onPress={collapseSearch}
                    style={styles.clearSearchBtn}
                  >
                    <AppIcon family="ionicons" name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
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
                    <AppIcon family="ionicons"
                      name={historyFiltersExpanded ? 'filter' : 'filter-outline'}
                      size={20}
                      color={historyTypeFilter !== 'all' ? colors.primary : colors.textMuted}
                    />
                  </Pressable>
                </View>
              ) : (
                <ProtoSectionHeader
                  title="Historique"
                  trailing={
                    <View style={styles.searchToolbarRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Rechercher"
                        hitSlop={8}
                        onPress={expandSearch}
                        style={({ pressed }) => [
                          styles.searchIconBtn,
                          {
                            backgroundColor: colors.containerBackground,
                            borderColor: colors.containerBorder,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <AppIcon family="ionicons"
                          name="search-outline"
                          size={18}
                          color={search.trim().length > 0 ? colors.primary : colors.textMuted}
                        />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Filtres"
                        accessibilityState={{ expanded: historyFiltersExpanded }}
                        hitSlop={8}
                        onPress={() => {
                          tapHaptic();
                          setHistoryFiltersExpanded((expanded) => !expanded);
                        }}
                        style={({ pressed }) => [
                          styles.searchIconBtn,
                          {
                            backgroundColor: colors.containerBackground,
                            borderColor: colors.containerBorder,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <AppIcon family="ionicons"
                          name={historyFiltersExpanded ? 'filter' : 'filter-outline'}
                          size={18}
                          color={historyTypeFilter !== 'all' ? colors.primary : colors.textMuted}
                        />
                      </Pressable>
                    </View>
                  }
                />
              )}
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

              {groupedAccountTransactions.length > 0 ? (
                groupedAccountTransactions.map(([date, txs]) => (
                  <View key={date} style={styles.transactionGroup}>
                    <View style={styles.groupHeaderRow}>
                      <Text style={[styles.transactionGroupLabel, { color: colors.textMuted }]}>
                        {formatTransactionGroupDateLabel(date)}
                      </Text>
                    </View>
                    <View style={styles.groupTransactions}>
                      {txs.map((tx) => (
                        <TransactionRow
                          key={tx.id}
                          transaction={tx}
                          accounts={accounts}
                          onPress={() => { tapHaptic(); openTransactionDetail(tx.id); }}
                        />
                      ))}
                    </View>
                  </View>
                ))
              ) : (
                <OnyxContainer style={styles.emptyCard}>
                  <Text style={[styles.emptyInline, { color: colors.textMuted }]}>
                    {historyHasActiveFilters
                      ? 'Aucun résultat. Essaie un autre filtre ou une autre recherche.'
                      : 'Aucune transaction trouvée pour ce compte.'}
                  </Text>
                </OnyxContainer>
              )}
            </View>

          </>
        ) : (
          <Text style={[styles.empty, { color: colors.textMuted }]}>Compte introuvable.</Text>
        )}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={closeForm}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={[styles.modalBackdrop, formThemed.modalBackdrop]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeForm} />
            <FormSheetModalBody>
              <DraggableSheetSurface
                onClose={closeForm}
                sheetHeight={editAccountSheetHeight}
                style={[styles.modalSheet, ghostCardShadow, formThemed.sheet]}
              >
                <View style={[styles.modalHandle, formThemed.handle]} />
              <View style={styles.modalTitleRow}>
                <Text style={[styles.formTitle, formThemed.text]} numberOfLines={1}>
                  {accountEditFormTitle(kind)}
                </Text>
                <Pressable onPress={closeForm} hitSlop={12} style={[styles.closeBtn, formThemed.closeButton]}>
                  <AppIcon family="ionicons" name="close" size={19} color={colors.textMuted} />
                </Pressable>
              </View>

              <DraggableSheetScrollView
                style={formSheetScrollViewStyle()}
                contentContainerStyle={[
                  styles.modalContent,
                  formSheetScrollContentStyle,
                  { paddingBottom: formSheetScrollPaddingBottom(insets.bottom) },
                ]}
              >
              <View style={styles.section}>
                <DashboardSectionLabel style={sectionLabelStyle}>
                  Nom du compte
                </DashboardSectionLabel>
                <View style={styles.identityRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Changer l'icône du compte"
                    onPress={() => {
                      tapHaptic();
                      setShowIconPicker((open) => !open);
                    }}
                    style={({ pressed }) => [styles.iconAffordance, pressed && styles.pressed]}
                  >
                    {previewLogoAsset || previewLogo ? (
                      <LogoIconFrame
                        asset={previewLogoAsset}
                        uri={previewLogo}
                        size={28}
                      />
                    ) : hasIdentityContent ? (
                      <UserPickedIconWell icon={previewIcon} size={28} iconSize={16} />
                    ) : (
                      <View style={styles.iconGhostSlot} accessibilityElementsHidden>
                        <AppIcon
                          family="ionicons"
                          name={
                            kind === 'credit'
                              ? 'card-outline'
                              : kind === 'savings'
                                ? 'trending-up-outline'
                                : kind === 'cash'
                                  ? 'cash-outline'
                                  : 'wallet-outline'
                          }
                          size={20}
                          color={colors.textMuted}
                        />
                      </View>
                    )}
                  </Pressable>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder={
                      kind === 'credit'
                        ? 'Visa Desjardins'
                        : kind === 'cash'
                          ? 'Argent Cash'
                          : kind === 'savings'
                            ? 'CELI Tangerine'
                            : 'Tangerine chèque'
                    }
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.nameInput,
                      {
                        color: colors.text,
                        borderBottomColor: colors.border,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                      },
                    ]}
                    returnKeyType="next"
                    accessibilityLabel="Nom du compte"
                  />
                </View>
                <Text style={[styles.fieldHint, formThemed.textMuted]}>
                  {manualIcon
                    ? 'Icône manuelle · toucher pour changer'
                    : previewLogo
                      ? 'Logo auto · toucher pour choisir une icône'
                      : 'Icône auto · toucher pour choisir'}
                </Text>
              </View>

              {showIconPicker ? (
                <View style={styles.section}>
                  <DashboardSectionLabel style={sectionLabelStyle}>
                    Logo / icône
                  </DashboardSectionLabel>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.iconOptionRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Utiliser le logo automatique"
                      onPress={() => {
                        tapHaptic();
                        setIcon(null);
                        setShowIconPicker(false);
                      }}
                      style={[
                        styles.iconOption,
                        {
                          borderColor: manualIcon == null ? colors.primary : colors.border,
                          backgroundColor: colors.surfaceElevated,
                        },
                      ]}
                    >
                      <AppIcon
                        family="ionicons"
                        name="sparkles-outline"
                        size={18}
                        color={manualIcon == null ? colors.primary : colors.textMuted}
                      />
                    </Pressable>
                    {ACCOUNT_ICON_PICKER_OPTIONS.map((option) => {
                      const selected = manualIcon === option.icon;
                      return (
                        <Pressable
                          key={option.id}
                          accessibilityRole="button"
                          accessibilityLabel={option.label}
                          onPress={() => {
                            tapHaptic();
                            setIcon(option.icon);
                            setShowIconPicker(false);
                          }}
                          style={[
                            styles.iconOption,
                            {
                              borderColor: selected ? colors.primary : colors.border,
                              backgroundColor: colors.surfaceElevated,
                            },
                          ]}
                        >
                          <MdiIcon
                            name={option.icon}
                            size={18}
                            color={selected ? colors.primary : colors.textSecondary}
                          />
                        </Pressable>
                      );
                    })}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Voir toutes les icônes"
                      onPress={() => {
                        tapHaptic();
                        setFullIconPickerVisible(true);
                      }}
                      style={[
                        styles.iconOption,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surfaceElevated,
                        },
                      ]}
                    >
                      <AppIcon
                        family="ionicons"
                        name="grid-outline"
                        size={18}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  </ScrollView>
                </View>
              ) : null}

              {kind !== 'cash' ? (
                <AccountInput label="Institution" value={institution} onChangeText={setInstitution} placeholder="Desjardins, Tangerine, BMO…" />
              ) : null}
              {kind === 'cash' ? (
                <Text style={[styles.fieldHint, formThemed.textMuted]}>
                  Solde manuel — pas de synchronisation bancaire.
                </Text>
              ) : null}
              <AccountInput
                label={kind === 'credit' ? 'Solde dû actuel' : 'Solde actuel'}
                value={balance}
                onChangeText={setBalance}
                placeholder={kind === 'credit' ? '580.42' : kind === 'cash' ? '120.00' : '3240.50'}
                keyboardType="decimal-pad"
                suffix="$"
              />

              {kind === 'credit' ? (
                <>
                  <AccountInput
                    label="Limite de crédit"
                    value={creditLimit}
                    onChangeText={setCreditLimit}
                    placeholder="5000"
                    keyboardType="decimal-pad"
                  />
                  <AccountInput
                    label="Jour d’échéance"
                    value={dueDay}
                    onChangeText={setDueDay}
                    placeholder="15"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <AccountInput
                    label="Taux d’intérêt (%)"
                    value={interestRate}
                    onChangeText={setInterestRate}
                    placeholder="19.99"
                    keyboardType="decimal-pad"
                  />
                </>
              ) : null}

              {kind === 'savings' ? (
                <AccountInput
                  label="Taux d’intérêt (%)"
                  value={interestRate}
                  onChangeText={setInterestRate}
                  placeholder="3.25"
                  keyboardType="decimal-pad"
                />
              ) : null}

              {formFeedback ? (
                <ThemedFormMessage
                  variant={formFeedback.variant}
                  title={formFeedback.title}
                  message={formFeedback.message}
                />
              ) : null}

              <PrimarySaveButton label="Enregistrer" onPress={() => void saveAccount()} />

              {kind !== 'cash' && (
                <View style={styles.deleteSection}>
                  <View style={[styles.deleteDivider, { backgroundColor: colors.border }]} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Supprimer le compte"
                    style={({ pressed }) => [
                      subtleDeleteButtonStyle(isLight, { alignSelf: 'stretch' }),
                      pressed && { opacity: 0.72 },
                    ]}
                    onPress={() => editingAccount && confirmDeleteAccount(editingAccount)}
                  >
                    <AppIcon family="ionicons" name="trash-outline" size={16} color={destructiveIconColor(isLight)} />
                    <Text style={destructiveTextActionStyle(isLight)}>Supprimer le compte</Text>
                  </Pressable>
                </View>
              )}
              </DraggableSheetScrollView>
              </DraggableSheetSurface>
            </FormSheetModalBody>
          </View>

          <IconPickerSheet
            visible={fullIconPickerVisible}
            selectedIcon={manualIcon}
            title="Choisir une icône"
            onClose={() => setFullIconPickerVisible(false)}
            onSelect={(nextIcon: MdiIconName) => {
              setIcon(nextIcon);
              setShowIconPicker(false);
              setFullIconPickerVisible(false);
            }}
          />
        </GestureHandlerRootView>
      </Modal>

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
      <ConfirmDeleteModal
        visible={confirmDeleteVisible}
        title="Supprimer le compte ?"
        message={pendingDeleteAccount ? `Supprimer ${pendingDeleteAccount.name} ? Les transactions existantes restent dans l'historique général.` : undefined}
        onConfirm={async () => {
          if (!pendingDeleteAccount) return;
          setConfirmDeleteVisible(false);
          await deleteSimulatedAccount(pendingDeleteAccount.id);
          successHaptic();
          router.back();
        }}
        onCancel={() => {
          setConfirmDeleteVisible(false);
          setPendingDeleteAccount(null);
        }}
      />
    </View>
    </PageTransition>
  );
}

function usePortfolioFormTheme() {
  const { colors, ghost, isLight } = useAppTheme();
  return useMemo(
    () => ({
      modalBackdrop: { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' },
      sheet: {
        backgroundColor: colors.containerBackground,
        borderColor: colors.containerBorder,
        borderWidth: StyleSheet.hairlineWidth,
      },
      handle: { backgroundColor: colors.borderStrong },
      closeButton: {
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      control: {
        backgroundColor: ghost.obsidianSoft,
        borderColor: colors.borderStrong,
        borderWidth: StyleSheet.hairlineWidth,
      },
      selected: {
        backgroundColor: colors.successMuted,
        borderColor: colors.primary,
        borderWidth: 1.5,
      },
      selectedText: { color: colors.primary },
      text: { color: colors.text },
      textSecondary: { color: colors.textSecondary },
      textMuted: { color: colors.textMuted },
    }),
    [colors, ghost, isLight],
  );
}

function AccountInput(props: React.ComponentProps<typeof TextInput> & { label: string; suffix?: string }) {
  const { label, suffix, keyboardType, ...inputProps } = props;
  const { colors } = useAppTheme();
  const formThemed = usePortfolioFormTheme();
  const InputComponent = keyboardType === 'decimal-pad' ? NumericAmountInput : TextInput;

  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, formThemed.textSecondary]}>{label}</Text>
      {suffix ? (
        <View style={[styles.inputShell, formThemed.control]}>
          <InputComponent
            {...inputProps}
            keyboardType={keyboardType}
            style={[styles.inputWithSuffix, formThemed.text]}
            placeholderTextColor={colors.textMuted}
          />
          <Text style={[styles.inputSuffix, formThemed.textSecondary]}>{suffix}</Text>
        </View>
      ) : (
        <InputComponent
          {...inputProps}
          keyboardType={keyboardType}
          style={[styles.input, formThemed.control, formThemed.text]}
          placeholderTextColor={colors.textMuted}
        />
      )}
    </View>
  );
}

function parseMoney(value: string) {
  return parseFormattedNumber(value);
}

function parseOptionalMoney(value: string) {
  const parsed = parseMoney(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseOptionalInt(value: string) {
  const parsed = Number.parseInt(sanitizeNumericInput(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function transactionBelongsToAccount(tx: Transaction, account: SimulatedAccount) {
  const note = tx.note ?? '';
  const accountId = escapeRegExp(account.id);
  if (new RegExp(`(?:^|\\n)compte:${accountId}(?:\\n|$)`).test(note)) return true;
  if (new RegExp(`(?:^|\\n)transfert:${accountId}->`).test(note)) return true;
  if (new RegExp(`(?:^|\\n)transfert:[^\\n]*->${accountId}(?:\\n|$)`).test(note)) return true;

  const normalizedNote = note.toLowerCase();
  const normalizedName = account.name.trim().toLowerCase();
  return Boolean(normalizedName && normalizedNote.includes(`compte:${normalizedName}`));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  flowCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: ONYX_CONTAINER.padding.row,
    gap: spacing.md,
  },
  flowCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  flowColEnd: {
    alignItems: 'flex-end',
  },
  flowRule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  recurringSection: {
    gap: ONYX_CONTAINER.listGap,
  },
  emptyCard: {
    padding: ONYX_CONTAINER.padding.row,
  },
  savingsCard: {
    paddingHorizontal: ONYX_CONTAINER.padding.card,
    paddingTop: spacing.sm,
    paddingBottom: ONYX_CONTAINER.padding.row,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
  },
  detailLabel: {
    ...typographyKit.microUpper,
    flexShrink: 0,
  },
  detailValue: {
    ...moneyAmountTypography({ tier: 'row', fontSize: typography.meta }),
    ...(Platform.OS === 'web' ? { flex: 1 } : nativeTextColumnFlex),
    textAlign: 'right',
  },
  savingsProgressBlock: {
    paddingBottom: spacing.xs,
  },
  savingsProgressTrack: {
    height: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  savingsProgressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  deleteSection: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  deleteDivider: {
    height: StyleSheet.hairlineWidth,
  },
  recurringTriggerCopy: {
    ...(Platform.OS === 'web' ? { flex: 1, minWidth: 0 } : nativeTextColumnFlex),
    gap: 2,
  },
  recurringTriggerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  recurringTriggerHint: {
    ...typographyKit.microMedium,
  },
  recurringTriggerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  recurringTriggerCount: {
    ...typographyKit.metaMedium,
    fontVariant: ['tabular-nums'],
    minWidth: 14,
    textAlign: 'right',
  },
  recurringPanelEmpty: {
    ...typographyKit.metaMedium,
    lineHeight: 20,
    textAlign: 'center',
  },
  recurringPaymentCopy: {
    ...(Platform.OS === 'web' ? { flex: 1, minWidth: 0 } : nativeTextColumnFlex),
    gap: 2,
  },
  recurringPaymentAmount: {
    ...moneyAmountTypography({ tier: 'row' }),
    flexShrink: 0,
  },
  transactionList: {
    gap: spacing.md,
  },
  searchToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  searchIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    borderRadius: ONYX_CONTAINER.borderRadius,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body,
    padding: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterIconBtn: {
    padding: 4,
    marginLeft: spacing.xs,
  },
  historyFilterWrap: {
    marginBottom: spacing.sm,
  },
  transactionGroup: {
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
  transactionGroupLabel: {
    ...typographyKit.metaMedium,
    textTransform: 'capitalize',
    flex: 1,
    minWidth: 0,
  },
  groupTransactions: {
    gap: spacing.lg,
  },
  empty: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  emptyInline: {
    ...typographyKit.metaMedium,
    lineHeight: 20,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  formTitle: {
    flex: 1,
    ...jakartaExtraBoldText,
    fontSize: typography.title,
    letterSpacing: -0.4,
  },
  section: {
    gap: spacing.sm,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  iconAffordance: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconGhostSlot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.42,
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
    fontSize: typography.body,
    borderBottomWidth: StyleSheet.hairlineWidth,
    ...jakartaSemiboldText,
  },
  fieldHint: {
    ...typographyKit.metaMedium,
    lineHeight: 16,
    opacity: 0.85,
  },
  iconOptionRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
  formHint: {
    flex: 1,
    ...jakartaMediumText,
    fontSize: typography.meta,
    lineHeight: 17,
  },
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
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 5,
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
    padding: spacing.sm,
  },
  logoOptionActive: {
    backgroundColor: colors.cyanMuted,
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
  inputGroup: { gap: spacing.sm },
  label: {
    ...jakartaBoldText,
    fontSize: typography.caption,
    lineHeight: 21,
  },
  input: {
    minHeight: 50,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...jakartaBoldText,
    fontSize: typography.body,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderRadius: radius.lg,
    paddingRight: spacing.md,
  },
  inputWithSuffix: {
    flex: 1,
    minWidth: 0,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.md,
    ...jakartaBoldText,
    fontSize: typography.body,
  },
  inputSuffix: {
    ...jakartaBoldText,
    fontSize: typography.body,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  saveText: {
    color: colors.background,
    fontSize: typography.body,
    fontWeight: '800',
  },
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BankAccountCard } from '@/components/BankAccountCard';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { formValidationError, type FormFeedback } from '@/lib/formFeedback';
import { PageTransition } from '@/components/PageTransition';
import { IconFrame, LogoIconFrame } from '@/components/IconFrame';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { EXPENSE_DEFAULT_ICON } from '@/lib/expenseIcon';
import { getMerchantLogoUrl } from '@/lib/merchantLogo';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TransactionRow } from '@/components/TransactionRow';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import {
  frequencyLabel,
  manualAccountOptions,
  RecurringPaymentFormModal,
  recurringPaymentToForm,
  saveRecurringPaymentForm,
  toAccountOptions,
  type PaymentForm,
} from '@/lib/recurringPaymentsForm';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  colors,
  ICON_WELL_SIZE,
  accountDetailHeroActionLinkStyle,
  accountDetailHeroActionMutedTextStyle,
  accountDetailHeroActionSeparatorStyle,
  accountDetailHeroActionsStyle,
  accountDetailHeroBlockStyle,
  accountDetailRecurringHeaderStyle,
  accountDetailSectionDividerStyle,
  accountDetailStatementStatColStyle,
  accountDetailStatementStatLabelStyle,
  accountDetailStatementStatsRowStyle,
  accountDetailStatementStatValueStyle,
  destructiveIconColor,
  destructiveTextActionStyle,
  interBoldText,
  interExtraBoldText,
  interMediumText,
  radius,
  spacing,
  subtleDeleteButtonStyle,
  typography,
} from '@/constants/theme';
import {
  deleteSimulatedAccount,
  getCategories,
  getCategoryBudgets,
  getRecurringPayments,
  getSavingsGoals,
  getSimulatedAccounts,
  getTransactions,
  insertSimulatedAccount,
  sortTransactionsNewestFirst,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import { getAccountLogoUrl } from '@/lib/merchantLogo';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import {
  creditLimitUtilizationPercent,
  creditUsedFromBalance,
  utilizationPercentColor,
} from '@/lib/creditLimitUtilization';
import { parseIsoDay } from '@/lib/estimatedPaycheck';
import { formatDisplayMoneyAbsolute, formatRecurringPaymentAmount, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import { UNIFORM_SECTION_HEADER_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import {
  filterTransactionsByType,
  formatTransactionGroupDateLabel,
  groupTransactionsByDay,
  HISTORY_FILTER_OPTIONS,
  type HistoryTypeFilter,
  transactionMatchesSearch,
} from '@/lib/transactionListUtils';
import type { AccountKind, Category, CategoryBudget, RecurringPayment, SavingsGoal, SimulatedAccount, Transaction } from '@/types';

const ACCOUNT_TYPES: Array<{
  id: AccountKind;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'credit', label: 'Crédit', icon: 'card-outline' },
  { id: 'checking', label: 'Compte chèque', icon: 'wallet-outline' },
  { id: 'savings', label: 'Épargne', icon: 'cash-outline' },
];

const INSTITUTION_LOGO_OPTIONS = [
  { id: 'desjardins', label: 'Desjardins', institution: 'Desjardins' },
  { id: 'rbc', label: 'RBC', institution: 'RBC' },
  { id: 'td', label: 'TD', institution: 'TD' },
  { id: 'bmo', label: 'BMO', institution: 'BMO' },
  { id: 'scotiabank', label: 'Scotiabank', institution: 'Scotiabank' },
  { id: 'cibc', label: 'CIBC', institution: 'CIBC' },
  { id: 'banque-nationale', label: 'Banque Nationale', institution: 'Banque Nationale' },
  { id: 'tangerine', label: 'Tangerine', institution: 'Tangerine' },
  { id: 'wealthsimple', label: 'Wealthsimple', institution: 'Wealthsimple' },
  { id: 'koho', label: 'KOHO', institution: 'KOHO' },
  { id: 'neo-financial', label: 'Neo', institution: 'Neo Financial' },
  { id: 'eq-bank', label: 'EQ Bank', institution: 'EQ Bank' },
  { id: 'simplii', label: 'Simplii', institution: 'Simplii' },
  { id: 'pc-financial', label: 'PC Financial', institution: 'PC Financial' },
  { id: 'visa', label: 'Visa', institution: 'Visa' },
  { id: 'mastercard', label: 'Mastercard', institution: 'Mastercard' },
  { id: 'amex', label: 'Amex', institution: 'American Express' },
].map((option) => ({
  ...option,
  logoUrl: getAccountLogoUrl(option.institution),
}));

function formatMoney(value: number) {
  return formatDisplayMoneyAbsolute(value);
}

function formatSignedMoney(value: number) {
  return formatSignedDisplayMoney(value);
}

const SUBSCRIPTION_CATEGORY_PATTERN = /abonnement|subscription|loisir|divertissement|streaming/;

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

function StatementStatColumn({
  label,
  value,
  valueColor,
  align = 'center',
  prominent,
}: {
  label: string;
  value: string;
  valueColor?: string;
  align?: 'left' | 'center' | 'right';
  prominent?: boolean;
}) {
  const { colors } = useAppTheme();
  const textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';

  return (
    <View style={accountDetailStatementStatColStyle({ align, prominent })}>
      <Text
        style={[
          accountDetailStatementStatValueStyle(prominent),
          { color: valueColor ?? colors.text, textAlign },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text
        style={[
          accountDetailStatementStatLabelStyle(),
          { color: colors.textMuted, textAlign },
        ]}
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
  net,
}: {
  revenues: number;
  expenses: number;
  net: number;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={accountDetailStatementStatsRowStyle()}>
      <StatementStatColumn
        label="Revenus"
        value={`+${formatMoney(revenues)}`}
        align="left"
      />
      <StatementStatColumn
        label="Net ce mois"
        value={formatSignedMoney(net)}
        valueColor={net >= 0 ? colors.success : colors.danger}
        align="center"
        prominent
      />
      <StatementStatColumn
        label="Dépenses"
        value={`−${formatMoney(expenses)}`}
        align="right"
      />
    </View>
  );
}

function StatementStatsRow({
  stats,
}: {
  stats: Array<{ label: string; value: string; valueColor?: string }>;
}) {
  return (
    <View style={accountDetailStatementStatsRowStyle()}>
      {stats.map((stat) => (
        <StatementStatColumn key={stat.label} label={stat.label} value={stat.value} valueColor={stat.valueColor} />
      ))}
    </View>
  );
}

function FlowDivider() {
  const { isLight } = useAppTheme();
  return <View style={accountDetailSectionDividerStyle(isLight)} />;
}

export default function AccountDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const accountId = typeof params.accountId === 'string' ? params.accountId : '';
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { colors, ghost, ghostCardShadow, isLight } = useAppTheme();
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [search, setSearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<HistoryTypeFilter>('all');
  const [historyFiltersExpanded, setHistoryFiltersExpanded] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
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
  const [selectedInstitutionLogoId, setSelectedInstitutionLogoId] = useState<string | null>(null);
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState<SimulatedAccount | null>(null);
  const [recurringForm, setRecurringForm] = useState<PaymentForm | null>(null);
  const [recurringAccounts, setRecurringAccounts] = useState<ReturnType<typeof manualAccountOptions>>([]);
  const [recurringCategories, setRecurringCategories] = useState<Category[]>([]);
  const [recurringCategoryBudgets, setRecurringCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [recurringFeedback, setRecurringFeedback] = useState<FormFeedback | null>(null);

  const load = useCallback(async () => {
    const [nextAccounts, nextSavingsGoals, nextTransactions, nextRecurringPayments] = await Promise.all([
      getSimulatedAccounts(),
      getSavingsGoals(),
      getTransactions(),
      getRecurringPayments(),
    ]);
    setAccounts(nextAccounts);
    setSavingsGoals(nextSavingsGoals);
    setTransactions(nextTransactions);
    setRecurringPayments(nextRecurringPayments);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    void load();
  }, [accountId, load]);

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
  const accountRecurringPayments = useMemo(() => {
    if (!account) return [];
    return recurringPayments
      .filter((payment) => payment.accountId === account.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [account, recurringPayments]);
  const checkingMonthlyStats = useMemo(() => {
    if (!account || account.kind !== 'checking') return null;
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
    return { revenues, expenses, net: revenues - expenses };
  }, [account, accountTransactions]);
  const creditInfo = useMemo(() => {
    if (!account || account.kind !== 'credit') return null;
    const creditLimit =
      typeof account.creditLimit === 'number' && account.creditLimit > 0 ? account.creditLimit : undefined;
    const creditUsed = creditUsedFromBalance(account.balance);
    const utilPct = creditLimitUtilizationPercent(account.balance, creditLimit);
    const available = typeof creditLimit === 'number' ? Math.max(0, creditLimit - creditUsed) : undefined;
    return { creditLimit, creditUsed, utilPct, available };
  }, [account]);
  const logoSourceName = institution.trim() || name.trim();
  const selectedInstitutionLogo = useMemo(
    () => INSTITUTION_LOGO_OPTIONS.find((option) => option.id === selectedInstitutionLogoId) ?? null,
    [selectedInstitutionLogoId],
  );
  const autoPreviewLogo = useMemo(() => getAccountLogoUrl(logoSourceName), [logoSourceName]);
  const previewLogo = selectedInstitutionLogo?.logoUrl ?? autoPreviewLogo;
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
    setSelectedInstitutionLogoId(null);
    setShowLogoPicker(false);
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
    setSelectedInstitutionLogoId(findInstitutionLogoId(nextAccount));
    setShowLogoPicker(false);
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
      institution: selectedInstitutionLogo?.institution ?? (institution.trim() || undefined),
      last4: editingAccount.last4,
      creditLimit: kind === 'credit' ? parseOptionalMoney(creditLimit) : undefined,
      dueDay: kind === 'credit' ? parseOptionalInt(dueDay) : undefined,
      interestRate: kind !== 'checking' ? parseOptionalMoney(interestRate) : undefined,
      logoUrl: selectedInstitutionLogo?.logoUrl ?? getAccountLogoUrl(logoSourceName) ?? undefined,
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
      getCategories(),
      getCategoryBudgets(),
      getSimulatedAccounts(),
    ]);
    const accounts = toAccountOptions(simulatedAccounts);
    setRecurringAccounts(accounts.length ? accounts : manualAccountOptions());
    setRecurringCategories(categories);
    setRecurringCategoryBudgets(categoryBudgets);
    setRecurringForm(recurringPaymentToForm(payment));
    setRecurringFeedback(null);
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
    <PageTransition>
    <View style={[styles.screen, { backgroundColor: 'transparent' }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={12}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
            pressed && styles.pressed,
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {account?.name ?? 'Compte'}
        </Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + spacing.xl, 56) }]}
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
            <View style={accountDetailHeroBlockStyle()}>
              <View style={accountDetailHeroActionsStyle()}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Modifier le compte"
                  style={({ pressed }) => [accountDetailHeroActionLinkStyle(), pressed && styles.pressed]}
                  onPress={() => openEditAccountForm(account)}
                >
                  <Text style={accountDetailHeroActionMutedTextStyle(isLight)}>Modifier</Text>
                </Pressable>
                <Text style={accountDetailHeroActionSeparatorStyle(isLight)}>·</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Supprimer le compte"
                  style={({ pressed }) => [accountDetailHeroActionLinkStyle(), pressed && styles.pressed]}
                  onPress={() => confirmDeleteAccount(account)}
                >
                  <Text style={destructiveTextActionStyle(isLight)}>Supprimer</Text>
                </Pressable>
              </View>
              <View style={ghostCardShadow}>
                <BankAccountCard
                  account={account}
                  logoUrl={getSimulatedAccountLogoUrl(account)}
                />
              </View>
            </View>

            {creditInfo ? (
              <StatementStatsRow
                stats={[
                  {
                    label: 'Solde dû',
                    value: formatSignedDisplayMoney(-creditInfo.creditUsed),
                    valueColor: colors.danger,
                  },
                  ...(typeof creditInfo.available === 'number'
                    ? [{ label: 'Disponible', value: formatMoney(creditInfo.available) }]
                    : []),
                  ...(typeof creditInfo.utilPct === 'number'
                    ? [{
                        label: '% utilisé',
                        value: `${Math.round(creditInfo.utilPct)} %`,
                        valueColor: utilizationPercentColor(creditInfo.utilPct, colors),
                      }]
                    : []),
                ]}
              />
            ) : null}

            {checkingMonthlyStats ? (
              <CheckingMonthlyStatsRow
                revenues={checkingMonthlyStats.revenues}
                expenses={checkingMonthlyStats.expenses}
                net={checkingMonthlyStats.net}
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

            {creditInfo &&
            (typeof creditInfo.creditLimit === 'number' ||
              typeof account.dueDay === 'number' ||
              typeof account.interestRate === 'number') ? (
              <>
                <FlowDivider />
                {typeof creditInfo.creditLimit === 'number' ? (
                  <DetailRow
                    label="Limite"
                    value={formatMoney(creditInfo.creditLimit)}
                    isLast={
                      typeof account.dueDay !== 'number' && typeof account.interestRate !== 'number'
                    }
                  />
                ) : null}
                {typeof account.dueDay === 'number' ? (
                  <DetailRow
                    label="Échéance"
                    value={`Jour ${account.dueDay}`}
                    isLast={typeof account.interestRate !== 'number'}
                  />
                ) : null}
                {typeof account.interestRate === 'number' ? (
                  <DetailRow label="Taux d'intérêt" value={`${account.interestRate} %`} isLast />
                ) : null}
              </>
            ) : null}

            {account.kind === 'savings' && linkedSavingsGoal ? (
              <>
                <FlowDivider />
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
              </>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Paiements récurrents de ce compte"
              accessibilityState={{ expanded: showRecurringPayments }}
              android_ripple={null}
              style={({ pressed }) => [
                accountDetailRecurringHeaderStyle(isLight),
                pressed && styles.pressed,
              ]}
              onPress={() => {
                tapHaptic();
                setShowRecurringPayments((visible) => !visible);
              }}
            >
              <View style={styles.recurringSectionTitleRow}>
                <Ionicons name="repeat" size={18} color={colors.primary} />
                <Text style={[styles.recurringSectionTitle, { color: colors.text }]}>
                  Paiements récurrents de ce compte
                </Text>
              </View>
              <View style={styles.recurringSectionMeta}>
                <View style={[styles.recurringCountBadge, { backgroundColor: colors.blueMuted }]}>
                  <Text style={[styles.recurringCountBadgeText, { color: colors.primary }]}>
                    {accountRecurringPayments.length}
                  </Text>
                </View>
                <Ionicons
                  name={showRecurringPayments ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </View>
            </Pressable>

            {showRecurringPayments ? (
              <View style={styles.recurringList}>
                {accountRecurringPayments.length > 0 ? (
                  accountRecurringPayments.map((payment, paymentIndex) => (
                    <Pressable
                      key={payment.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Modifier ${payment.name}`}
                      android_ripple={null}
                      style={[
                        styles.recurringPaymentRow,
                        paymentIndex < accountRecurringPayments.length - 1 && {
                          borderBottomColor: colors.border,
                          borderBottomWidth: StyleSheet.hairlineWidth,
                        },
                      ]}
                      onPress={() => void openEditRecurringPayment(payment)}
                    >
                      <UserPickedIconWell
                        icon={
                          payment.icon && payment.icon !== 'repeat-outline'
                            ? payment.icon
                            : payment.kind === 'income'
                              ? 'AttachMoney'
                              : EXPENSE_DEFAULT_ICON
                        }
                        color={payment.color}
                        size={48}
                        wellGlyphWhite
                        logoUrl={payment.logoUrl?.trim() || getMerchantLogoUrl(payment.name) || null}
                      />
                      <View style={styles.recurringPaymentCopy}>
                        <Text style={[styles.recurringPaymentName, { color: colors.text }]} numberOfLines={1}>
                          {payment.name}
                        </Text>
                        <Text style={[styles.recurringPaymentMeta, { color: colors.textMuted }]} numberOfLines={1}>
                          {recurringPaymentDefinitionMeta(payment, today)}
                        </Text>
                      </View>
                      <Text style={[styles.recurringPaymentAmount, { color: payment.kind === 'income' ? colors.success : colors.text }]}>
                        {formatRecurringPaymentAmount(payment.amount, payment.kind ?? 'payment')}
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={[styles.emptyInline, { color: colors.textMuted }]}>Aucun paiement récurrent pour ce compte.</Text>
                )}
              </View>
            ) : null}

            <FlowDivider />

            <View style={styles.transactionList}>
              <View style={[styles.searchRow, { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder }]}>
                <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Rechercher"
                  placeholderTextColor={colors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                />
                {search.trim().length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Effacer la recherche"
                    hitSlop={8}
                    onPress={() => setSearch('')}
                    style={styles.clearSearchBtn}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                ) : null}
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
                  <Ionicons
                    name={historyFiltersExpanded ? 'filter' : 'filter-outline'}
                    size={20}
                    color={historyTypeFilter !== 'all' ? colors.primary : colors.textMuted}
                  />
                </Pressable>
              </View>
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
                          onPress={() => {
                            tapHaptic();
                            setSelectedTransaction(tx);
                          }}
                        />
                      ))}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyInline, { color: colors.textMuted }]}>
                  {historyHasActiveFilters
                    ? 'Aucun résultat. Essaie un autre filtre ou une autre recherche.'
                    : 'Aucune transaction trouvée pour ce compte.'}
                </Text>
              )}
            </View>

          </>
        ) : (
          <Text style={[styles.empty, { color: colors.textMuted }]}>Compte introuvable.</Text>
        )}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={closeForm}>
        <View style={[styles.modalBackdrop, formThemed.modalBackdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeForm} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <View
              style={[
                styles.modalSheet,
                ghostCardShadow,
                formThemed.sheet,
                { paddingBottom: Math.max(insets.bottom, spacing.md) },
              ]}
            >
              <View style={[styles.modalHandle, formThemed.handle]} />
              <View style={styles.modalTitleRow}>
                <Text style={[styles.formTitle, formThemed.text]} numberOfLines={1}>
                  Modifier le compte
                </Text>
                <Pressable onPress={closeForm} hitSlop={12} style={[styles.closeBtn, formThemed.closeButton]}>
                  <Ionicons name="close" size={19} color={colors.textMuted} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>
              <View style={styles.formHead}>
                <View style={styles.logoPreviewWrap}>
                  {previewLogo ? (
                    <LogoIconFrame uri={previewLogo} size={52} />
                  ) : (
                    <IconFrame size={52}>
                      <Ionicons name="business-outline" size={22} color={colors.textMuted} />
                    </IconFrame>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Modifier le logo"
                    style={({ pressed }) => [
                      styles.logoEditButton,
                      { backgroundColor: colors.primary, borderColor: colors.surfaceSolid, shadowColor: colors.primary },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      tapHaptic();
                      setShowLogoPicker((visible) => !visible);
                    }}
                  >
                    <Ionicons name="pencil-outline" size={15} color={isLight ? colors.text : ghost.void} />
                  </Pressable>
                </View>
                <Text style={[styles.formHint, formThemed.textMuted]}>
                  {selectedInstitutionLogo
                    ? 'Logo manuel sélectionné.'
                    : 'Le logo se déduit du nom. Exemple : Visa Desjardins -> Desjardins.'}
                </Text>
              </View>

              {showLogoPicker ? (
                <View style={styles.logoPickerGroup}>
                  <View style={styles.logoPickerTitleRow}>
                    <Text style={[styles.label, { color: colors.textMuted }]}>Logo</Text>
                    <Text style={[styles.logoPickerHint, { color: colors.textMuted }]}>Auto par défaut</Text>
                  </View>
                  <View style={styles.logoOptionRow}>
                    <LogoOption
                      label="Auto"
                      logoUrl={autoPreviewLogo}
                      selected={!selectedInstitutionLogoId}
                      onPress={() => {
                        tapHaptic();
                        setSelectedInstitutionLogoId(null);
                        setShowLogoPicker(false);
                      }}
                    />
                    {INSTITUTION_LOGO_OPTIONS.map((option) => (
                      <LogoOption
                        key={option.id}
                        label={option.label}
                        logoUrl={option.logoUrl}
                        selected={selectedInstitutionLogoId === option.id}
                        onPress={() => {
                          tapHaptic();
                          setSelectedInstitutionLogoId(option.id);
                          setShowLogoPicker(false);
                        }}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <Text style={[styles.label, formThemed.textSecondary]}>Type de compte</Text>
              <View style={styles.typeRow}>
                {ACCOUNT_TYPES.map((type) => {
                  const selected = kind === type.id;
                  return (
                    <Pressable
                      key={type.id}
                      onPress={() => {
                        tapHaptic();
                        setKind(type.id);
                      }}
                      style={[
                        styles.typeChip,
                        selected ? formThemed.selected : formThemed.control,
                      ]}
                    >
                      <Ionicons name={type.icon} size={16} color={selected ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.typeChipText, selected ? formThemed.selectedText : formThemed.textSecondary]}>
                        {type.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <AccountInput
                label="Nom du compte"
                value={name}
                onChangeText={setName}
                placeholder={kind === 'credit' ? 'Visa Desjardins' : 'Tangerine chèque'}
              />
              <AccountInput label="Institution" value={institution} onChangeText={setInstitution} placeholder="Desjardins, Tangerine, BMO…" />
              <AccountInput
                label={kind === 'credit' ? 'Solde dû actuel' : 'Solde actuel'}
                value={balance}
                onChangeText={setBalance}
                placeholder={kind === 'credit' ? '580.42' : '3240.50'}
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
                  <Ionicons name="trash-outline" size={16} color={destructiveIconColor(isLight)} />
                  <Text style={destructiveTextActionStyle(isLight)}>Supprimer le compte</Text>
                </Pressable>
              </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <TransactionDetailSheet transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} onDeleted={() => { void load(); }} />
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
  const { label, suffix, ...inputProps } = props;
  const { colors } = useAppTheme();
  const formThemed = usePortfolioFormTheme();

  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, formThemed.textSecondary]}>{label}</Text>
      {suffix ? (
        <View style={[styles.inputShell, formThemed.control]}>
          <TextInput
            {...inputProps}
            style={[styles.inputWithSuffix, formThemed.text]}
            placeholderTextColor={colors.textMuted}
          />
          <Text style={[styles.inputSuffix, formThemed.textSecondary]}>{suffix}</Text>
        </View>
      ) : (
        <TextInput
          {...inputProps}
          style={[styles.input, formThemed.control, formThemed.text]}
          placeholderTextColor={colors.textMuted}
        />
      )}
    </View>
  );
}

function LogoOption({
  label,
  logoUrl,
  selected,
  onPress,
}: {
  label: string;
  logoUrl?: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, ghost } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === 'Auto' ? 'Utiliser le logo automatique' : 'Choisir ce logo'}
      onPress={onPress}
      style={[
        styles.logoOption,
        selected && styles.logoOptionActive,
        { borderColor: selected ? colors.primary : colors.border },
      ]}
    >
      {logoUrl ? (
        <LogoIconFrame uri={logoUrl} size={ICON_WELL_SIZE} />
      ) : (
        <IconFrame size={ICON_WELL_SIZE}>
          <Ionicons name="business-outline" size={17} color={colors.textMuted} />
        </IconFrame>
      )}
    </Pressable>
  );
}

function parseMoney(value: string) {
  return Number.parseFloat(value.replace(',', '.'));
}

function parseOptionalMoney(value: string) {
  const parsed = parseMoney(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseOptionalInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function getSimulatedAccountLogoUrl(account: SimulatedAccount) {
  return account.logoUrl ?? getAccountLogoUrl(account.institution?.trim() || account.name) ?? getAccountLogoUrl(account.name);
}

function findInstitutionLogoId(account: SimulatedAccount) {
  const byLogo = account.logoUrl
    ? INSTITUTION_LOGO_OPTIONS.find((option) => option.logoUrl === account.logoUrl)
    : undefined;
  if (byLogo) return byLogo.id;

  const institution = account.institution?.trim().toLowerCase();
  if (!institution) return null;
  return INSTITUTION_LOGO_OPTIONS.find((option) => option.institution.toLowerCase() === institution)?.id ?? null;
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
    ...interExtraBoldText,
    fontSize: typography.caption,
    letterSpacing: -0.2,
  },
  topBarSpacer: { width: 38 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
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
    ...interMediumText,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  detailValue: {
    ...interExtraBoldText,
    fontSize: typography.meta,
    fontVariant: ['tabular-nums'],
    flex: 1,
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
  recurringSectionTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  recurringSectionTitle: {
    ...interExtraBoldText,
    fontSize: typography.body,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  recurringSectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  recurringCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recurringCountBadgeText: {
    ...interExtraBoldText,
    fontSize: typography.meta,
    fontVariant: ['tabular-nums'],
  },
  recurringList: {
    gap: 0,
    paddingTop: spacing.xs,
  },
  recurringPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    minHeight: 56,
  },
  recurringPaymentIcon: {
    width: ICON_WELL_SIZE,
    height: ICON_WELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recurringPaymentIconFallback: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  recurringPaymentLogo: { width: 23, height: 23 },
  recurringPaymentCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  recurringPaymentName: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  recurringPaymentMeta: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
  },
  recurringPaymentAmount: {
    color: colors.text,
    fontSize: typography.meta,
    fontWeight: '800',
    flexShrink: 0,
  },
  transactionList: {
    gap: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    borderRadius: radius.card,
    borderWidth: 1,
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
  transactionGroupLabel: {
    fontSize: typography.caption,
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
    fontSize: typography.caption,
    lineHeight: 20,
    paddingVertical: spacing.sm,
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
    marginTop: 88,
    maxHeight: '92%',
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
  formHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  formTitle: {
    flex: 1,
    ...interExtraBoldText,
    fontSize: typography.title,
    letterSpacing: -0.4,
  },
  formHint: {
    flex: 1,
    ...interMediumText,
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
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typeChipText: {
    ...interMediumText,
    fontSize: typography.meta,
  },
  inputGroup: { gap: spacing.sm },
  label: {
    ...interBoldText,
    fontSize: typography.caption,
    lineHeight: 21,
  },
  input: {
    minHeight: 50,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...interBoldText,
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
    ...interBoldText,
    fontSize: typography.body,
  },
  inputSuffix: {
    ...interBoldText,
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
  pressed: { opacity: 0.78 },
});

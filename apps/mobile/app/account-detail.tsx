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
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { GlassContainer } from '@/components/GlassContainer';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { formValidationError, type FormFeedback } from '@/lib/formFeedback';
import { PageTransition } from '@/components/PageTransition';
import { IconFrame, LogoIconFrame } from '@/components/IconFrame';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { EXPENSE_DEFAULT_ICON } from '@/lib/expenseIcon';
import { getMerchantLogoUrl } from '@/lib/merchantLogo';
import { MerchantLogo } from '@/components/MerchantLogo';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import { PaymentDetailSheet, type PaymentDetailPayload } from '@/components/PaymentDetailSheet';
import { frequencyLabel } from '@/lib/recurringPaymentsForm';
import { SCREEN_TOP_GUTTER, ghostCardShadow } from '@/constants/ghostUi';
import {
  colors,
  ICON_WELL_SIZE,
  interBoldText,
  interExtraBoldText,
  interMediumText,
  radius,
  SECTION_TITLE_STYLE,
  spacing,
  typography,
} from '@/constants/theme';
import {
  deleteSimulatedAccount,
  getMerchantOverrides,
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
import { userPickedIconWellStyle } from '@/lib/userPickedIcon';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import {
  creditLimitUtilizationBarColor,
  creditLimitUtilizationPercent,
  creditUsedFromBalance,
} from '@/lib/creditLimitUtilization';
import { formatDisplayMoneyAbsolute, formatRecurringPaymentAmount, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import { listRowTitle, rowTitleTextProps, rowValue, rowValueContainer, singleLineAmountProps } from '@/lib/textLayout';
import type { AccountKind, Category, CategoryBudget, MerchantOverride, RecurringPayment, SavingsGoal, SimulatedAccount, Transaction } from '@/types';

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

function formatAgendaUpcomingDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}

function getLocalDayKey(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type ItemizedNote = {
  name: string;
};

function parseItemizedNote(note?: string): ItemizedNote[] {
  const line = note?.split('\n').find((part) => part.startsWith('articles:'));
  if (!line) return [];

  try {
    const parsed = JSON.parse(line.slice('articles:'.length));
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): ItemizedNote[] => {
      if (!item || typeof item !== 'object') return [];
      const name =
        typeof (item as Record<string, unknown>).name === 'string'
          ? (item as Record<string, unknown>).name.trim()
          : '';
      return name ? [{ name }] : [];
    });
  } catch {
    return [];
  }
}

function firstItemName(tx: Transaction) {
  return parseItemizedNote(tx.note)[0]?.name ?? null;
}

function AccountTransactionRow({
  transaction: tx,
  merchantName,
  logoUrl,
  onPress,
}: {
  transaction: Transaction;
  merchantName: string;
  logoUrl?: string | null;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const isIncome = tx.type === 'income';
  const isTransfer = tx.type === 'transfer';
  const amountColor = isIncome ? colors.success : isTransfer ? colors.textMuted : colors.text;
  const hasReceipt = Boolean(tx.receiptUri || tx.receiptStatus);
  const itemName = firstItemName(tx);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir la transaction ${merchantName}`}
      android_ripple={null}
      onPress={onPress}
    >
      <GlassContainer
        borderRadius={radius.lg}
        padding={spacing.sm + 3}
        innerStyle={styles.transactionRowInner}
      >
          <MerchantLogo name={merchantName} logoUrl={logoUrl} size={ICON_WELL_SIZE} />
          <View style={styles.transactionBody}>
            <View style={styles.transactionTitleRow}>
              <Text style={[styles.transactionTitle, { color: colors.text }]} {...rowTitleTextProps}>
                {merchantName}
              </Text>
              {hasReceipt ? (
                <View style={[styles.receiptBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="receipt-outline" size={13} color={colors.textMuted} />
                </View>
              ) : null}
            </View>
            {itemName ? (
              <Text style={[styles.transactionSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {itemName}
              </Text>
            ) : null}
          </View>
          <View style={styles.transactionAmountCol}>
            <Text style={[styles.transactionAmount, { color: amountColor }]} {...singleLineAmountProps}>
              {isTransfer ? '' : isIncome ? '+' : '−'}
              {formatDisplayMoneyAbsolute(tx.amount)}
            </Text>
          </View>
      </GlassContainer>
    </Pressable>
  );
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
  const [merchantOverrides, setMerchantOverrides] = useState<MerchantOverride[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
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
  const [selectedPayment, setSelectedPayment] = useState<PaymentDetailPayload | null>(null);

  const load = useCallback(async () => {
    const [nextAccounts, nextSavingsGoals, nextTransactions, nextRecurringPayments, nextMerchantOverrides] = await Promise.all([
      getSimulatedAccounts(),
      getSavingsGoals(),
      getTransactions(),
      getRecurringPayments(),
      getMerchantOverrides(),
    ]);
    setAccounts(nextAccounts);
    setSavingsGoals(nextSavingsGoals);
    setTransactions(nextTransactions);
    setRecurringPayments(nextRecurringPayments);
    setMerchantOverrides(nextMerchantOverrides);
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
  const groupedAccountTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    accountTransactions.forEach((tx) => {
      const key = getLocalDayKey(tx.date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    return Object.entries(groups)
      .map(([day, txs]) => [day, sortTransactionsNewestFirst(txs)] as [string, Transaction[]])
      .sort(([a], [b]) => b.localeCompare(a));
  }, [accountTransactions]);
  const accountRecurringPayments = useMemo(() => {
    if (!account) return [];
    return recurringPayments.filter((payment) => payment.accountId === account.id);
  }, [account, recurringPayments]);
  const groupedAccountRecurringPayments = useMemo(() => {
    const groups: Record<string, RecurringPayment[]> = {};
    accountRecurringPayments.forEach((payment) => {
      const key = payment.nextDate ?? '__no_date__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(payment);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [accountRecurringPayments]);
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
            { backgroundColor: colors.surfaceSolid, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Compte</Text>
        {account ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Modifier le compte"
            hitSlop={12}
            style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
            onPress={() => openEditAccountForm(account)}
          >
            <Ionicons name="create-outline" size={18} color={colors.text} />
            <Text style={[styles.headerActionText, { color: colors.text }]}>Modifier</Text>
          </Pressable>
        ) : (
          <View style={styles.topBarSpacer} />
        )}
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
            <GlassContainer
              style={ghostCardShadow}
              innerStyle={styles.identityCardInner}
              padding={spacing.md}
              borderRadius={radius.xl}
            >
              {getSimulatedAccountLogoUrl(account) ? (
                <LogoIconFrame uri={getSimulatedAccountLogoUrl(account)!} size={52} />
              ) : (
                <View style={userPickedIconWellStyle(52, isLight)}>
                  <Ionicons name={iconForKind(account.kind)} size={22} color={colors.primary} />
                </View>
              )}
              <View style={styles.identityCopy}>
                <Text style={[styles.accountName, { color: colors.text }]} numberOfLines={1}>
                  {account.name}
                </Text>
                <Text style={[styles.accountMeta, { color: colors.textMuted }]} numberOfLines={1}>
                  {linkedSavingsGoal
                    ? `Objectif · ${linkedSavingsGoal.name}`
                    : account.institution?.trim() || accountKindLabel(account.kind)}
                </Text>
              </View>
            </GlassContainer>

            <GlassContainer
              style={styles.summaryCardShell}
              innerStyle={styles.summaryCardInner}
              padding={spacing.md}
              borderRadius={radius.lg}
            >
              <View>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Solde actuel</Text>
                <Text
                  style={[
                    styles.summaryAmount,
                    {
                      color:
                        account.balance < 0
                          ? colors.danger
                          : account.kind === 'credit' && account.balance > 0
                            ? colors.success
                            : colors.text,
                    },
                  ]}
                >
                  {formatSignedDisplayMoney(account.balance, {
                    leadingPlusWhenPositive: account.kind === 'credit' && account.balance > 0,
                  })}
                </Text>
              </View>
              <Text style={[styles.summaryMeta, { color: colors.textMuted }]}>
                {accountTransactions.length} transaction{accountTransactions.length > 1 ? 's' : ''}
              </Text>
            </GlassContainer>

            {creditInfo ? (
              <GlassContainer
                style={styles.creditInfoCardShell}
                innerStyle={styles.creditInfoCardInner}
                padding={spacing.md}
                borderRadius={radius.lg}
              >
                <Text style={[styles.creditSectionLabel, { color: colors.textMuted }]}>
                  SANTÉ DU CRÉDIT
                </Text>

                {typeof creditInfo.available === 'number' ? (
                  <View style={styles.creditHeroBlock}>
                    <Text style={[styles.creditHeroAmount, { color: colors.success }]}>
                      {formatMoney(creditInfo.available)}
                    </Text>
                    <Text style={[styles.creditHeroLabel, { color: colors.textMuted }]}>
                      disponible
                    </Text>
                  </View>
                ) : null}

                {typeof creditInfo.utilPct === 'number' ? (
                  <View style={styles.creditBarRow}>
                    <View style={[styles.creditBarTrack, { backgroundColor: colors.surfaceElevated }]}>
                      <View
                        style={[
                          styles.creditBarFill,
                          {
                            width: `${Math.min(Math.max(creditInfo.utilPct, 1), 100)}%` as `${number}%`,
                            backgroundColor: creditLimitUtilizationBarColor(creditInfo.utilPct, colors, isLight),
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.creditBarPct,
                        { color: creditLimitUtilizationBarColor(creditInfo.utilPct, colors, isLight) },
                      ]}
                    >
                      {`${Math.round(creditInfo.utilPct)} %`}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.creditChipRow}>
                  {typeof creditInfo.creditLimit === 'number' ? (
                    <View style={[styles.creditChip, { backgroundColor: colors.surfaceElevated }]}>
                      <Text style={[styles.creditChipLabel, { color: colors.textMuted }]}>LIMITE</Text>
                      <Text style={[styles.creditChipAmount, { color: colors.text }]}>
                        {formatMoney(creditInfo.creditLimit)}
                      </Text>
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.creditChip,
                      {
                        backgroundColor:
                          typeof creditInfo.utilPct === 'number'
                            ? creditInfo.utilPct >= 85
                              ? colors.dangerMuted
                              : creditInfo.utilPct >= 65
                                ? colors.warningMuted
                                : colors.successMuted
                            : colors.surfaceElevated,
                      },
                    ]}
                  >
                    <Text style={[styles.creditChipLabel, { color: colors.textMuted }]}>UTILISÉ</Text>
                    <Text
                      style={[
                        styles.creditChipAmount,
                        {
                          color:
                            typeof creditInfo.utilPct === 'number'
                              ? creditLimitUtilizationBarColor(creditInfo.utilPct, colors, isLight)
                              : colors.text,
                        },
                      ]}
                    >
                      {formatMoney(creditInfo.creditUsed)}
                    </Text>
                  </View>
                </View>
              </GlassContainer>
            ) : null}

            {checkingMonthlyStats ? (
              <GlassContainer
                style={styles.creditInfoCardShell}
                innerStyle={styles.creditInfoCardInner}
                padding={spacing.md}
                borderRadius={radius.lg}
              >
                <Text style={[styles.creditSectionLabel, { color: colors.textMuted }]}>
                  CE MOIS-CI
                </Text>

                <View style={styles.creditHeroBlock}>
                  <Text
                    style={[
                      styles.creditHeroAmount,
                      { color: checkingMonthlyStats.net >= 0 ? colors.success : colors.danger },
                    ]}
                  >
                    {formatSignedMoney(checkingMonthlyStats.net)}
                  </Text>
                  <Text style={[styles.creditHeroLabel, { color: colors.textMuted }]}>
                    net ce mois
                  </Text>
                </View>

                <View style={styles.creditChipRow}>
                  <View style={[styles.creditChip, { backgroundColor: colors.successMuted }]}>
                    <Text style={[styles.creditChipLabel, { color: colors.textMuted }]}>REVENUS</Text>
                    <Text style={[styles.creditChipAmount, { color: colors.success }]}>
                      {formatMoney(checkingMonthlyStats.revenues)}
                    </Text>
                  </View>
                  <View style={[styles.creditChip, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={[styles.creditChipLabel, { color: colors.textMuted }]}>DÉPENSES</Text>
                    <Text style={[styles.creditChipAmount, { color: colors.text }]}>
                      {formatMoney(checkingMonthlyStats.expenses)}
                    </Text>
                  </View>
                </View>
              </GlassContainer>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Afficher les paiements récurrents"
              android_ripple={null}
              onPress={() => {
                tapHaptic();
                setShowRecurringPayments((visible) => !visible);
              }}
            >
              <GlassContainer
                borderRadius={radius.lg}
                padding={spacing.md}
                innerStyle={styles.recurringToggleInner}
              >
                  <View>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Paiements récurrents</Text>
                    <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>
                      {accountRecurringPayments.length} lié{accountRecurringPayments.length > 1 ? 's' : ''} à ce compte
                    </Text>
                  </View>
                  <Ionicons name={showRecurringPayments ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </GlassContainer>
            </Pressable>

            {showRecurringPayments ? (
              <View style={styles.recurringList}>
                {groupedAccountRecurringPayments.length > 0 ? (
                  groupedAccountRecurringPayments.map(([dateKey, payments]) => (
                    <View key={dateKey} style={styles.recurringGroup}>
                      <View style={styles.recurringGroupHeader}>
                        <Text style={styles.recurringGroupDate}>
                          {dateKey !== '__no_date__' ? formatAgendaUpcomingDate(dateKey) : 'Date inconnue'}
                        </Text>
                      </View>
                      <View style={styles.recurringGroupItems}>
                        {payments.map((payment) => (
                          <Pressable
                            key={payment.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Voir les détails du paiement récurrent ${payment.name}`}
                            android_ripple={null}
                            onPress={() => {
                              tapHaptic();
                              setSelectedPayment({
                                name: payment.name,
                                amount: payment.amount,
                                sourceId: payment.id,
                                recurring: true,
                                kind: payment.kind === 'income' ? 'income' : 'payment',
                                account: payment.accountLabel ?? null,
                                logoUrl: payment.logoUrl ?? null,
                                icon: payment.icon ?? null,
                                color: payment.color ?? null,
                                frequencyLabel: frequencyLabel(payment.frequency),
                                frequency: payment.frequency,
                                active: payment.active,
                                categoryName: payment.categoryName ?? null,
                                categoryId: payment.categoryId ?? null,
                              });
                            }}
                          >
                            <GlassContainer borderRadius={radius.lg} padding={spacing.sm + 2} innerStyle={styles.recurringPaymentRowInner}>
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
                                  {frequencyLabel(payment.frequency)}
                                  {payment.active ? '' : ' · inactif'}
                                </Text>
                              </View>
                              <Text style={[styles.recurringPaymentAmount, { color: payment.kind === 'income' ? colors.success : colors.text }]}>
                                {formatRecurringPaymentAmount(payment.amount, payment.kind ?? 'payment')}
                              </Text>
                            </GlassContainer>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.empty, { color: colors.textMuted }]}>Aucun paiement récurrent pour ce compte.</Text>
                )}
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Historique</Text>
              <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>Toucher pour les détails</Text>
            </View>
            <View style={styles.transactionList}>
              {accountTransactions.length > 0 ? (
                groupedAccountTransactions.map(([date, txs]) => (
                  <View key={date} style={styles.transactionGroup}>
                    <Text style={[styles.transactionGroupLabel, { color: colors.textMuted }]}>
                      {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </Text>
                    <View style={styles.groupTransactions}>
                      {txs.map((tx) => {
                        const override = merchantOverrides.find((item) => item.originalName === tx.label);
                        const merchantName = override?.displayName?.trim() || tx.label;

                        return (
                          <AccountTransactionRow
                            key={tx.id}
                            transaction={tx}
                            merchantName={merchantName}
                            logoUrl={override?.logoUrl ?? null}
                            onPress={() => {
                              tapHaptic();
                              setSelectedTransaction(tx);
                            }}
                          />
                        );
                      })}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.empty, { color: colors.textMuted }]}>Aucune transaction trouvée pour ce compte.</Text>
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
                    styles.deleteButton,
                    { backgroundColor: colors.dangerMuted, borderColor: colors.danger },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => editingAccount && confirmDeleteAccount(editingAccount)}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={[styles.deleteText, { color: colors.danger }]}>Supprimer le compte</Text>
                </Pressable>
              </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <TransactionDetailSheet transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} onDeleted={() => { void load(); }} />
      <PaymentDetailSheet
        detail={selectedPayment}
        onClose={() => setSelectedPayment(null)}
        onDeleted={() => { void load(); }}
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
        backgroundColor: colors.surfaceSolid,
        borderColor: colors.border,
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

function iconForKind(kind: AccountKind): keyof typeof Ionicons.glyphMap {
  if (kind === 'credit') return 'card-outline';
  if (kind === 'savings') return 'cash-outline';
  return 'wallet-outline';
}

function accountKindLabel(kind: AccountKind) {
  if (kind === 'credit') return 'Crédit';
  if (kind === 'savings') return 'Épargne';
  return 'Chèque';
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

function isIconName(value: string): value is keyof typeof Ionicons.glyphMap {
  return value in Ionicons.glyphMap;
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
    color: colors.text,
    fontSize: typography.screenTitle,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  topBarSpacer: { width: 38 },
  headerAction: {
    minWidth: 78,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
  },
  headerActionText: {
    fontSize: typography.meta,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  identityCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  accountIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIconFallback: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  accountLogoImage: { width: 40, height: 40 },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  accountName: {
    color: colors.text,
    fontSize: typography.dashboardGreeting,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  accountMeta: {
    color: colors.textMuted,
    fontSize: typography.meta,
    fontWeight: '700',
  },
  summaryCardShell: {
    borderRadius: radius.lg,
  },
  summaryCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  summaryAmount: {
    color: colors.text,
    fontSize: typography.heroStat,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  summaryMeta: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '800',
    paddingBottom: 4,
  },
  creditInfoCardShell: {
    borderRadius: radius.lg,
  },
  creditInfoCardInner: {
    gap: spacing.md,
  },
  creditSectionLabel: {
    ...interBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  creditHeroBlock: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: 3,
  },
  creditHeroAmount: {
    ...interExtraBoldText,
    fontSize: typography.displayAmount,
    letterSpacing: -1,
  },
  creditHeroLabel: {
    ...interMediumText,
    fontSize: typography.meta,
  },
  creditBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  creditBarTrack: {
    flex: 1,
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  creditBarFill: {
    height: 10,
    borderRadius: radius.pill,
  },
  creditBarPct: {
    ...interBoldText,
    fontSize: typography.meta,
    minWidth: 42,
    textAlign: 'right',
  },
  creditChipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  creditChip: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  creditChipLabel: {
    ...interBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  creditChipAmount: {
    ...interBoldText,
    fontSize: typography.caption,
  },
  deleteSection: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  deleteDivider: {
    height: StyleSheet.hairlineWidth,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  deleteText: {
    fontSize: typography.meta,
    fontWeight: '800',
  },
  recurringToggleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  recurringList: {
    gap: spacing.md,
    marginTop: -spacing.xs,
  },
  recurringGroup: {
    gap: spacing.sm,
  },
  recurringGroupHeader: {
    paddingBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  recurringGroupDate: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
  recurringGroupItems: {
    gap: spacing.xs,
  },
  recurringPaymentRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
  },
  transactionList: {
    gap: spacing.lg,
  },
  transactionGroup: {
    gap: spacing.xs,
  },
  transactionGroupLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textTransform: 'capitalize',
  },
  groupTransactions: {
    gap: spacing.xs,
  },
  transactionRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  transactionBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  transactionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  transactionTitle: {
    ...listRowTitle,
    color: colors.text,
  },
  transactionSubtitle: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    lineHeight: typography.micro + 3,
  },
  receiptBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  transactionAmountCol: {
    ...rowValueContainer,
    alignSelf: 'stretch',
    justifyContent: 'center',
    minWidth: 88,
  },
  transactionAmount: {
    ...rowValue,
    color: colors.text,
    textAlign: 'right',
  },
  empty: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: spacing.lg,
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

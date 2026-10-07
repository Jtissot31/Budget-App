/**
 * Accueil — patrimoine, comptes, objectifs, factures à venir.
 * Chiffres et libellés viennent des données réelles (jamais du mock visuel).
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgendaBillRowCard, AGENDA_BILL_ROW_GAP } from '@/components/agenda/AgendaBillRowCard';
import { calendarBoxParts } from '@/components/DashboardDateBadge';
import { AppIcon } from '@/components/icons/AppIcon';
import { OnyxContainer } from '@/components/OnyxContainer';
import { PageTransition } from '@/components/PageTransition';
import { ProgressBar } from '@/components/ProgressBar';
import {
  ACCOUNT_KIND_OPTIONS,
  createNewAccountForm,
  saveSimulatedAccountForm,
  SimulatedAccountFormModal,
  type AccountForm,
} from '@/components/SimulatedAccountForm';
import {
  SettingsPickerSheet,
  type SettingsPickerOption,
} from '@/components/SettingsPickerSheet';
import {
  createNewGoalForm,
  SavingsGoalFormModal,
  saveSavingsGoalForm,
  type GoalForm,
} from '@/components/SavingsGoalsForm';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { InstitutionMark } from '@/components/wallet/AccountCardPrototypes';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { ONYX_CONTAINER, onyxContainerPressedStyle } from '@/constants/planFinanceKit';
import {
  FLOATING_NAV_CONTENT_PADDING,
  moneyAmountTypography,
  PAGE_PADDING_HORIZONTAL,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import {
  accountBalanceDisplayName,
  accountKindTypeLabel,
} from '@/lib/accountBalancePresentation';
import { buildNetWorthDailySeries } from '@/lib/buildNetWorthTrendSeries';
import {
  getCategoryBudgets,
  getDashboard,
  getRecurringPayments,
  getSavingsGoals,
  getSimulatedAccounts,
  getTransactionsSince,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { formatNumberDisplay } from '@/lib/formatNumber';
import type { FormFeedback } from '@/lib/formFeedback';
import { isFormSaveSuccess } from '@/lib/formFeedback';
import { tapHaptic } from '@/lib/haptics';
import { ensureDbReady } from '@/lib/init';
import { buildRecurringBillsByDate } from '@/lib/protoAgendaBills';
import { buildGoalProgressions } from '@/lib/savingsGamification';
import { syncWithServer } from '@/lib/sync';
import { useAppTheme } from '@/lib/themeContext';
import { getUserDisplayName } from '@/lib/userDisplay';
import type {
  AccountKind,
  AgendaBill,
  CategoryBudget,
  DashboardSummary,
  RecurringPayment,
  SavingsGoal,
  SimulatedAccount,
  Transaction,
} from '@/types';

const TREND_DAY_COUNT = 30;
const UPCOMING_WINDOW_DAYS = 90;
const FAB_SIZE = 56;

const ACCOUNT_TYPE_PICKER_OPTIONS: SettingsPickerOption<AccountKind>[] =
  ACCOUNT_KIND_OPTIONS.map(({ id, label, description, icon }) => ({
    id,
    label,
    description,
    icon,
  }));

function timeOfDayGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toLocaleUpperCase('fr-CA');
}

function trendSinceIso(dayCount: number): string {
  const since = new Date();
  since.setDate(since.getDate() - (dayCount + 1));
  since.setHours(0, 0, 0, 0);
  return since.toISOString();
}

function accountCardMeta(account: SimulatedAccount): string {
  const kind = accountKindTypeLabel(account.kind);
  const digits = (account.last4 ?? '').replace(/\D/g, '').slice(-4);
  if (!digits) return kind;
  return `${kind} ··${digits}`;
}

function formatBalance(balance: number): string {
  const amount = formatDisplayMoneyAbsolute(Math.abs(balance));
  return balance < 0 ? `−${amount}` : amount;
}

function formatSignedPct(pct: number): string {
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  const body = formatNumberDisplay(Math.abs(pct), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${sign}${body} %`;
}

/** One upcoming money-out occurrence per recurring payment, soonest first. */
function upcomingPaymentRows(
  payments: readonly RecurringPayment[],
  now: Date,
): { dateKey: string; bill: AgendaBill }[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + UPCOMING_WINDOW_DAYS);
  const byDate = buildRecurringBillsByDate(payments, start, end);
  const rows: { dateKey: string; bill: AgendaBill }[] = [];
  const seen = new Set<string>();
  for (const dateKey of Object.keys(byDate).sort()) {
    for (const bill of byDate[dateKey] ?? []) {
      if ((bill.kind ?? 'payment') === 'income') continue;
      const id = bill.sourceId ?? `${bill.name}:${bill.account}:${bill.amount}`;
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push({ dateKey, bill });
    }
  }
  return rows;
}

function HomeDarkCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, isLight } = useAppTheme();
  return (
    <OnyxContainer
      halo={isLight}
      style={[!isLight && { backgroundColor: colors.modalSurface }, style]}
    >
      {children}
    </OnyxContainer>
  );
}

function CountChip({ label }: { label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.chip, { backgroundColor: colors.iconWell }]}>
      <Text style={[typographyKit.microMedium, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function SectionHeading({
  title,
  chip,
  actionLabel,
  actionAccessibilityLabel,
  onAction,
}: {
  title: string;
  chip: string;
  actionLabel: string;
  actionAccessibilityLabel: string;
  onAction: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]} numberOfLines={1}>
          {title}
        </Text>
        <CountChip label={chip} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionAccessibilityLabel}
        hitSlop={8}
        onPress={onAction}
        style={({ pressed }) => [styles.sectionAction, pressed && { opacity: 0.7 }]}
      >
        <Text style={[typographyKit.metaSemibold, { color: colors.text }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

export function ProtoHomeHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const greeting = timeOfDayGreeting(new Date());

  const [displayName, setDisplayName] = useState('');
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [trendTransactions, setTrendTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [accountTypePickerVisible, setAccountTypePickerVisible] = useState(false);
  const [accountForm, setAccountForm] = useState<AccountForm | null>(null);
  const [accountFormLockedType, setAccountFormLockedType] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountFormFeedback, setAccountFormFeedback] = useState<FormFeedback | null>(null);

  const [goalForm, setGoalForm] = useState<GoalForm | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalFormFeedback, setGoalFormFeedback] = useState<FormFeedback | null>(null);

  const load = useCallback(async () => {
    await ensureDbReady();
    const [name, nextAccounts, nextGoals, nextDashboard, nextBudgets, nextPayments, trendTx] =
      await Promise.all([
        getUserDisplayName(),
        getSimulatedAccounts(),
        getSavingsGoals(),
        getDashboard(),
        getCategoryBudgets(),
        getRecurringPayments(),
        getTransactionsSince(trendSinceIso(TREND_DAY_COUNT)),
      ]);
    setDisplayName(name);
    setAccounts(nextAccounts);
    setGoals(nextGoals);
    setDashboard(nextDashboard);
    setCategoryBudgets(nextBudgets);
    setRecurringPayments(nextPayments);
    setTrendTransactions(trendTx);
  }, []);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => {
      void load();
    });
  }, [load]);

  useRefreshOnFocus(load, { minIntervalMs: 5_000 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncWithServer().catch(() => undefined);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const visibleAccounts = useMemo(
    () => accounts.filter((account) => !account.hidden),
    [accounts],
  );

  const totalNetWorth = useMemo(
    () => visibleAccounts.reduce((sum, account) => sum + account.balance, 0),
    [visibleAccounts],
  );

  const netWorthPct = useMemo(() => {
    if (visibleAccounts.length === 0) return null;
    const series = buildNetWorthDailySeries(
      'accounts_only',
      totalNetWorth,
      visibleAccounts,
      0,
      trendTransactions,
      new Date(),
      TREND_DAY_COUNT,
    ).map((point) => point.value);
    if (series.length < 2) return null;
    const first = series[0] ?? 0;
    const last = series[series.length - 1] ?? 0;
    if (first === 0 || Math.abs(last - first) < 0.01) return null;
    const pct = ((last - first) / Math.abs(first)) * 100;
    return Number.isFinite(pct) ? pct : null;
  }, [totalNetWorth, trendTransactions, visibleAccounts]);

  const monthlyIncome = dashboard?.monthlyIncome ?? 0;
  const monthlyExpenses = dashboard?.monthlyExpenses ?? 0;
  const savingsRate =
    monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100) : null;

  const goalProgressions = useMemo(() => buildGoalProgressions(goals), [goals]);
  const activeGoalCount = goalProgressions.filter((goal) => !goal.completed).length;

  const upcoming = useMemo(
    () => upcomingPaymentRows(recurringPayments, new Date()),
    [recurringPayments],
  );

  const initials = initialsFromName(displayName);
  const fabBottom = Math.max(insets.bottom, 12) + 64;

  const openSettings = useCallback(() => {
    tapHaptic();
    router.push('/settings');
  }, [router]);

  const openAgenda = useCallback(() => {
    tapHaptic();
    router.navigate('/goals');
  }, [router]);

  const openAddTransaction = useCallback(() => {
    tapHaptic();
    router.push('/add-transaction');
  }, [router]);

  const openAccount = useCallback(
    (accountId: string) => {
      tapHaptic();
      router.push({ pathname: '/account-detail', params: { accountId } });
    },
    [router],
  );

  const openGoal = useCallback(
    (goalId: string) => {
      tapHaptic();
      router.push({ pathname: '/goal-detail', params: { goalId } });
    },
    [router],
  );

  const openAddAccount = useCallback(() => {
    tapHaptic();
    setAccountFormFeedback(null);
    setAccountTypePickerVisible(true);
  }, []);

  const closeAccountTypePicker = useCallback(() => {
    setAccountTypePickerVisible(false);
  }, []);

  const handleSelectAccountType = useCallback(
    (kind: AccountKind) => {
      setAccountFormFeedback(null);
      setAccountFormLockedType(true);
      setTimeout(() => {
        setAccountForm(createNewAccountForm(accounts.length, kind));
      }, 280);
    },
    [accounts.length],
  );

  const closeAccountForm = useCallback(() => {
    setAccountForm(null);
    setAccountFormLockedType(false);
    setAccountFormFeedback(null);
  }, []);

  const saveAccount = useCallback(async () => {
    if (!accountForm) return;
    setSavingAccount(true);
    setAccountFormFeedback(null);
    try {
      const result = await saveSimulatedAccountForm(accountForm);
      if (isFormSaveSuccess(result)) {
        const accountId = accountForm.id;
        closeAccountForm();
        dataEvents.emit();
        await load();
        router.push({ pathname: '/account-detail', params: { accountId } });
        return;
      }
      setAccountFormFeedback(result);
    } finally {
      setSavingAccount(false);
    }
  }, [accountForm, closeAccountForm, load, router]);

  const openNewGoalForm = useCallback(() => {
    tapHaptic();
    setGoalFormFeedback(null);
    setGoalForm(createNewGoalForm());
  }, []);

  const closeGoalForm = useCallback(() => {
    setGoalForm(null);
    setGoalFormFeedback(null);
  }, []);

  const saveGoal = useCallback(async () => {
    if (!goalForm) return;
    setSavingGoal(true);
    setGoalFormFeedback(null);
    try {
      const result = await saveSavingsGoalForm(goalForm, isLight);
      if (isFormSaveSuccess(result)) {
        closeGoalForm();
        dataEvents.emit();
        await load();
        return;
      }
      setGoalFormFeedback(result);
    } finally {
      setSavingGoal(false);
    }
  }, [closeGoalForm, goalForm, isLight, load]);

  const trendPositive = (netWorthPct ?? 0) >= 0;
  const savingsPositive = (savingsRate ?? 0) >= 0;

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={{
            paddingTop: insets.top + SCREEN_TOP_GUTTER,
            paddingBottom: fabBottom + FAB_SIZE + spacing.lg,
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
            gap: spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: colors.iconWell }]}>
              {initials ? (
                <Text style={[typographyKit.rowTitle, { color: colors.text }]}>{initials}</Text>
              ) : (
                <AppIcon family="ionicons" name="person" size={20} color={colors.text} />
              )}
            </View>
            <View style={styles.headerCopy}>
              <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]} numberOfLines={1}>
                {greeting} 👋
              </Text>
              <Text
                style={[typographyKit.sectionTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ouvrir les réglages"
              onPress={openSettings}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: colors.iconWell },
                pressed && onyxContainerPressedStyle(),
              ]}
            >
              <AppIcon family="ionicons" name="settings-outline" size={20} color={colors.text} />
            </Pressable>
          </View>

          <HomeDarkCard style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View style={styles.summaryCopy}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Patrimoine net</Text>
                <Text
                  style={[
                    moneyAmountTypography({ tier: 'hero', fontSize: 32, lineHeight: 38 }),
                    { color: colors.text },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {formatDisplayMoneyAbsolute(totalNetWorth)}
                </Text>
              </View>
              {netWorthPct != null ? (
                <View
                  style={[
                    styles.trendPill,
                    {
                      borderColor: trendPositive ? colors.accentGreen : colors.danger,
                    },
                  ]}
                >
                  <AppIcon
                    family="ionicons"
                    name={trendPositive ? 'arrow-up' : 'arrow-down'}
                    size={12}
                    color={trendPositive ? colors.accentGreen : colors.danger}
                  />
                  <Text
                    style={[
                      typographyKit.metaSemibold,
                      { color: trendPositive ? colors.accentGreen : colors.danger },
                    ]}
                  >
                    {formatSignedPct(netWorthPct)}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.statRow, { borderTopColor: colors.borderSubtle }]}>
              <View style={styles.statCell}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Revenus</Text>
                <Text
                  style={[
                    moneyAmountTypography({ tier: 'card', fontSize: 15, lineHeight: 20 }),
                    { color: colors.accentGreen },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {monthlyIncome > 0
                    ? `+${formatDisplayMoneyAbsolute(monthlyIncome)}`
                    : formatDisplayMoneyAbsolute(0)}
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.borderSubtle }]} />
              <View style={styles.statCell}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Dépenses</Text>
                <Text
                  style={[
                    moneyAmountTypography({ tier: 'card', fontSize: 15, lineHeight: 20 }),
                    { color: colors.danger },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {monthlyExpenses > 0
                    ? `−${formatDisplayMoneyAbsolute(monthlyExpenses)}`
                    : formatDisplayMoneyAbsolute(0)}
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.borderSubtle }]} />
              <View style={styles.statCell}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Taux d’épargne</Text>
                <Text
                  style={[
                    moneyAmountTypography({ tier: 'card', fontSize: 15, lineHeight: 20 }),
                    {
                      color:
                        savingsRate == null
                          ? colors.textMuted
                          : savingsPositive
                            ? colors.accentGreen
                            : colors.danger,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {savingsRate == null
                    ? '—'
                    : `${savingsRate < 0 ? '−' : ''}${formatNumberDisplay(Math.abs(savingsRate))} %`}
                </Text>
              </View>
            </View>
          </HomeDarkCard>

          <View style={styles.section}>
            <SectionHeading
              title="Comptes"
              chip={String(visibleAccounts.length)}
              actionLabel="+ Ajouter"
              actionAccessibilityLabel="Ajouter un compte"
              onAction={openAddAccount}
            />
            {visibleAccounts.length === 0 ? (
              <HomeDarkCard style={styles.emptyCard}>
                <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>
                  Aucun compte pour le moment
                </Text>
              </HomeDarkCard>
            ) : (
              <View style={styles.accountGrid}>
                {visibleAccounts.map((account) => {
                  const rate =
                    typeof account.interestRate === 'number' && account.interestRate > 0
                      ? account.interestRate
                      : null;
                  const title = accountBalanceDisplayName(account) || 'Compte';
                  return (
                    <View
                      key={account.id}
                      style={visibleAccounts.length === 1 ? styles.accountCellSolo : styles.accountCell}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${title}, ${formatBalance(account.balance)}`}
                        onPress={() => openAccount(account.id)}
                        style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
                      >
                        <HomeDarkCard style={styles.accountCard}>
                          <View style={styles.accountTop}>
                            <InstitutionMark account={account} size={32} />
                            {rate != null ? (
                              <View
                                style={[
                                  styles.ratePill,
                                  { backgroundColor: colors.iconWell },
                                ]}
                              >
                                <Text
                                  style={[typographyKit.microMedium, { color: colors.accentGreen }]}
                                >
                                  {formatNumberDisplay(rate, { maximumFractionDigits: 2 })} %
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text
                            style={[typographyKit.rowTitle, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {title}
                          </Text>
                          <Text
                            style={[typographyKit.microMedium, { color: colors.textMuted }]}
                            numberOfLines={1}
                          >
                            {accountCardMeta(account)}
                          </Text>
                          <Text
                            style={[
                              moneyAmountTypography({ tier: 'card', fontSize: 18, lineHeight: 22 }),
                              { color: account.balance < 0 ? colors.danger : colors.text },
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                          >
                            {formatBalance(account.balance)}
                          </Text>
                        </HomeDarkCard>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <SectionHeading
              title="Objectifs"
              chip={activeGoalCount > 1 ? `${activeGoalCount} actifs` : `${activeGoalCount} actif`}
              actionLabel="+ Objectif"
              actionAccessibilityLabel="Nouvel objectif"
              onAction={openNewGoalForm}
            />
            {goalProgressions.length === 0 ? (
              <HomeDarkCard style={styles.emptyCard}>
                <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>
                  Aucun objectif pour le moment
                </Text>
              </HomeDarkCard>
            ) : (
              <View style={styles.stack}>
                {goalProgressions.map((goal) => (
                  <Pressable
                    key={goal.goalId}
                    accessibilityRole="button"
                    accessibilityLabel={`${goal.name}, ${goal.pct} pour cent`}
                    onPress={() => openGoal(goal.goalId)}
                    style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
                  >
                    <HomeDarkCard style={styles.goalCard}>
                      <View style={styles.goalTop}>
                        <UserPickedIconWell icon={goal.icon} size={36} />
                        <View style={styles.goalCopy}>
                          <View style={styles.goalTitleRow}>
                            <Text
                              style={[typographyKit.rowTitle, styles.goalName, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {goal.name}
                            </Text>
                            <Text style={[typographyKit.metaSemibold, { color: colors.accentGreen }]}>
                              {formatNumberDisplay(goal.pct)} %
                            </Text>
                          </View>
                          <Text
                            style={[typographyKit.microMedium, { color: colors.textMuted }]}
                            numberOfLines={1}
                          >
                            {formatDisplayMoneyAbsolute(goal.currentAmount)} sur{' '}
                            {formatDisplayMoneyAbsolute(goal.targetAmount)}
                          </Text>
                        </View>
                      </View>
                      <ProgressBar
                        progress={goal.progress}
                        color={colors.accentGreen}
                        trackColor={colors.borderSubtle}
                        height={6}
                      />
                    </HomeDarkCard>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <SectionHeading
              title="Factures à venir"
              chip={`${upcoming.length} à venir`}
              actionLabel="Calendrier"
              actionAccessibilityLabel="Ouvrir l’agenda"
              onAction={openAgenda}
            />
            {upcoming.length === 0 ? (
              <HomeDarkCard style={styles.emptyCard}>
                <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>
                  Aucune facture à venir
                </Text>
              </HomeDarkCard>
            ) : (
              <View style={styles.billList}>
                {upcoming.map(({ dateKey, bill }) => {
                  const { month, day } = calendarBoxParts(dateKey);
                  const subtitle = bill.account?.trim() ?? '';
                  return (
                    <Pressable
                      key={`${bill.sourceId ?? bill.name}:${dateKey}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${bill.name}, ${formatDisplayMoneyAbsolute(bill.amount)}`}
                      onPress={openAgenda}
                      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
                    >
                      <AgendaBillRowCard>
                        <View style={styles.billCard}>
                          <View style={styles.dateStack}>
                            <Text style={[typographyKit.microMedium, { color: colors.textMuted }]}>
                              {month}
                            </Text>
                            <Text style={[typographyKit.rowTitle, { color: colors.text }]}>{day}</Text>
                          </View>
                          <View style={styles.billCopy}>
                            <Text
                              style={[typographyKit.rowTitle, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {bill.name}
                            </Text>
                            {subtitle ? (
                              <Text
                                style={[typographyKit.microMedium, { color: colors.textMuted }]}
                                numberOfLines={1}
                              >
                                {subtitle}
                              </Text>
                            ) : null}
                          </View>
                          <Text
                            style={[
                              moneyAmountTypography({ tier: 'row' }),
                              { color: colors.danger },
                            ]}
                            numberOfLines={1}
                          >
                            −{formatDisplayMoneyAbsolute(bill.amount)}
                          </Text>
                        </View>
                      </AgendaBillRowCard>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nouvelle transaction"
          onPress={openAddTransaction}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.text,
              bottom: fabBottom,
              right: PAGE_PADDING_HORIZONTAL,
            },
            pressed && { opacity: 0.82 },
          ]}
        >
          <AppIcon family="ionicons" name="add" size={28} color={colors.background} />
        </Pressable>

        <SettingsPickerSheet
          visible={accountTypePickerVisible}
          title="Type de compte"
          options={ACCOUNT_TYPE_PICKER_OPTIONS}
          selectedId={'' as AccountKind}
          onClose={closeAccountTypePicker}
          onSelect={handleSelectAccountType}
        />

        <SimulatedAccountFormModal
          form={accountForm}
          setForm={setAccountForm}
          saving={savingAccount}
          onDismiss={closeAccountForm}
          onSave={() => void saveAccount()}
          feedback={accountFormFeedback}
          lockedType={accountFormLockedType}
        />

        <SavingsGoalFormModal
          form={goalForm}
          setForm={setGoalForm}
          goals={goals}
          dashboard={dashboard}
          categoryBudgets={categoryBudgets}
          recurringPayments={recurringPayments}
          saving={savingGoal}
          onDismiss={closeGoalForm}
          onSave={() => void saveGoal()}
          feedback={goalFormFeedback}
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
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 18,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  statCell: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  statLabel: {
    ...typographyKit.eyebrow,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typographyKit.eyebrow,
    fontSize: 11,
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  sectionAction: {
    flexShrink: 0,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  emptyCard: {
    padding: spacing.lg,
  },
  accountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  accountCell: {
    width: '50%',
    paddingHorizontal: 5,
    marginBottom: spacing.sm,
  },
  accountCellSolo: {
    width: '100%',
    paddingHorizontal: 5,
    marginBottom: spacing.sm,
  },
  accountCard: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md + 2,
    gap: 4,
    minHeight: 132,
  },
  accountTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  ratePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stack: {
    gap: ONYX_CONTAINER.listGap,
  },
  goalCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  goalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  goalCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  goalName: {
    flex: 1,
    minWidth: 0,
  },
  billList: {
    gap: AGENDA_BILL_ROW_GAP,
  },
  billCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dateStack: {
    width: 40,
    alignItems: 'center',
  },
  billCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  fab: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
});

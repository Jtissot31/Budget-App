/**
 * Accueil — vue d'ensemble en un coup d'œil, au style de l'historique des transactions.
 *
 * 1. Patrimoine net (+ revenus / dépenses / épargne du mois)
 * 2. Budget du mois (une ligne, barre de progression)
 * 3. À venir — prochaines factures
 * 4. Objectifs d'épargne
 *
 * Les comptes vivent dans Portefeuille (pas de doublon ici).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { calendarBoxParts } from '@/components/DashboardDateBadge';
import {
  AreaSparkline,
  DateWell,
  EmptyRow,
  GoalTile,
  HeaderIconButton,
  ListCard,
  ListRow,
  PageHeader,
  Reveal,
  RingGauge,
  SECTION_GAP,
  SectionLabel,
  SummaryCard,
} from '@/components/kit';
import { TodayCard } from '@/components/dashboard/TodayCard';
import { PageTransition } from '@/components/PageTransition';
import {
  createNewGoalForm,
  SavingsGoalFormModal,
  saveSavingsGoalForm,
  type GoalForm,
} from '@/components/SavingsGoalsForm';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { FLOATING_NAV_CONTENT_PADDING, PAGE_PADDING_HORIZONTAL, spacing, typographyKit } from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { getCategoriesForMonth, initializeCategories } from '@/lib/budgetCategories';
import { mapBudgetCategoriesToUi, type BudgetCategoryUiModel } from '@/lib/budgetCategoryModel';
import { startOfMonth } from '@/lib/budgetMonth';
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
  AgendaBill,
  CategoryBudget,
  DashboardSummary,
  RecurringPayment,
  SavingsGoal,
  SimulatedAccount,
  Transaction,
} from '@/types';

const TREND_DAY_COUNT = 30;
const UPCOMING_WINDOW_DAYS = 45;
const UPCOMING_MAX_ROWS = 4;

function timeOfDayGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

function trendSinceIso(dayCount: number): string {
  const since = new Date();
  since.setDate(since.getDate() - (dayCount + 1));
  since.setHours(0, 0, 0, 0);
  return since.toISOString();
}

function signedMoney(value: number): string {
  return `${value < 0 ? "−" : ""}${formatDisplayMoneyAbsolute(Math.abs(value))}`;
}

function formatSignedPct(pct: number): string {
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  const body = formatNumberDisplay(Math.abs(pct), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${sign}${body} %`;
}

/** Due today, tomorrow or the day after — worth highlighting. */
function dueSoon(dateKey: string, now = new Date()): boolean {
  const due = new Date(`${dateKey}T12:00:00`);
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000) <= 2;
}

function relativeDueLabel(dateKey: string, now: Date): string {
  const due = new Date(`${dateKey}T12:00:00`);
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Demain';
  return `Dans ${days} jours`;
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

  const [goalForm, setGoalForm] = useState<GoalForm | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalFormFeedback, setGoalFormFeedback] = useState<FormFeedback | null>(null);

  const [budgetCategories, setBudgetCategories] = useState<BudgetCategoryUiModel[]>([]);

  const load = useCallback(async () => {
    await ensureDbReady();
    await initializeCategories();
    const [name, nextAccounts, nextGoals, nextDashboard, nextBudgets, nextPayments, trendTx, monthCats] =
      await Promise.all([
        getUserDisplayName(),
        getSimulatedAccounts(),
        getSavingsGoals(),
        getDashboard(),
        getCategoryBudgets(),
        getRecurringPayments(),
        getTransactionsSince(trendSinceIso(TREND_DAY_COUNT)),
        // Same source as the Budget tab so both screens show identical numbers.
        getCategoriesForMonth(startOfMonth(new Date())),
      ]);
    setDisplayName(name);
    setAccounts(nextAccounts);
    setGoals(nextGoals);
    setDashboard(nextDashboard);
    setCategoryBudgets(nextBudgets);
    setBudgetCategories(mapBudgetCategoriesToUi(monthCats));
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

  const netWorthSeries = useMemo(() => {
    if (visibleAccounts.length === 0) return [] as number[];
    return buildNetWorthDailySeries(
      'accounts_only',
      totalNetWorth,
      visibleAccounts,
      0,
      trendTransactions,
      new Date(),
      TREND_DAY_COUNT,
    ).map((point) => point.value);
  }, [totalNetWorth, trendTransactions, visibleAccounts]);

  const netWorthPct = useMemo(() => {
    if (netWorthSeries.length < 2) return null;
    const first = netWorthSeries[0] ?? 0;
    const last = netWorthSeries[netWorthSeries.length - 1] ?? 0;
    if (first === 0 || Math.abs(last - first) < 0.01) return null;
    const pct = ((last - first) / Math.abs(first)) * 100;
    return Number.isFinite(pct) ? pct : null;
  }, [netWorthSeries]);

  const monthlyIncome = dashboard?.monthlyIncome ?? 0;
  const monthlyExpenses = dashboard?.monthlyExpenses ?? 0;
  const savingsRate =
    monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100) : null;

  const budget = useMemo(() => {
    const limit = budgetCategories.reduce((sum, b) => sum + Math.max(0, b.limit), 0);
    const spent = budgetCategories.reduce((sum, b) => sum + Math.max(0, b.spent), 0);
    const over = budgetCategories.filter((b) => b.limit > 0 && b.spent > b.limit).length;
    return { limit, spent, remaining: limit - spent, over };
  }, [budgetCategories]);

  const goalProgressions = useMemo(
    () => buildGoalProgressions(goals).filter((goal) => !goal.completed),
    [goals],
  );

  const upcoming = useMemo(
    () => upcomingPaymentRows(recurringPayments, new Date()),
    [recurringPayments],
  );
  const upcomingTotal = useMemo(
    () => upcoming.reduce((sum, row) => sum + row.bill.amount, 0),
    [upcoming],
  );

  const name = firstName(displayName);

  const go = useCallback(
    (href: Parameters<typeof router.push>[0]) => {
      tapHaptic();
      router.push(href);
    },
    [router],
  );

  const openNewGoalForm = useCallback(() => {
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

  const trendColor = (netWorthPct ?? 0) >= 0 ? colors.accentGreen : colors.danger;
  const budgetRatio = budget.limit > 0 ? budget.spent / budget.limit : 0;
  // Same thresholds as the Budget tab ring: green ≤ 102 %, orange ≤ 110 %, red beyond.
  const budgetPct = Math.round(budgetRatio * 100);
  const budgetColor = budgetPct <= 102 ? colors.accentGreen : budgetPct <= 110 ? '#F59E0B' : colors.danger;

  const budgetSubtitle =
    budget.over > 0
      ? `${budget.over} catégorie${budget.over > 1 ? 's' : ''} en dépassement`
      : `${formatDisplayMoneyAbsolute(budget.spent)} sur ${formatDisplayMoneyAbsolute(budget.limit)}`;

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={{
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.lg,
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <PageHeader
            topInset={insets.top}
            title="Accueil"
            subtitle={name ? `${greeting}, ${name}` : greeting}
            trailing={
              <>
                <HeaderIconButton
                  icon="notifications-outline"
                  accessibilityLabel="Ouvrir les messages"
                  onPress={() => go('/alert-center')}
                />
                <HeaderIconButton
                  icon="settings-outline"
                  accessibilityLabel="Ouvrir les réglages"
                  onPress={() => go('/settings')}
                />
              </>
            }
          />

          <Reveal index={0} style={styles.section}>
            <SummaryCard
              label="Patrimoine net"
              amount={signedMoney(totalNetWorth)}
              amountValue={totalNetWorth}
              formatAmount={signedMoney}
              badge={
                netWorthPct != null
                  ? { label: `${formatSignedPct(netWorthPct)} · 30 j`, color: trendColor }
                  : undefined
              }
              stats={[
                {
                  label: 'Revenus',
                  value: `+${formatDisplayMoneyAbsolute(monthlyIncome)}`,
                  color: colors.accentGreen,
                },
                {
                  label: 'Dépenses',
                  value: `−${formatDisplayMoneyAbsolute(monthlyExpenses)}`,
                },
                {
                  label: 'Épargne',
                  value:
                    savingsRate == null
                      ? '—'
                      : `${savingsRate < 0 ? '−' : ''}${formatNumberDisplay(Math.abs(savingsRate))} %`,
                  color:
                    savingsRate == null
                      ? colors.textMuted
                      : savingsRate >= 0
                        ? colors.accentGreen
                        : colors.danger,
                },
              ]}
              onPress={() => router.navigate('/accounts')}
              accessibilityLabel="Patrimoine net, ouvrir le portefeuille"
            >
              {netWorthSeries.length > 1 ? (
                <AreaSparkline data={netWorthSeries} color={trendColor} height={52} />
              ) : null}
            </SummaryCard>
          </Reveal>

          <Reveal index={1} style={styles.section}>
            <TodayCard />
          </Reveal>

          <Reveal index={2} style={styles.section}>
            <SectionLabel title="Budget du mois" actionLabel="Détails" onAction={() => router.navigate('/budgets')} />
            <ListCard>
              {budget.limit > 0 ? (
                <ListRow
                  leading={
                    <RingGauge progress={budgetRatio} color={budgetColor} size={40} stroke={5}>
                      <Text style={[styles.ringText, { color: colors.text }]}>
                        {Math.min(999, Math.round(budgetRatio * 100))}
                      </Text>
                    </RingGauge>
                  }
                  title={budget.remaining < 0 ? 'Budget dépassé' : `${signedMoney(budget.remaining)} restants`}
                  subtitle={budgetSubtitle}
                  isLast
                  chevron
                  onPress={() => router.navigate('/budgets')}
                />
              ) : (
                <EmptyRow
                  label="Aucun budget défini"
                  actionLabel="Créer"
                  onAction={() => router.navigate('/budgets')}
                />
              )}
            </ListCard>
          </Reveal>

          <Reveal index={3} style={styles.section}>
            <SectionLabel
              title={upcoming.length > 0 ? `À venir · ${formatDisplayMoneyAbsolute(upcomingTotal)}` : 'À venir'}
              actionLabel="Agenda"
              onAction={() => router.navigate('/goals')}
            />
            <ListCard>
              {upcoming.length === 0 ? (
                <EmptyRow label="Rien à payer d’ici 45 jours" />
              ) : (
                upcoming.slice(0, UPCOMING_MAX_ROWS).map(({ dateKey, bill }, index, rows) => {
                  const { month, day } = calendarBoxParts(dateKey);
                  return (
                    <ListRow
                      key={`${bill.sourceId ?? bill.name}:${dateKey}`}
                      leading={<DateWell month={month} day={day} />}
                      title={bill.name}
                      subtitle={relativeDueLabel(dateKey, new Date())}
                      subtitleColor={dueSoon(dateKey) ? '#F59E0B' : undefined}
                      valueColor={dueSoon(dateKey) ? '#F59E0B' : undefined}
                      value={`−${formatDisplayMoneyAbsolute(bill.amount)}`}
                      isLast={index === rows.length - 1}
                      onPress={() => router.navigate('/goals')}
                    />
                  );
                })
              )}
            </ListCard>
          </Reveal>

          <Reveal index={4} style={styles.section}>
            <SectionLabel title="Objectifs" actionLabel="Nouveau" onAction={openNewGoalForm} />
            {goalProgressions.length === 0 ? (
              <ListCard>
                <EmptyRow label="Aucun objectif en cours" actionLabel="Créer" onAction={openNewGoalForm} />
              </ListCard>
            ) : (
              <View style={styles.goalGrid}>
                {goalProgressions.map((goal) => (
                  <View key={goal.goalId} style={styles.goalCell}>
                    <GoalTile
                      name={goal.name}
                      icon={<UserPickedIconWell icon={goal.icon} size={32} />}
                      saved={goal.currentAmount}
                      target={goal.targetAmount}
                      onPress={() => go({ pathname: '/goal-detail', params: { goalId: goal.goalId } })}
                    />
                  </View>
                ))}
              </View>
            )}
          </Reveal>
        </ScrollView>

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
  section: { marginBottom: SECTION_GAP + spacing.sm },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  goalCell: { width: '50%', paddingHorizontal: 5, paddingBottom: 10 },
  ringText: { ...typographyKit.metaSemibold, fontSize: 11 },
});

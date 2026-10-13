/**
 * Accueil — vue d'ensemble en un coup d'œil, au style de l'historique des transactions.
 *
 * 1. Patrimoine net (+ revenus / dépenses / épargne du mois)
 * 2. Budget du mois (une ligne, barre de progression)
 * 3. Prochain paiement (vedette + carrousel)
 * 4. Où va ton argent — top catégories du mois
 * 5. Objectifs d'épargne
 *
 * Les comptes vivent dans Portefeuille (pas de doublon ici).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AreaSparkline,
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
import { GoalsOverview, NextPayments, SpendingSnapshot } from '@/components/dashboard/HomeUpcoming';
import { TodayCard } from '@/components/dashboard/TodayCard';
import { WinsCard } from '@/components/dashboard/WinsCard';
import { CopilotWidget } from '@/components/copilot/CopilotCard';
import { PageTransition } from '@/components/PageTransition';
import {
  createNewGoalForm,
  SavingsGoalFormModal,
  saveSavingsGoalForm,
  type GoalForm,
} from '@/components/SavingsGoalsForm';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { FLOATING_NAV_CONTENT_PADDING, PAGE_PADDING_HORIZONTAL, spacing, typographyKit } from '@/constants/theme';
import { useAlertCenter, useAlertCenterSources } from '@/hooks/useAlertCenter';
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
import { buildHomeWins } from '@/lib/homeWins';
import { ensureDbReady } from '@/lib/init';
import { computeLoggingStreak } from '@/lib/loggingStreak';
import { buildRecurringBillsByDate } from '@/lib/protoAgendaBills';
import { buildGoalProgressions } from '@/lib/savingsGamification';
import { syncWithServer } from '@/lib/sync';
import { useAppTheme } from '@/lib/themeContext';
import { getUserDisplayName } from '@/lib/userDisplay';
import { readScreenCache, refreshScreenCache, writeScreenCache } from '@/lib/screenCache';
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

type HomeSnapshot = {
  displayName: string;
  accounts: SimulatedAccount[];
  goals: SavingsGoal[];
  dashboard: DashboardSummary | null;
  categoryBudgets: CategoryBudget[];
  recurringPayments: RecurringPayment[];
  trendTransactions: Transaction[];
  budgetCategories: BudgetCategoryUiModel[];
};

const HOME_CACHE_KEY = 'home';

async function fetchHomeSnapshot(): Promise<HomeSnapshot> {
  await ensureDbReady();
  await initializeCategories();
  const [name, accounts, goals, dashboard, categoryBudgets, recurringPayments, trendTransactions, monthCats] =
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
  return {
    displayName: name,
    accounts,
    goals,
    dashboard,
    categoryBudgets,
    recurringPayments,
    trendTransactions,
    budgetCategories: mapBudgetCategoriesToUi(monthCats),
  };
}

/** Boot preload — Accueil then opens with real data instead of an empty first frame. */
export function preloadHomeData(): Promise<unknown> {
  return refreshScreenCache(HOME_CACHE_KEY, fetchHomeSnapshot);
}

export function ProtoHomeHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const greeting = timeOfDayGreeting(new Date());
  // Start from the last snapshot (preloaded at boot) so the first frame is already right.
  const [cached] = useState(() => readScreenCache<HomeSnapshot>(HOME_CACHE_KEY));

  const [displayName, setDisplayName] = useState(cached?.displayName ?? '');
  const [accounts, setAccounts] = useState<SimulatedAccount[]>(cached?.accounts ?? []);
  const [goals, setGoals] = useState<SavingsGoal[]>(cached?.goals ?? []);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(cached?.dashboard ?? null);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>(cached?.categoryBudgets ?? []);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>(cached?.recurringPayments ?? []);
  const [trendTransactions, setTrendTransactions] = useState<Transaction[]>(cached?.trendTransactions ?? []);
  const [refreshing, setRefreshing] = useState(false);
  /** False until real data exists — the wins card waits so it never flashes an empty state. */
  const [hasLoaded, setHasLoaded] = useState(cached != null);

  const [goalForm, setGoalForm] = useState<GoalForm | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalFormFeedback, setGoalFormFeedback] = useState<FormFeedback | null>(null);

  const [budgetCategories, setBudgetCategories] = useState<BudgetCategoryUiModel[]>(cached?.budgetCategories ?? []);

  const load = useCallback(async () => {
    const snapshot = await refreshScreenCache(HOME_CACHE_KEY, fetchHomeSnapshot);
    writeScreenCache(HOME_CACHE_KEY, snapshot);
    setDisplayName(snapshot.displayName);
    setAccounts(snapshot.accounts);
    setGoals(snapshot.goals);
    setDashboard(snapshot.dashboard);
    setCategoryBudgets(snapshot.categoryBudgets);
    setBudgetCategories(snapshot.budgetCategories);
    setRecurringPayments(snapshot.recurringPayments);
    setTrendTransactions(snapshot.trendTransactions);
    setHasLoaded(true);
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

  /** The two goals closest to the finish line — the full list lives in Wallet. */
  const homeGoals = useMemo(
    () =>
      [...goalProgressions]
        .sort((a, b) => b.currentAmount / (b.targetAmount || 1) - a.currentAmount / (a.targetAmount || 1))
        .slice(0, 2),
    [goalProgressions],
  );

  const upcoming = useMemo(
    () => upcomingPaymentRows(recurringPayments, new Date()),
    [recurringPayments],
  );
  const goalTotals = useMemo(() => {
    const all = buildGoalProgressions(goals);
    return {
      saved: all.reduce((sum, goal) => sum + Math.min(goal.currentAmount, goal.targetAmount), 0),
      target: all.reduce((sum, goal) => sum + goal.targetAmount, 0),
      count: all.length,
      reached: all.filter((goal) => goal.completed).length,
    };
  }, [goals]);

  const alertSources = useAlertCenterSources();
  const { unreadCount: unreadAlerts } = useAlertCenter({
    recurringPayments: alertSources.recurringPayments,
    simulatedAccounts: alertSources.simulatedAccounts,
    incomeTransactions: alertSources.incomeTransactions,
    enabled: alertSources.ready,
  });

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

  // Accueil is encouraging, not alarming: dips are shown in neutral grey, never red.
  const trendColor = (netWorthPct ?? 0) >= 0 ? colors.accentGreen : colors.textMuted;
  const budgetRatio = budget.limit > 0 ? budget.spent / budget.limit : 0;
  const budgetPct = Math.round(budgetRatio * 100);
  const budgetColor = budgetPct <= 102 ? colors.accentGreen : '#F59E0B';

  const budgetedCount = budgetCategories.filter((b) => b.limit > 0).length;
  const budgetSubtitle =
    budget.over > 0
      ? `${budgetedCount - budget.over} catégorie${budgetedCount - budget.over > 1 ? 's' : ''} sur ${budgetedCount} dans le budget`
      : `${formatDisplayMoneyAbsolute(budget.spent)} sur ${formatDisplayMoneyAbsolute(budget.limit)}`;

  const homeWins = useMemo(() => {
    const streak = computeLoggingStreak(trendTransactions);
    return buildHomeWins({
      firstName: firstName(displayName),
      now: new Date(),
      streakDays: streak.days,
      loggedToday: streak.loggedToday,
      categories: budgetCategories,
      monthlyIncome,
      monthlyExpenses,
      netWorthUp: (netWorthPct ?? 0) > 0,
      goals: goalProgressions.map((g) => ({ name: g.name, saved: g.currentAmount, target: g.targetAmount })),
    });
  }, [budgetCategories, displayName, goalProgressions, monthlyExpenses, monthlyIncome, netWorthPct, trendTransactions]);

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
                <View>
                  <HeaderIconButton
                    icon="notifications-outline"
                    accessibilityLabel={
                      unreadAlerts > 0 ? `Ouvrir les messages, ${unreadAlerts} non lus` : 'Ouvrir les messages'
                    }
                    onPress={() => go('/alert-center')}
                  />
                  {unreadAlerts > 0 ? (
                    <View
                      pointerEvents="none"
                      style={[styles.bellBadge, { backgroundColor: colors.text, borderColor: colors.background }]}
                    >
                      <Text style={[styles.bellBadgeText, { color: colors.background }]}>{unreadAlerts > 9 ? '9+' : unreadAlerts}</Text>
                    </View>
                  ) : null}
                </View>
                <HeaderIconButton
                  icon="settings-outline"
                  accessibilityLabel="Ouvrir les réglages"
                  onPress={() => go('/settings')}
                />
              </>
            }
          />

          {/* Cold start: nothing but the title until real data is ready, then every section
              appears at once — no empty values, no late pop-in. Later visits use the cache. */}
          {hasLoaded ? (
            <>
              <Reveal index={0} style={styles.section}>
                <WinsCard wins={homeWins} />
              </Reveal>

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
                          : colors.textMuted,
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
              <CopilotWidget gentle />
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
                      <RingGauge progress={budgetRatio} color={budgetColor} size={48} stroke={4}>
                        <Text style={[styles.ringText, { color: colors.text }]}>
                          {`${Math.min(999, Math.round(budgetRatio * 100))}%`}
                        </Text>
                      </RingGauge>
                    }
                    title={
                      budget.remaining < 0
                        ? `${formatDisplayMoneyAbsolute(-budget.remaining)} au-delà du plan`
                        : `${signedMoney(budget.remaining)} restants`
                    }
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
              <SectionLabel title="Prochain paiement" actionLabel="Agenda" onAction={() => router.navigate('/goals')} />
              {upcoming.length === 0 ? (
                <ListCard>
                  <EmptyRow label="Rien à payer d’ici 45 jours" />
                </ListCard>
              ) : (
                <NextPayments
                  rows={upcoming}
                  onOpen={(row) =>
                    row?.bill.sourceId
                      ? router.push({ pathname: '/payment-detail', params: { id: row.bill.sourceId, date: row.dateKey } })
                      : router.navigate('/goals')
                  }
                />
              )}
            </Reveal>

            {budget.spent > 0 ? (
              <Reveal index={4} style={styles.section}>
                <SectionLabel
                  title="Où va ton argent"
                  actionLabel="Analyse"
                  onAction={() => go('/transactions-insights')}
                />
                <SpendingSnapshot
                  categories={budgetCategories}
                  onOpenCategory={(id) => router.push({ pathname: '/budget-category', params: { id } })}
                />
              </Reveal>
            ) : null}

            <Reveal index={5} style={styles.section}>
              <SectionLabel
                title="Objectifs"
                actionLabel={goalProgressions.length > 0 ? 'Tout voir' : 'Nouveau'}
                onAction={goalProgressions.length > 0 ? () => router.navigate('/accounts') : openNewGoalForm}
              />
              {goalTotals.count > 1 ? (
                <View style={styles.goalSummary}>
                  <GoalsOverview {...goalTotals} />
                </View>
              ) : null}
              {goalProgressions.length === 0 ? (
                <ListCard>
                  <EmptyRow label="Aucun objectif en cours" actionLabel="Créer" onAction={openNewGoalForm} />
                </ListCard>
              ) : (
                <View style={styles.goalGrid}>
                  {homeGoals.map((goal) => (
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
            </>
          ) : null}
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
  goalSummary: { marginBottom: 10 },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '700', lineHeight: 12 },
  ringText: { ...typographyKit.metaSemibold, fontSize: 11 },
});

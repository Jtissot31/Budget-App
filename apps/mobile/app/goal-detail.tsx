import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {

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

import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';

import { DetailSingleLineRow, type DetailSection } from '@/components/DetailSectionRows';

import { GlassContainer } from '@/components/GlassContainer';

import { SurfaceCard } from '@/components/SurfaceCard';

import { GoalProgressChart } from '@/components/GoalProgressChart';
import { SavingsGoalDetailGamification } from '@/components/goals/SavingsGoalDetailGamification';

import { OverflowMenuButton } from '@/components/OverflowMenuButton';

import { PageTransition } from '@/components/PageTransition';

import { SegmentedTabs } from '@/components/SegmentedTabs';

import { TransactionRow } from '@/components/TransactionRow';

import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';

import {

  accountDetailSectionDividerStyle,

  accountDetailStatementStatColStyle,

  accountDetailStatementStatLabelStyle,

  accountDetailStatementStatsRowStyle,

  accountDetailStatementStatValueStyle,

  detailProgressBarStyle,

  detailSectionFootnoteStyle,

  detailSectionLabelStyle,

  detailSectionsCardStyle,

  jakartaBoldText,

  jakartaExtraBoldText,

  jakartaMediumText,

  radius,

  spacing,

  typography,

} from '@/constants/theme';

import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';

import {

  deleteSavingsGoal,

  getCategoryBudgets,

  getDashboard,

  getRecurringPayments,

  getSavingsGoals,

  getSimulatedAccounts,

  getTransactionsForSavingsGoal,

  sortTransactionsNewestFirst,

} from '@/lib/db';

import { dataEvents } from '@/lib/events';

import {
  EMPTY_DETAIL_VALUE,
  formatDetailWeeklyAmount,
} from '@/lib/detailDisplay';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';

import type { FormFeedback } from '@/lib/formFeedback';

import {

  formatGoalDuration,

  formatGoalProjectionPercent,

  getGoalProjection,

  projectedCompletionLabel,

} from '@/lib/goalProjection';

import { tapHaptic, successHaptic } from '@/lib/haptics';
import { openTransactionDetail } from '@/lib/openTransactionDetail';

import { parseItemizedNote } from '@/lib/itemizedNote';

import {

  SavingsGoalFormModal,

  createGoalEditForm,

  saveSavingsGoalForm,

  type GoalForm,

} from '@/lib/savingsGoalsForm';

import { useAppTheme } from '@/lib/themeContext';

import { UNIFORM_SECTION_HEADER_MIN_HEIGHT } from '@/lib/uniformGroupStyles';

import {

  filterTransactionsByType,

  formatTransactionGroupDateLabel,

  groupTransactionsByDay,

  HISTORY_FILTER_OPTIONS,

  type HistoryTypeFilter,

  transactionMatchesSearch,

} from '@/lib/transactionListUtils';

import type { CategoryBudget, DashboardSummary, RecurringPayment, SavingsGoal, SimulatedAccount, Transaction } from '@/types';



function formatMoney(value: number) {

  return formatDisplayMoneyAbsolute(value);

}



function getTransactionTitle(tx: Transaction, fallbackTitle: string) {

  if (tx.type === 'transfer') return tx.label;



  const itemized = parseItemizedNote(tx.note);

  if (itemized.length === 0) return fallbackTitle;



  const names = itemized.slice(0, 2).map((item) => item.name);

  const suffix = itemized.length > names.length ? ` + ${itemized.length - names.length}` : '';

  return `${names.join(', ')}${suffix}`;

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



function FlowDivider() {

  const { isLight } = useAppTheme();

  return <View style={accountDetailSectionDividerStyle(isLight)} />;

}



function buildGoalDetailSections(

  goal: SavingsGoal,

  remaining: number,

  weeklyContributionLabel: string,

  targetDateLabel: string,

  plannedDates: string | null,

  projection: ReturnType<typeof getGoalProjection> | null,

  colors: { success: string },

): DetailSection[] {

  const objectifRows: DetailSection['rows'] = [

    {

      label: 'Cible',

      value: formatMoney(goal.targetAmount),

      icon: 'flag-outline',

    },

    {

      label: 'Épargné',

      value: formatMoney(goal.currentAmount),

      icon: 'wallet-outline',

    },

    {

      label: 'Montant restant',

      value: formatMoney(remaining),

      icon: 'hourglass-outline',

    },

    {

      label: 'Contribution hebdomadaire',

      value: weeklyContributionLabel,

      icon: 'add-circle-outline',

      valueColor:

        goal.weeklyContribution != null && goal.weeklyContribution > 0 ? colors.success : undefined,

    },

    {

      label: 'Date cible',

      value: targetDateLabel,

      icon: 'calendar-outline',

    },

    {

      label: 'Dates prévues',

      value: plannedDates ?? EMPTY_DETAIL_VALUE,

      icon: 'time-outline',

    },

  ];



  const sections: DetailSection[] = [{ title: 'Objectif', rows: objectifRows }];



  if (projection) {

    const projectionRows: DetailSection['rows'] = [

      {

        label: 'Progression',

        value: formatGoalProjectionPercent(projection.progress),

        icon: 'pie-chart-outline',

      },

      {

        label: 'Reste à épargner',

        value: formatMoney(projection.remaining),

        icon: 'wallet-outline',

      },

    ];



    if (projection.weeksToGoal != null) {

      projectionRows.push({

        label: 'Durée au rythme choisi',

        value: formatGoalDuration(projection.weeksToGoal),

        icon: 'time-outline',

      });

    }

    if (projection.requiredWeekly != null) {

      projectionRows.push({

        label: 'Requis par semaine',

        value: formatDetailWeeklyAmount(projection.requiredWeekly),

        icon: 'cash-outline',

      });

    }

    if (projection.targetDate != null) {

      projectionRows.push({

        label: "Date estimée d'atteinte",

        value: projection.targetDate,

        icon: 'calendar-outline',

      });

    }

    if (projection.monthlyContribution > 0) {

      projectionRows.push({

        label: 'Montant par mois',

        value: formatMoney(projection.monthlyContribution),

        icon: 'calendar-outline',

      });

    }

    if (projection.budgetUseRatio != null && projection.monthlyContribution > 0) {

      projectionRows.push({

        label: 'Part du budget',

        value: formatGoalProjectionPercent(projection.budgetUseRatio),

        icon: 'stats-chart-outline',

      });

    }

    if (projection.weeklyObligationsTotal > 0) {

      projectionRows.push({

        label: 'Obligations + objectif / semaine',

        value: formatDetailWeeklyAmount(projection.weeklyObligationsTotal),

        icon: 'list-outline',

      });

    }



    sections.push({ title: 'Projection', rows: projectionRows });

  }



  return sections;

}



export default function GoalDetailScreen() {

  const router = useRouter();

  const params = useLocalSearchParams<{ goalId?: string }>();

  const goalId = typeof params.goalId === 'string' ? params.goalId.trim() : '';

  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);

  const searchInputRef = useRef<TextInput>(null);

  const { colors, isLight } = useAppTheme();



  const [goal, setGoal] = useState<SavingsGoal | null>(null);

  const [goals, setGoals] = useState<SavingsGoal[]>([]);

  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);

  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);

  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);

  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');

  const [searchExpanded, setSearchExpanded] = useState(false);

  const [historyTypeFilter, setHistoryTypeFilter] = useState<HistoryTypeFilter>('all');

  const [historyFiltersExpanded, setHistoryFiltersExpanded] = useState(false);

  const [editForm, setEditForm] = useState<GoalForm | null>(null);

  const [savingEdit, setSavingEdit] = useState(false);

  const [editFormFeedback, setEditFormFeedback] = useState<FormFeedback | null>(null);

  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);



  const load = useCallback(async () => {

    if (!goalId) {

      setGoal(null);

      setGoals([]);

      setAccounts([]);

      setTransactions([]);

      setDashboard(null);

      setCategoryBudgets([]);

      setRecurringPayments([]);

      return;

    }



    const [

      nextGoals,

      nextAccounts,

      nextTransactions,

      nextDashboard,

      nextCategoryBudgets,

      nextRecurringPayments,

    ] = await Promise.all([

      getSavingsGoals(),

      getSimulatedAccounts(),

      getTransactionsForSavingsGoal(goalId),

      getDashboard(),

      getCategoryBudgets(),

      getRecurringPayments(),

    ]);



    setGoals(nextGoals);

    setAccounts(nextAccounts);

    setTransactions(sortTransactionsNewestFirst(nextTransactions));

    setDashboard(nextDashboard);

    setCategoryBudgets(nextCategoryBudgets);

    setRecurringPayments(nextRecurringPayments);

    setGoal(nextGoals.find((item) => item.id === goalId) ?? null);

  }, [goalId]);



  useEffect(() => {

    scrollRef.current?.scrollTo({ y: 0, animated: false });

    setSearch('');

    setSearchExpanded(false);

    void load();

  }, [goalId, load]);



  useEffect(() => {

    if (!searchExpanded) return;

    const timer = setTimeout(() => searchInputRef.current?.focus(), 50);

    return () => clearTimeout(timer);

  }, [searchExpanded]);



  useRefreshOnFocus(load);

  useEffect(() => dataEvents.subscribe(load), [load]);



  const remaining = useMemo(() => {

    if (!goal) return 0;

    return Math.max(0, goal.targetAmount - goal.currentAmount);

  }, [goal]);



  const progressPct = useMemo(() => {

    if (!goal || goal.targetAmount <= 0) return 0;

    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);

  }, [goal]);



  const plannedDates = useMemo(() => {

    if (!goal) return null;

    return projectedCompletionLabel(goal);

  }, [goal]);



  const projection = useMemo(() => {

    if (!goal) return null;

    return getGoalProjection(goal, dashboard, categoryBudgets, recurringPayments);

  }, [categoryBudgets, dashboard, goal, recurringPayments]);



  const weeklyContributionLabel = useMemo(() => {

    if (!goal) return EMPTY_DETAIL_VALUE;

    const weekly = goal.weeklyContribution ?? 0;

    if (weekly > 0) return formatDetailWeeklyAmount(weekly, { leadingPlus: true });

    return EMPTY_DETAIL_VALUE;

  }, [goal]);



  const targetDateLabel = useMemo(() => {

    if (!goal?.dueDate?.trim()) return EMPTY_DETAIL_VALUE;

    return goal.dueDate.trim();

  }, [goal]);



  const detailSections = useMemo(

    () =>

      goal

        ? buildGoalDetailSections(

            goal,

            remaining,

            weeklyContributionLabel,

            targetDateLabel,

            plannedDates,

            projection,

            colors,

          )

        : [],

    [colors, goal, plannedDates, projection, remaining, targetDateLabel, weeklyContributionLabel],

  );



  const detailFootnote = useMemo(() => {

    if (projection?.hint) return projection.hint;

    if (plannedDates) {

      return `Fin estimée · ${plannedDates}`;

    }

    if (!goal?.weeklyContribution) {

      return 'Projection disponible lorsque le rythme hebdomadaire est renseigné.';

    }

    return null;

  }, [goal?.weeklyContribution, plannedDates, projection?.hint]);



  const filteredTransactions = useMemo(() => {

    const searched = search.trim()

      ? transactions.filter((tx) => transactionMatchesSearch(tx, search))

      : transactions;

    return filterTransactionsByType(searched, historyTypeFilter);

  }, [historyTypeFilter, search, transactions]);



  const groupedTransactions = useMemo(

    () => groupTransactionsByDay(filteredTransactions),

    [filteredTransactions],

  );



  const historyHasActiveFilters = search.trim().length > 0 || historyTypeFilter !== 'all';



  const openEditForm = useCallback(() => {

    if (!goal) return;

    tapHaptic();

    setEditForm(createGoalEditForm(goal));

  }, [goal]);



  const closeEditForm = useCallback(() => {

    setEditForm(null);

    setEditFormFeedback(null);

  }, []);



  const saveEdit = useCallback(async () => {

    if (!editForm) return;

    setSavingEdit(true);

    try {

      const result = await saveSavingsGoalForm(editForm, isLight);

      if (result !== true) {

        setEditFormFeedback(result);

        return;

      }

      setEditFormFeedback(null);

      await load();

      setEditForm(null);

      successHaptic();

    } finally {

      setSavingEdit(false);

    }

  }, [editForm, isLight, load]);



  const confirmDelete = useCallback(() => {

    tapHaptic();

    setConfirmDeleteVisible(true);

  }, []);



  const handleConfirmDelete = useCallback(async () => {

    if (!goalId) return;

    setConfirmDeleteVisible(false);

    await deleteSavingsGoal(goalId);

    successHaptic();

    router.back();

  }, [goalId, router]);



  const collapseSearch = useCallback(() => {

    setSearch('');

    setSearchExpanded(false);

    searchInputRef.current?.blur();

  }, []);



  const expandSearch = useCallback(() => {

    tapHaptic();

    setSearchExpanded(true);

  }, []);



  const displayTitle = goal?.name ?? 'Objectif';

  const showProgressCard = goal != null && goal.targetAmount > 0;

  const progressBar = detailProgressBarStyle();

  const trackColor = isLight ? '#E8EDF3' : '#08090B';

  const progressFillColor = progressPct >= 100 ? colors.success : colors.primary;



  const progressCard = showProgressCard ? (

    <GlassContainer

      style={styles.progressCardShell}

      innerStyle={styles.progressCardInner}

      padding={spacing.lg}

      borderRadius={radius.lg}

    >

      <View style={styles.progressHeader}>

        <Text

          style={[styles.progressLabel, { color: colors.textMuted }]}

          numberOfLines={1}

          ellipsizeMode="tail"

        >

          Progression

        </Text>

        <Text style={[styles.progressPct, { color: progressFillColor }]} numberOfLines={1}>

          {progressPct.toFixed(0)} %

        </Text>

      </View>

      <View style={[progressBar.track, { backgroundColor: trackColor }]}>

        <View

          style={[

            progressBar.fill,

            {

              width: `${Math.max(progressPct, 3)}%`,

              backgroundColor: progressFillColor,

            },

          ]}

        />

      </View>

      <View style={styles.progressFooter}>

        <Text style={[styles.progressFootnote, { color: colors.textMuted }]}>

          Épargné · {formatMoney(goal!.currentAmount)}

        </Text>

        <Text style={[styles.progressFootnote, { color: colors.textMuted }]}>

          Cible · {formatMoney(goal!.targetAmount)}

        </Text>

      </View>

    </GlassContainer>

  ) : null;



  return (

    <PageTransition>

      <View style={[styles.screen, { backgroundColor: 'transparent' }]}>

        <View style={[styles.topBar, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.lg + spacing.md }]}>

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

            {displayTitle}

          </Text>

          {goal ? (

            <OverflowMenuButton

              accessibilityLabel="Options de l'objectif"

              items={[

                {

                  key: 'edit',

                  label: 'Modifier',

                  onPress: openEditForm,

                },

                {

                  key: 'delete',

                  label: 'Supprimer',

                  icon: 'trash-outline',

                  destructive: true,

                  onPress: confirmDelete,

                },

              ]}

            />

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

          {goal ? (

            <>

              <View style={styles.heroSection}>

                <SavingsGoalDetailGamification
                  goal={goal}
                  goals={goals}
                  transactions={transactions}
                  accounts={accounts}
                />

                <GoalProgressChart goal={goal} transactions={transactions} accounts={accounts} />

                <View style={[accountDetailStatementStatsRowStyle(), styles.statsRow]}>

                  <StatementStatColumn

                    label="Cible"

                    value={formatMoney(goal.targetAmount)}

                    align="left"

                  />

                  <StatementStatColumn

                    label="Épargné"

                    value={formatMoney(goal.currentAmount)}

                    align="center"

                    prominent

                  />

                  <StatementStatColumn

                    label="Montant restant"

                    value={formatMoney(remaining)}

                    align="right"

                  />

                </View>

              </View>



              {progressCard}



              <FlowDivider />



              <View style={styles.detailsSectionsStack}>

                {detailSections.map((section, sectionIndex) => (

                  <SurfaceCard

                    key={section.title}

                    style={detailSectionsCardStyle()}

                    padding={spacing.xl}

                  >

                    <Text style={[detailSectionLabelStyle(), { color: colors.text }]}>

                      {section.title}

                    </Text>

                    <View style={[styles.detailSectionRows, { borderTopColor: colors.border }]}>

                      {section.rows.map((row, rowIndex) => (

                        <DetailSingleLineRow

                          key={row.label}

                          row={row}

                          colors={colors}

                          isLast={rowIndex === section.rows.length - 1}

                          rowPaddingVertical={spacing.md}

                        />

                      ))}

                    </View>

                    {sectionIndex === detailSections.length - 1 && detailFootnote ? (

                      <Text style={[detailSectionFootnoteStyle(), { color: colors.textMuted }]}>

                        {detailFootnote}

                      </Text>

                    ) : null}

                  </SurfaceCard>

                ))}

              </View>



              <FlowDivider />



              <View style={styles.transactionList}>

                {searchExpanded ? (

                  <View style={[styles.searchRow, { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder }]}>

                    <Ionicons name="search-outline" size={18} color={colors.textMuted} />

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

                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />

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

                      <Ionicons

                        name={historyFiltersExpanded ? 'filter' : 'filter-outline'}

                        size={20}

                        color={historyTypeFilter !== 'all' ? colors.primary : colors.textMuted}

                      />

                    </Pressable>

                  </View>

                ) : (

                  <View style={styles.searchToolbarRow}>

                    <Pressable

                      accessibilityRole="button"

                      accessibilityLabel="Rechercher"

                      hitSlop={8}

                      onPress={expandSearch}

                      style={({ pressed }) => [

                        styles.searchIconBtn,

                        { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },

                        pressed && styles.pressed,

                      ]}

                    >

                      <Ionicons

                        name="search-outline"

                        size={20}

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

                        { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },

                        pressed && styles.pressed,

                      ]}

                    >

                      <Ionicons

                        name={historyFiltersExpanded ? 'filter' : 'filter-outline'}

                        size={20}

                        color={historyTypeFilter !== 'all' ? colors.primary : colors.textMuted}

                      />

                    </Pressable>

                  </View>

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



                {groupedTransactions.length > 0 ? (

                  groupedTransactions.map(([date, txs]) => (

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

                            transaction={{

                              ...tx,

                              label: getTransactionTitle(tx, tx.categoryName?.trim() || tx.label || goal.name),

                            }}

                            accounts={accounts}

                            onPress={() => {

                              tapHaptic();

                              openTransactionDetail(tx.id);

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

                      : 'Aucun dépôt ni transfert lié à cet objectif.'}

                  </Text>

                )}

              </View>

            </>

          ) : (

            <Text style={[styles.empty, { color: colors.textMuted }]}>

              {goalId ? 'Objectif introuvable.' : "Identifiant d'objectif manquant."}

            </Text>

          )}

        </ScrollView>



        <SavingsGoalFormModal

          form={editForm}

          setForm={setEditForm}

          goals={goals}

          dashboard={dashboard}

          categoryBudgets={categoryBudgets}

          recurringPayments={recurringPayments}

          saving={savingEdit}

          onDismiss={closeEditForm}

          onSave={saveEdit}

          feedback={editFormFeedback}

        />



        <ConfirmDeleteModal

          visible={confirmDeleteVisible}

          title="Supprimer l'objectif ?"

          message={

            goal

              ? `Supprimer ${goal.name} ? Les transactions existantes restent dans l'historique général.`

              : 'Cette action est irréversible.'

          }

          onConfirm={() => void handleConfirmDelete()}

          onCancel={() => setConfirmDeleteVisible(false)}

        />

      </View>

    </PageTransition>

  );

}



const styles = StyleSheet.create({

  screen: { flex: 1, backgroundColor: 'transparent' },

  topBar: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    paddingHorizontal: spacing.lg,

    paddingBottom: spacing.lg,

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

    ...jakartaExtraBoldText,

    fontSize: typography.body,

    letterSpacing: -0.2,

  },

  topBarSpacer: { width: 38 },

  content: {

    paddingHorizontal: spacing.lg,

    gap: spacing.xl,

  },

  heroSection: {

    gap: spacing.lg,

  },

  statsRow: {

    paddingTop: spacing.md,

  },

  detailsSectionsStack: {

    gap: spacing.lg,

  },

  detailSectionRows: {

    borderTopWidth: StyleSheet.hairlineWidth,

  },

  pressed: { opacity: 0.78 },

  progressCardShell: {

    borderRadius: radius.lg,

  },

  progressCardInner: {

    gap: spacing.md,

  },

  progressHeader: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    gap: spacing.sm,

  },

  progressLabel: {

    ...jakartaBoldText,

    flex: 1,

    flexShrink: 1,

    minWidth: 0,

    fontSize: typography.micro,

    letterSpacing: 0.6,

    textTransform: 'uppercase',

  },

  progressPct: {

    ...jakartaBoldText,

    flexShrink: 0,

    minWidth: 44,

    textAlign: 'right',

    fontSize: typography.meta,

  },

  progressFooter: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    gap: spacing.md,

  },

  progressFootnote: {

    ...jakartaMediumText,

    fontSize: typography.meta,

  },

  transactionList: {

    gap: spacing.lg,

    paddingTop: spacing.sm,

  },

  searchToolbarRow: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'flex-end',

    gap: spacing.sm,

    minHeight: 44,

  },

  searchIconBtn: {

    width: 44,

    height: 44,

    borderRadius: radius.card,

    borderWidth: 1,

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

    marginBottom: spacing.md,

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

    marginBottom: spacing.lg,

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

});



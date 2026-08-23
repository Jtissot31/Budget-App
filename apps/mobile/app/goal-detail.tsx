import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {

  RefreshControl,

  ScrollView,

  StyleSheet,

  Text,


  View,

} from 'react-native';


import { useLocalSearchParams, useRouter } from 'expo-router';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';

import { DetailSectionsList, type DetailSection } from '@/components/DetailSectionRows';

import {
  FixedScreenHeader,
  fixedHeaderScrollStyle,
  fixedHeaderScreenStyle,
} from '@/components/FixedScreenHeader';

import { OnyxContainer } from '@/components/OnyxContainer';

import { GoalProgressChart } from '@/components/GoalProgressChart';
import { SavingsGoalDetailGamification } from '@/components/goals/SavingsGoalDetailGamification';
import { planDetailFonts } from '@/components/plans/planDetailTheme';

import { OverflowMenuButton } from '@/components/OverflowMenuButton';

import { PageTransition } from '@/components/PageTransition';



import { ONYX_CONTAINER } from '@/constants/planFinanceKit';

import {

  accountDetailSectionDividerStyle,

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

import { EMPTY_DETAIL_VALUE } from '@/lib/detailDisplay';
import {
  fromWeeklyContributionAmount,
  savingsGoalContributionFrequencyLabel,
  type SavingsGoalContributionFrequency,
} from '@/lib/savingsGoalContribution';
import { formatDisplayMoneyAbsolute, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import { formatFriendlyDateLabel } from '@/lib/formatFriendlyDateLabel';

import type { FormFeedback } from '@/lib/formFeedback';

import {

  formatGoalDurationAtPace,

  formatGoalProjectionPercent,

  getGoalProjection,

  projectedCompletionLabel,

} from '@/lib/goalProjection';

import { tapHaptic, successHaptic } from '@/lib/haptics';


import {

  SavingsGoalFormModal,

  createGoalEditForm,

  saveSavingsGoalForm,

  type GoalForm,

} from '@/lib/savingsGoalsForm';

import { useAppTheme } from '@/lib/themeContext';



import type { CategoryBudget, DashboardSummary, RecurringPayment, SavingsGoal, SimulatedAccount, Transaction } from '@/types';



function formatMoney(value: number) {

  return formatDisplayMoneyAbsolute(value);

}





function FlowDivider() {

  const { isLight } = useAppTheme();

  return <View style={accountDetailSectionDividerStyle(isLight)} />;

}



function buildGoalDetailSections(

  goal: SavingsGoal,

  remaining: number,

  weeklyContributionLabel: string,
  contributionRowLabel: string,

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

  ];



  if (projection) {

    objectifRows.push({

      label: 'Progression',

      value: formatGoalProjectionPercent(projection.progress),

      icon: 'pie-chart-outline',

    });

  }



  objectifRows.push(

    {

      label: 'Montant restant',

      value: formatMoney(remaining),

      icon: 'hourglass-outline',

    },

    {

      label: contributionRowLabel,

      value: weeklyContributionLabel,

      icon: 'add-circle-outline',

      valueColor:

        goal.weeklyContribution != null && goal.weeklyContribution > 0 ? colors.success : undefined,

    },

  );



  if (projection?.weeksToGoal != null) {

    objectifRows.push({

      label: 'Durée à ce rythme',

      value: formatGoalDurationAtPace(projection.weeksToGoal * 7),

      icon: 'time-outline',

    });

  }



  if (projection?.budgetUseRatio != null && projection.monthlyContribution > 0) {

    objectifRows.push({

      label: 'Part du budget',

      value: formatGoalProjectionPercent(projection.budgetUseRatio),

      icon: 'stats-chart-outline',

    });

  }



  objectifRows.push(

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

  );



  return [{ title: 'Objectif', rows: objectifRows }];

}



export default function GoalDetailScreen() {

  const router = useRouter();

  const params = useLocalSearchParams<{ goalId?: string }>();

  const goalId = typeof params.goalId === 'string' ? params.goalId.trim() : '';

  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);

  const { colors, isLight } = useAppTheme();



  const [goal, setGoal] = useState<SavingsGoal | null>(null);

  const [goals, setGoals] = useState<SavingsGoal[]>([]);

  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);

  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);

  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);

  const [refreshing, setRefreshing] = useState(false);

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

    void load();

  }, [goalId, load]);





  useRefreshOnFocus(load);

  useEffect(() => dataEvents.subscribe(load), [load]);



  const remaining = useMemo(() => {

    if (!goal) return 0;

    return Math.max(0, goal.targetAmount - goal.currentAmount);

  }, [goal]);



  const plannedDates = useMemo(() => {

    if (!goal) return null;

    const label = projectedCompletionLabel(goal);

    if (!label) return null;

    if (label === 'Objectif atteint') return label;

    return formatFriendlyDateLabel(label, 'fr-FR');

  }, [goal]);



  const projection = useMemo(() => {

    if (!goal) return null;

    return getGoalProjection(goal, dashboard, categoryBudgets, recurringPayments);

  }, [categoryBudgets, dashboard, goal, recurringPayments]);



  const contributionRowLabel = useMemo(() => {
    if (!goal) return 'Versement';
    return `Versement · ${savingsGoalContributionFrequencyLabel(goal.contributionFrequency as SavingsGoalContributionFrequency | undefined)}`;
  }, [goal]);

  const weeklyContributionLabel = useMemo(() => {
    if (!goal) return EMPTY_DETAIL_VALUE;
    const weekly = goal.weeklyContribution ?? 0;
    if (weekly <= 0) return EMPTY_DETAIL_VALUE;
    const frequency = (goal.contributionFrequency ?? 'weekly') as SavingsGoalContributionFrequency;
    const amount = fromWeeklyContributionAmount(weekly, frequency);
    return formatSignedDisplayMoney(amount, { leadingPlusWhenPositive: true });
  }, [goal]);



  const targetDateLabel = useMemo(() => {

    if (!goal?.dueDate?.trim()) return EMPTY_DETAIL_VALUE;

    return formatFriendlyDateLabel(goal.dueDate.trim(), 'fr-FR');

  }, [goal]);



  const detailSections = useMemo(

    () =>

      goal

        ? buildGoalDetailSections(

            goal,

            remaining,

            weeklyContributionLabel,
            contributionRowLabel,
            targetDateLabel,

            plannedDates,

            projection,

            colors,

          )

        : [],

    [colors, contributionRowLabel, goal, plannedDates, projection, remaining, targetDateLabel, weeklyContributionLabel],

  );



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



  const displayTitle = goal?.name ?? 'Objectif';

  return (

    <PageTransition>

      <View style={[fixedHeaderScreenStyle, styles.screen, { backgroundColor: colors.background }]}>

        <FixedScreenHeader
          title={displayTitle}
          onBack={() => router.back()}
          trailing={
            goal ? (
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
            ) : undefined
          }
        />

        <ScrollView
          ref={scrollRef}
          style={fixedHeaderScrollStyle}
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

                <SavingsGoalDetailGamification goal={goal} />

                <View style={styles.chartSection}>
                  <Text style={[planDetailFonts.sectionCaps, { color: colors.textMuted }]}>
                    ÉVOLUTION
                  </Text>
                  <GoalProgressChart
                    goal={goal}
                    transactions={transactions}
                    accounts={accounts}
                    showAmountHero={false}
                  />
                </View>

              </View>



              <FlowDivider />



              <View style={styles.detailsSectionsStack}>

                {detailSections.length > 0 ? (
                  <OnyxContainer style={[styles.detailsCard, { padding: ONYX_CONTAINER.padding.card }]}>
                    <DetailSectionsList
                      sections={detailSections}
                      colors={colors}
                      rowPaddingVertical={spacing.md}
                    />
                  </OnyxContainer>
                ) : null}

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

  content: {

    paddingHorizontal: spacing.lg,

    gap: spacing.xl,

  },

  heroSection: {

    gap: spacing.xxl,

  },

  chartSection: {

    gap: spacing.md,

  },

  detailsSectionsStack: {

    gap: spacing.lg,

  },

  detailsCard: {

    alignSelf: 'stretch',

  },

  empty: {

    fontSize: typography.caption,

    lineHeight: 20,

    textAlign: 'center',

    paddingVertical: spacing.lg,

  },

});



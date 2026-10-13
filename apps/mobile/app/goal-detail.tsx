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

import {
  FixedScreenHeader,
  fixedHeaderScrollStyle,
  fixedHeaderScreenStyle,
} from '@/components/FixedScreenHeader';

import { OverflowMenuButton } from '@/components/OverflowMenuButton';
import { PageTransition } from '@/components/PageTransition';
import { GoalDetailBody } from '@/components/goals/GoalDetailBody';

import { spacing, typography } from '@/constants/theme';
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

import type { FormFeedback } from '@/lib/formFeedback';
import { getGoalProjection } from '@/lib/goalProjection';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import {
  SavingsGoalFormModal,
  createGoalEditForm,
  saveSavingsGoalForm,
  type GoalForm,
} from '@/lib/savingsGoalsForm';
import { useAppTheme } from '@/lib/themeContext';
import type { CategoryBudget, DashboardSummary, RecurringPayment, SavingsGoal, SimulatedAccount, Transaction } from '@/types';
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
  const projection = useMemo(() => {
    if (!goal) return null;
    return getGoalProjection(goal, dashboard, categoryBudgets, recurringPayments);
  }, [categoryBudgets, dashboard, goal, recurringPayments]);
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
            <GoalDetailBody
              goal={goal}
              projection={projection}
              transactions={transactions}
              accounts={accounts}
              onEdit={openEditForm}
            />
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
  empty: {
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});

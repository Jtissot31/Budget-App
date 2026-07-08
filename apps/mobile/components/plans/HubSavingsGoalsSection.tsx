import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HubSectionHeader } from '@/components/plans/HubSectionHeader';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import {
  createNewGoalForm,
  createNewGoalFormFromSuggestion,
  SavingsGoalFormModal,
  saveSavingsGoalForm,
  type GoalForm,
  type NewGoalFormSuggestion,
} from '@/components/SavingsGoalsForm';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { floatingGlassButtonPressed } from '@/constants/floatingGlassButton';
import { moneyAmountTypography, radius, spacing, typographyKit } from '@/constants/theme';
import { getCategoryBudgets, getDashboard, getRecurringPayments, getSavingsGoals } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import type { FormFeedback } from '@/lib/formFeedback';
import { isFormSaveSuccess } from '@/lib/formFeedback';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { buildGoalProgressions, type GoalProgressionSnapshot } from '@/lib/savingsGamification';
import { useAppTheme } from '@/lib/themeContext';
import type { CategoryBudget, DashboardSummary, RecurringPayment, SavingsGoal } from '@/types';

const PREVIEW_LIMIT = 4;

type SavingsGoalSuggestion = NewGoalFormSuggestion & {
  icon: string;
  hint: string;
};

const SAVINGS_GOAL_SUGGESTIONS: readonly SavingsGoalSuggestion[] = [
  { name: "Fonds d'urgence", targetAmount: 5000, icon: 'shield-check-outline', hint: '3 mois de dépenses' },
  { name: 'Vacances', targetAmount: 2500, icon: 'airplane-outline', hint: 'Prochain voyage' },
  { name: 'Mise de côté', targetAmount: 1000, icon: 'cash-outline', hint: 'Épargne flexible' },
  { name: 'Achat important', targetAmount: 3000, icon: 'diamond-outline', hint: 'Projet ou équipement' },
];

function goalRowHint(goal: GoalProgressionSnapshot): string {
  if (goal.completed) return 'Objectif atteint';
  return `${goal.pct} %`;
}

export function HubSavingsGoalsSection() {
  const router = useRouter();
  const { colors, isLight } = useAppTheme();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [goalForm, setGoalForm] = useState<GoalForm | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalFormFeedback, setGoalFormFeedback] = useState<FormFeedback | null>(null);

  const load = useCallback(async () => {
    const [nextGoals, nextDashboard, nextCategoryBudgets, nextRecurringPayments] = await Promise.all([
      getSavingsGoals(),
      getDashboard(),
      getCategoryBudgets(),
      getRecurringPayments(),
    ]);
    setGoals(nextGoals);
    setDashboard(nextDashboard);
    setCategoryBudgets(nextCategoryBudgets);
    setRecurringPayments(nextRecurringPayments);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);

  const goalProgressions = useMemo(() => buildGoalProgressions(goals), [goals]);
  const previewGoals = goalProgressions.slice(0, PREVIEW_LIMIT);
  const hasMore = goalProgressions.length > PREVIEW_LIMIT;

  const openGoal = useCallback(
    (goalId: string) => {
      tapHaptic();
      router.push({ pathname: '/goal-detail', params: { goalId } });
    },
    [router],
  );

  const openAllGoals = useCallback(() => {
    tapHaptic();
    router.push('/savings-goals');
  }, [router]);

  const openNewGoalForm = useCallback(() => {
    tapHaptic();
    setGoalFormFeedback(null);
    setGoalForm(createNewGoalForm());
  }, []);

  const openSuggestedGoalForm = useCallback((suggestion: NewGoalFormSuggestion) => {
    tapHaptic();
    setGoalFormFeedback(null);
    setGoalForm(createNewGoalFormFromSuggestion(suggestion));
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
        await load();
        return;
      }
      setGoalFormFeedback(result);
    } finally {
      setSavingGoal(false);
    }
  }, [closeGoalForm, goalForm, isLight, load]);

  return (
    <View style={styles.section}>
      <HubSectionHeader eyebrow="Épargne" title={"Mes objectifs d'épargne"} />

      {goalProgressions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Aucun objectif pour l&apos;instant.
          </Text>
          <View style={styles.suggestionsBlock}>
            <Text style={[styles.suggestionsLabel, { color: colors.textMuted }]}>Suggestions</Text>
            <View style={styles.cardList}>
              {SAVINGS_GOAL_SUGGESTIONS.map((suggestion) => (
                <Pressable
                  key={suggestion.name}
                  accessibilityRole="button"
                  accessibilityLabel={`Créer l'objectif ${suggestion.name}`}
                  onPress={() => openSuggestedGoalForm(suggestion)}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <PlanFinanceContainer style={styles.suggestionRow}>
                    <UserPickedIconWell icon={suggestion.icon} size={44} wellGlyphWhite noBackground />
                    <View style={styles.suggestionCopy}>
                      <Text style={[styles.suggestionHint, { color: colors.textMuted }]} numberOfLines={1}>
                        {suggestion.hint}
                      </Text>
                      <Text style={[styles.suggestionName, { color: colors.text }]} numberOfLines={2}>
                        {suggestion.name}
                      </Text>
                    </View>
                    {suggestion.targetAmount != null ? (
                      <Text
                        style={[styles.suggestionAmount, moneyAmountTypography({ tier: 'row' }), { color: colors.text }]}
                      >
                        {formatDisplayMoneyAbsolute(suggestion.targetAmount)}
                      </Text>
                    ) : null}
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </PlanFinanceContainer>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.cardList}>
          {previewGoals.map((goal) => (
            <Pressable
              key={goal.goalId}
              accessibilityRole="button"
              accessibilityLabel={`Voir l'objectif ${goal.name}`}
              onPress={() => openGoal(goal.goalId)}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <PlanFinanceContainer style={styles.suggestionRow}>
                <UserPickedIconWell icon={goal.icon} size={44} wellGlyphWhite noBackground />
                <View style={styles.suggestionCopy}>
                  <Text style={[styles.suggestionHint, { color: colors.textMuted }]} numberOfLines={1}>
                    {goalRowHint(goal)}
                  </Text>
                  <Text style={[styles.suggestionName, { color: colors.text }]} numberOfLines={2}>
                    {goal.name}
                  </Text>
                </View>
                <Text
                  style={[styles.suggestionAmount, moneyAmountTypography({ tier: 'row' }), { color: colors.text }]}
                >
                  {formatDisplayMoneyAbsolute(goal.currentAmount)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </PlanFinanceContainer>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        {hasMore ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voir tous les objectifs d'épargne"
            onPress={openAllGoals}
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          >
            <Text style={[styles.linkLabel, { color: colors.textSecondary }]}>Voir tous les objectifs</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajouter un objectif d'épargne"
          onPress={openNewGoalForm}
          style={({ pressed }) => [
            styles.addCta,
            {
              backgroundColor: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 18, 18, 0.92)',
              borderColor: colors.borderStrong,
            },
            pressed && floatingGlassButtonPressed,
          ]}
        >
          <Ionicons name="add" size={18} color={colors.textSecondary} />
          <Text style={[styles.addCtaLabel, { color: colors.text }]}>Ajouter</Text>
        </Pressable>
      </View>

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
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  cardList: {
    gap: spacing.sm,
  },
  emptyState: {
    gap: spacing.md,
  },
  emptyText: {
    ...typographyKit.body,
    lineHeight: 22,
  },
  suggestionsBlock: {
    gap: spacing.sm,
  },
  suggestionsLabel: {
    ...typographyKit.caption,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.md,
    padding: spacing.md,
  },
  suggestionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  suggestionHint: {
    ...typographyKit.caption,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  suggestionName: {
    ...typographyKit.rowTitle,
  },
  suggestionAmount: {
    flexShrink: 0,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 36,
  },
  linkLabel: {
    ...typographyKit.caption,
  },
  addCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addCtaLabel: {
    ...typographyKit.caption,
  },
  pressed: {
    opacity: 0.82,
  },
});

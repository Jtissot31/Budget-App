import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HubSectionHeader, HUB_SECTION_INNER_GAP } from '@/components/plans/HubSectionHeader';
import { SavingsGoalHubRow } from '@/components/plans/SavingsGoalHubRow';
import {
  createNewGoalForm,
  createNewGoalFormFromSuggestion,
  SavingsGoalFormModal,
  saveSavingsGoalForm,
  type GoalForm,
  type NewGoalFormSuggestion,
} from '@/components/SavingsGoalsForm';
import { OnyxContainer } from '@/components/OnyxContainer';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import { spacing, typographyKit } from '@/constants/theme';
import { getCategoryBudgets, getDashboard, getRecurringPayments, getSavingsGoals } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import type { FormFeedback } from '@/lib/formFeedback';
import { isFormSaveSuccess } from '@/lib/formFeedback';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { formatSavingsGoalHubRowCopy } from '@/lib/savingsGoalPresentation';
import { buildGoalProgressions } from '@/lib/savingsGamification';
import { useAppTheme } from '@/lib/themeContext';
import type { CategoryBudget, DashboardSummary, RecurringPayment, SavingsGoal } from '@/types';

const PREVIEW_LIMIT = 4;
const SUGGESTION_ICON_SIZE = 40;

type SavingsGoalSuggestion = NewGoalFormSuggestion & {
  icon: string;
};

const SAVINGS_GOAL_SUGGESTIONS: readonly SavingsGoalSuggestion[] = [
  { name: "Fonds d'urgence", targetAmount: 5000, icon: 'shield-check-outline' },
  { name: 'Vacances', targetAmount: 2500, icon: 'airplane-outline' },
  { name: 'Mise de côté', targetAmount: 1000, icon: 'cash-outline' },
  { name: 'Achat important', targetAmount: 3000, icon: 'diamond-outline' },
];

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
      <HubSectionHeader eyebrow="Épargne" title="Objectifs d'épargne" accentEyebrow />

      {goalProgressions.length === 0 ? (
        <View style={styles.cardList}>
          {SAVINGS_GOAL_SUGGESTIONS.map((suggestion) => (
            <Pressable
              key={suggestion.name}
              accessibilityRole="button"
              accessibilityLabel={`Créer l'objectif ${suggestion.name}`}
              onPress={() => openSuggestedGoalForm(suggestion)}
              style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
            >
              <OnyxContainer style={styles.suggestionRow}>
                <UserPickedIconWell
                  icon={suggestion.icon}
                  size={SUGGESTION_ICON_SIZE}
                  wellGlyphWhite
                  noBackground
                />
                <Text
                  style={[styles.suggestionTitle, typographyKit.rowTitle, { color: colors.text }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {suggestion.name}
                </Text>
                <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
              </OnyxContainer>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.cardList}>
          {previewGoals.map((goal) => {
            const { title, meta } = formatSavingsGoalHubRowCopy(goal);
            return (
              <SavingsGoalHubRow
                key={goal.goalId}
                icon={goal.icon}
                title={title}
                meta={meta}
                amount={formatDisplayMoneyAbsolute(goal.currentAmount)}
                accessibilityLabel={`Voir l'objectif ${goal.name}`}
                onPress={() => openGoal(goal.goalId)}
              />
            );
          })}
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
            <Text style={[styles.linkLabel, { color: colors.textSecondary }]}>
              Voir tous les objectifs
            </Text>
            <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajouter un objectif d'épargne"
          onPress={openNewGoalForm}
          style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
        >
          <OnyxContainer style={styles.addCta}>
            <View style={[styles.addIconWell, { backgroundColor: colors.input }]}>
              <AppIcon
                family="ionicons"
                name="add"
                size={18}
                color={colors.accentGreen || colors.primary}
              />
            </View>
            <Text style={[styles.addLabel, typographyKit.rowTitle, { color: colors.text }]}>
              Ajouter un objectif
            </Text>
            <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
          </OnyxContainer>
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
    gap: HUB_SECTION_INNER_GAP,
  },
  cardList: {
    gap: ONYX_CONTAINER.listGap,
  },
  suggestionRow: onyxContainerRowLayoutStyle(),
  suggestionTitle: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    gap: spacing.sm,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 40,
  },
  linkLabel: {
    ...typographyKit.bodyMedium,
  },
  addCta: {
    ...onyxContainerRowLayoutStyle(),
    minHeight: 56,
  },
  addIconWell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addLabel: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});

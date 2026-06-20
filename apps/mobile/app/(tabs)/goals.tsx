import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { PageTransition } from '@/components/PageTransition';
import { MdiIcon } from '@/components/MdiIcon';
import { GoalProgressFill } from '@/components/GoalProgressFill';
import { SavingsGoalsProgressHub } from '@/components/goals/SavingsGoalsProgressHub';
import { floatingGlassButtonPressed } from '@/constants/floatingGlassButton';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import type { IconName } from '@/constants/categoryOptions';
import {
  detailProgressBarStyle,
  FLOATING_NAV_CONTENT_PADDING,
  getGoalGreenShade,
  GOAL_PROGRESS_FILL,
  goalProgressTrackColor,
  interBoldText,
  interExtraBoldText,
  PAGE_PADDING_HORIZONTAL,
  PORTFOLIO_SECTION_GAP,
  radius,
  SECTION_TITLE_STYLE,
  spacing,
  typography,
} from '@/constants/theme';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import {
  getCategoryBudgets,
  getDashboard,
  getRecurringPayments,
  getSavingsGoals,
  getSimulatedAccounts,
  getTransactions,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { resolveMdiOrLegacyIcon, resolveStoredIconToMdi } from '@/lib/mdiIconCatalog';
import { savingsGoalIncrementalProgress } from '@/lib/savingsGoalProgress';
import { portfolioNumericText, rowLabel, rowTitleTextProps, rowValue, singleLineAmountProps } from '@/lib/textLayout';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { FormFeedback } from '@/lib/formFeedback';
import type {
  CategoryBudget,
  DashboardSummary,
  RecurringPayment,
  SavingsGoal,
  SimulatedAccount,
  Transaction,
} from '@/types';
import {
  SavingsGoalFormModal,
  createNewGoalForm,
  saveSavingsGoalForm,
  type GoalForm,
} from '@/lib/savingsGoalsForm';

const GOALS_PAGE_PADDING = PAGE_PADDING_HORIZONTAL;
const GOAL_CARD_ICON_SIZE = 20;

function formatMoney(value: number) {
  return formatDisplayMoneyAbsolute(value);
}

function formatGoalPaceEstimate(weeks: number): string {
  if (weeks < 8) {
    return `~${weeks} semaine${weeks > 1 ? 's' : ''} à ce rythme`;
  }
  const months = Math.max(1, Math.round(weeks / 4.33));
  return `~${months} mois à ce rythme`;
}

function GoalCardOutlineIcon({ icon, color }: { icon: string; color: string }) {
  const mdiName = resolveStoredIconToMdi(icon) ?? resolveMdiOrLegacyIcon(icon);
  const isMdi = resolveStoredIconToMdi(icon) != null;

  return (
    <View style={styles.goalCardIconSlot}>
      {isMdi ? (
        <MdiIcon name={mdiName} size={GOAL_CARD_ICON_SIZE} color={color} />
      ) : (
        <Ionicons name={icon as IconName} size={GOAL_CARD_ICON_SIZE} color={color} />
      )}
    </View>
  );
}

function GoalsPageTitle() {
  const { colors: themeColors } = useAppTheme();

  return (
    <Text style={[styles.pageTitle, styles.goalsHeaderTitle, { color: themeColors.text }]}>Objectifs</Text>
  );
}

export default function GoalsHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors, ghost, isLight } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const skipScrollOnceRef = useRef(false);
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
  const loadInFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    try {
      const [nextGoals, nextAccounts, nextTransactions, nextDashboard, nextCategoryBudgets, nextRecurringPayments] =
        await Promise.all([
          getSavingsGoals(),
          getSimulatedAccounts(),
          getTransactions(),
          getDashboard(),
          getCategoryBudgets(),
          getRecurringPayments(),
        ]);
      setGoals(nextGoals);
      setAccounts(nextAccounts);
      setTransactions(nextTransactions);
      setDashboard(nextDashboard);
      setCategoryBudgets(nextCategoryBudgets);
      setRecurringPayments(nextRecurringPayments);
    } finally {
      loadInFlightRef.current = false;
    }
  }, []);

  useRefreshOnFocus(load);
  useEffect(() => dataEvents.subscribe(load), [load]);

  useScrollToTopOnFocus(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
    skipScrollOnceRef,
  );

  const textColor = themeColors.text;
  const mutedTextColor = isLight ? themeColors.textMuted : '#909090';
  const goalProgressTrack = goalProgressTrackColor(isLight);
  const handleOpenNewGoal = useCallback(() => {
    skipScrollOnceRef.current = true;
    tapHaptic();
    setEditForm(createNewGoalForm());
  }, []);

  const handleOpenDetail = useCallback((goalId: string) => {
    tapHaptic();
    router.push({ pathname: '/goal-detail', params: { goalId } });
  }, [router]);

  const handleCloseEdit = useCallback(() => {
    setEditForm(null);
    setEditFormFeedback(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
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

  return (
    <PageTransition>
    <View style={[styles.screen, { backgroundColor: themeColors.background }]}>
      <ScrollView
        ref={scrollRef}
        style={[styles.screen, { backgroundColor: themeColors.background }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + SCREEN_TOP_GUTTER,
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + 96,
          },
        ]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={themeColors.primary}
          />
        }
      >
        <View style={styles.goalsHeroBlock}>
          <GoalsPageTitle />
        </View>

        {goals.length === 0 ? (
              <View style={styles.goalsEmptySection}>
                <DashboardCard innerStyle={styles.emptyCardInner} padding={spacing.lg}>
                <Ionicons name="flag-outline" size={32} color={mutedTextColor} />
                <Text style={[styles.emptyTitle, { color: textColor }]}>Aucun objectif</Text>
                <Text style={[styles.emptyHint, { color: mutedTextColor }]}>
                  Crée un objectif pour voir graphiques et projections ici.
                </Text>
                <Pressable
                  onPress={handleOpenNewGoal}
                  style={({ pressed }) => [
                    styles.emptyCta,
                    { backgroundColor: themeColors.text },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.emptyCtaText, { color: ghost.void }]}>Ajouter un objectif</Text>
                </Pressable>
                </DashboardCard>
              </View>
            ) : (
              <View style={styles.goalCardList}>
                <SavingsGoalsProgressHub
                  goals={goals}
                  transactions={transactions}
                  accounts={accounts}
                  onGoalPress={handleOpenDetail}
                />

                <View style={styles.goalsListSection}>
                  <View style={styles.goalsListHeader}>
                    <View style={styles.goalsListTitleGroup}>
                      <DashboardSectionLabel style={styles.goalsListEyebrow}>Progression</DashboardSectionLabel>
                      <Text style={[styles.goalsListTitle, { color: textColor }]}>Mes objectifs</Text>
                    </View>
                    <View style={[styles.goalsCountBadge, { backgroundColor: themeColors.surfaceElevated }]}>
                      <Text style={[styles.goalsCountBadgeLabel, { color: mutedTextColor }]}>
                        {goals.length}
                      </Text>
                    </View>
                  </View>

                <View style={styles.goalCards}>
                {goals.map((goal) => {
                  const progress = savingsGoalIncrementalProgress(goal);
                  const pct = Math.round(progress * 100);
                  const goalAccent = getGoalGreenShade(goal.id, isLight);
                  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
                  const weekly = goal.weeklyContribution ?? 0;
                  const weeksRemaining =
                    weekly > 0 && remaining > 0 ? Math.ceil(remaining / weekly) : null;
                  const paceEstimate =
                    pct >= 100 || weeksRemaining == null
                      ? null
                      : formatGoalPaceEstimate(weeksRemaining);
                  const progressBar = detailProgressBarStyle();
                  const showFooter = weekly > 0 || paceEstimate != null;

                  return (
                    <Pressable
                      key={goal.id}
                      android_ripple={null}
                      onPress={() => handleOpenDetail(goal.id)}
                    >
                      <DashboardCard innerStyle={styles.goalCardInner} padding={0}>
                        <View style={styles.goalCardTop}>
                          <View style={styles.goalTitleBlock}>
                            <GoalCardOutlineIcon
                              icon={goal.icon || 'flag-outline'}
                              color={goalAccent}
                            />
                            <Text style={[styles.goalName, { color: textColor }]} {...rowTitleTextProps}>
                              {goal.name}
                            </Text>
                          </View>
                          <View style={styles.goalAmountBlock}>
                            <Text
                              style={[styles.savedHero, { color: textColor }]}
                              {...singleLineAmountProps}
                            >
                              {formatMoney(goal.currentAmount)}
                              <Text style={[styles.savedTarget, { color: mutedTextColor }]}>
                                {' '}/ {formatMoney(goal.targetAmount)}
                              </Text>
                            </Text>
                            <Text style={[styles.goalPct, { color: GOAL_PROGRESS_FILL }]}>{pct} %</Text>
                          </View>
                        </View>

                        <View
                          style={[
                            progressBar.track,
                            styles.goalProgressTrack,
                            { backgroundColor: goalProgressTrack },
                          ]}
                        >
                          <GoalProgressFill pct={pct} />
                        </View>

                        {showFooter ? (
                          <View style={styles.goalFooter}>
                            {weekly > 0 ? (
                              <Text style={[styles.goalMeta, { color: mutedTextColor }]} {...rowTitleTextProps}>
                                +{formatMoney(weekly)} / sem
                              </Text>
                            ) : null}
                            {paceEstimate ? (
                              <Text
                                style={[styles.goalMeta, styles.goalPaceEstimate, { color: mutedTextColor }]}
                                {...rowTitleTextProps}
                              >
                                {paceEstimate}
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                      </DashboardCard>
                    </Pressable>
                  );
                })}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ajouter un objectif"
                  onPress={handleOpenNewGoal}
                  style={({ pressed }) => [
                    styles.premiumAddCta,
                    { backgroundColor: themeColors.surfaceElevated },
                    pressed && floatingGlassButtonPressed,
                  ]}
                >
                  <Ionicons name="add" size={18} color={mutedTextColor} />
                  <Text style={[styles.premiumAddCtaLabel, { color: textColor }]}>Ajouter un objectif</Text>
                </Pressable>
                </View>
              </View>
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
        onDismiss={handleCloseEdit}
        onSave={handleSaveEdit}
        feedback={editFormFeedback}
      />
    </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 0,
    gap: PORTFOLIO_SECTION_GAP,
  },
  goalsHeroBlock: {
    alignItems: 'flex-start',
    gap: 0,
    paddingHorizontal: GOALS_PAGE_PADDING,
  },
  goalsHeaderTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  pageTitle: {
    ...interExtraBoldText,
    fontSize: 32,
    letterSpacing: -0.8,
  },
  goalsEmptySection: {
    paddingHorizontal: GOALS_PAGE_PADDING,
  },
  pressed: { opacity: 0.76 },
  premiumAddCta: {
    marginTop: PORTFOLIO_SECTION_GAP,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
  },
  premiumAddCtaLabel: {
    ...interBoldText,
    fontSize: typography.meta,
  },
  goalCardList: { gap: PORTFOLIO_SECTION_GAP },
  goalsListSection: {
    gap: spacing.lg,
    paddingHorizontal: GOALS_PAGE_PADDING,
  },
  goalsListHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  goalsListTitleGroup: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  goalsListEyebrow: {
    marginBottom: spacing.xs,
  },
  goalsListTitle: {
    ...SECTION_TITLE_STYLE,
  },
  goalsCountBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  goalsCountBadgeLabel: {
    ...interBoldText,
    fontSize: typography.micro,
  },
  goalCards: {
    gap: spacing.md,
  },
  goalCardInner: {
    paddingHorizontal: GOALS_PAGE_PADDING,
    paddingVertical: spacing.md,
    minHeight: 124,
    gap: spacing.sm,
  },
  goalCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 48,
  },
  goalTitleBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  goalCardIconSlot: {
    width: 22,
    minWidth: 22,
    alignItems: 'center',
    paddingTop: 1,
  },
  goalName: {
    ...rowLabel,
    ...interExtraBoldText,
    flex: 1,
    minWidth: 0,
  },
  goalMeta: {
    ...interBoldText,
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  goalAmountBlock: {
    flexShrink: 0,
    minWidth: 96,
    maxWidth: 132,
    alignItems: 'flex-end',
    gap: 4,
  },
  goalPct: {
    ...portfolioNumericText,
    fontSize: typography.micro,
    textAlign: 'right',
  },
  goalProgressTrack: {
    alignSelf: 'stretch',
  },
  goalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: typography.micro + 4,
  },
  goalPaceEstimate: {
    flexShrink: 1,
    textAlign: 'right',
  },
  savedHero: {
    maxWidth: '100%',
    ...rowValue,
    textAlign: 'right',
  },
  savedTarget: {
    ...rowValue,
    textAlign: 'right',
  },
  emptyCardInner: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    ...interExtraBoldText,
    fontSize: typography.body,
  },
  emptyHint: {
    textAlign: 'center',
    ...interBoldText,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.lg,
  },
  emptyCtaText: {
    ...interExtraBoldText,
    fontSize: typography.caption,
  },
});

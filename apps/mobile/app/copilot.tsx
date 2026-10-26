/**
 * Copilote hub — visual first: a health score ring, four mini-charts (cash cushion,
 * budget pace, savings rate, subscriptions), the closest goal, then every tip grouped
 * by priority. Calm palette: green when it's going well, amber otherwise — never red.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BillsCushionSheet } from '@/components/copilot/BillsCushionSheet';
import { CopilotInsightRow, useCopilotData, WARN_TONE } from '@/components/copilot/CopilotCard';
import { FixedScreenHeader, fixedHeaderScreenStyle, fixedHeaderScrollStyle } from '@/components/FixedScreenHeader';
import { AppIcon } from '@/components/icons/AppIcon';
import { AnimatedBar, GoalTile, ListCard, PressScale, Reveal, RingGauge, SECTION_GAP, SectionLabel } from '@/components/kit';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { usePopOnActive } from '@/components/kit/motion';
import { PageTransition } from '@/components/PageTransition';
import {
  FLOATING_NAV_CONTENT_PADDING,
  jakartaBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  PAGE_PADDING_HORIZONTAL,
  spacing,
} from '@/constants/theme';
import { copilotHealthScore, type CopilotInsight } from '@/lib/copilotInsights';
import { getCategoryBudgets, getDashboard, getRecurringPayments, getSavingsGoals } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatNumberInputFromValue } from '@/lib/formatNumber';
import { isFormSaveSuccess, type FormFeedback } from '@/lib/formFeedback';
import { suggestNextGoal } from '@/lib/goalSuggestion';
import {
  createNewGoalForm,
  createNewGoalFormFromSuggestion,
  SavingsGoalFormModal,
  saveSavingsGoalForm,
  type GoalForm,
} from '@/components/SavingsGoalsForm';
import type { CategoryBudget, DashboardSummary, RecurringPayment, SavingsGoal } from '@/types';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const GROUPS: { title: string; match: (insight: CopilotInsight) => boolean }[] = [
  { title: 'À regarder', match: (i) => i.tone === 'risk' || i.tone === 'warn' },
  { title: 'Bon à savoir', match: (i) => i.tone === 'info' },
  { title: 'Bien joué', match: (i) => i.tone === 'good' },
];

const CUSHION_DAYS = 14;

/** #RRGGBB + alpha → #RRGGBBAA (gradient stops). */
function withAlphaHex(hex: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}
const money = formatDisplayMoneyAbsolute;


function scoreCopy(score: number): { label: string; body: string } {
  if (score >= 80) return { label: 'Excellente forme', body: 'Tes finances tournent rond — continue comme ça.' };
  if (score >= 60) return { label: 'Bonne forme', body: 'Quelques ajustements et tu seras au top.' };
  return { label: 'On consolide', body: 'Un pas à la fois : commence par le premier point ci-dessous.' };
}

export default function CopilotScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const data = useCopilotData();
  const insights = data?.insights ?? null;
  const input = data?.input ?? null;

  const [shown, setShown] = useState(false);
  useEffect(() => setShown(true), []);
  const pop = usePopOnActive(shown && data != null, 1.08);

  const score = insights ? copilotHealthScore(insights) : 0;
  const scoreColor = score >= 60 ? colors.accentGreen : WARN_TONE;
  const copy = scoreCopy(score);

  const stats = useMemo(() => {
    if (!input) return null;
    const now = input.now;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthPct = now.getDate() / lastDay;
    const budgeted = input.categories.filter((c) => c.limit > 0);
    const limit = budgeted.reduce((s, c) => s + c.limit, 0);
    const spent = budgeted.reduce((s, c) => s + Math.max(0, c.spent), 0);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + CUSHION_DAYS);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    const billsSoon = input.upcoming
      .filter((row) => row.dateKey <= cutoffKey)
      .reduce((s, row) => s + Math.abs(row.amount), 0);
    const savingsRate =
      input.monthlyIncome > 0 ? (input.monthlyIncome - input.monthlyExpenses) / input.monthlyIncome : null;
    // Same as Accueil: the two goals closest to the finish line.
    const goals = [...input.goals]
      .filter((g) => g.target > 0 && g.saved < g.target)
      .sort((a, b) => b.saved / b.target - a.saved / a.target)
      .slice(0, 2);
    return { monthPct, limit, spent, billsSoon, savingsRate, goals };
  }, [input]);

  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({ title: group.title, items: (insights ?? []).filter(group.match) })).filter(
        (group) => group.items.length > 0,
      ),
    [insights],
  );

  const suggestion = useMemo(
    () =>
      input
        ? suggestNextGoal({
            monthlyIncome: input.monthlyIncome,
            monthlyExpenses: input.monthlyExpenses,
            subscriptionsMonthly: input.subscriptionsMonthly,
            recurringMonthly: input.recurringMonthly,
            goals: input.goals,
          })
        : null,
    [input],
  );

  // Goal form (same sheet as Accueil / Wallet), prefilled from the suggestion.
  const [goalForm, setGoalForm] = useState<GoalForm | null>(null);
  const [goalDeps, setGoalDeps] = useState<{
    goals: SavingsGoal[];
    dashboard: DashboardSummary | null;
    categoryBudgets: CategoryBudget[];
    recurringPayments: RecurringPayment[];
  } | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalFeedback, setGoalFeedback] = useState<FormFeedback | null>(null);

  /** The goal form needs fresh goals / budget context before it opens. */
  const loadGoalDeps = async () => {
    const [goals, dashboard, categoryBudgets, recurringPayments] = await Promise.all([
      getSavingsGoals(),
      getDashboard(),
      getCategoryBudgets(),
      getRecurringPayments(),
    ]);
    setGoalDeps({ goals, dashboard, categoryBudgets, recurringPayments });
    setGoalFeedback(null);
  };

  const openNewGoal = async () => {
    tapHaptic();
    await loadGoalDeps();
    setGoalForm(createNewGoalForm());
  };

  // Factures d'avance has its own sheet: it also asks which account gets the envelope.
  const [cushionOpen, setCushionOpen] = useState(false);

  const openSuggestedGoal = async () => {
    if (!suggestion) return;
    tapHaptic();
    if (suggestion.kind === 'bills-cushion') {
      setCushionOpen(true);
      return;
    }
    await loadGoalDeps();
    setGoalForm({
      ...createNewGoalFormFromSuggestion({ name: suggestion.name, icon: suggestion.icon }),
      targetAmount: formatNumberInputFromValue(suggestion.targetAmount),
    });
  };

  const saveGoal = async () => {
    if (!goalForm) return;
    setSavingGoal(true);
    try {
      const result = await saveSavingsGoalForm(goalForm, isLight);
      if (isFormSaveSuccess(result)) {
        setGoalForm(null);
        dataEvents.emit();
        return;
      }
      setGoalFeedback(result);
    } finally {
      setSavingGoal(false);
    }
  };

  const go = (href: Parameters<typeof router.push>[0]) => {
    tapHaptic();
    router.push(href);
  };

  const tileSurface = { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder };

  // Every stat tile takes the tallest tile's height, so both rows always match whatever the
  // content or the system font size (the height only ever grows, so this settles in one pass).
  const [tileHeight, setTileHeight] = useState(0);
  const onTileLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    setTileHeight((prev) => (height > prev ? height : prev));
  }, []);
  const tileHeightStyle = tileHeight > 0 ? { minHeight: tileHeight } : null;

  return (
    <PageTransition>
      <View style={[fixedHeaderScreenStyle, styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView
          style={fixedHeaderScrollStyle}
          contentContainerStyle={{
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Scrolls away with the page — no pinned header on this screen. */}
          <FixedScreenHeader
            title="Copilote"
            onBack={() => router.back()}
            style={{ marginHorizontal: -PAGE_PADDING_HORIZONTAL }}
          />
          {/* 1. Health score */}
          {insights ? (
            <Reveal style={[styles.hero, tileSurface]}>
              <LinearGradient
                pointerEvents="none"
                colors={[withAlphaHex(scoreColor, 0.2), withAlphaHex(scoreColor, 0)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Animated.View style={pop}>
                <RingGauge progress={score / 100} color={scoreColor} size={104} stroke={10}>
                  <Text style={[styles.scoreValue, { color: colors.text }]}>{score}</Text>
                  <Text style={[styles.scoreCaption, { color: colors.textMuted }]}>/ 100</Text>
                </RingGauge>
              </Animated.View>
              <View style={styles.heroCopy}>
                <View style={styles.heroTag}>
                  <AppIcon family="ionicons" name="sparkles" size={13} color={scoreColor} />
                  <Text style={[styles.heroTagText, { color: scoreColor }]}>Santé financière</Text>
                </View>
                <Text style={[styles.heroTitle, { color: colors.text }]}>{copy.label}</Text>
                <Text style={[styles.heroBody, { color: colors.textMuted }]}>{copy.body}</Text>
              </View>
            </Reveal>
          ) : null}

          {/* 2. Mini-charts */}
          {stats ? (
            <View style={styles.grid}>
              <Reveal index={1} style={styles.cell}>
                <PressScale accessibilityRole="button" onPress={() => go('/accounts')} scaleTo={0.96} containerStyle={styles.tileTarget} onLayout={onTileLayout} style={[styles.tile, tileSurface, tileHeightStyle]}>
                  <TileHead icon="shield-checkmark" title="Coussin" />
                  <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1}>
                    {money(Math.max(0, input!.liquidCash))}
                  </Text>
                  <MiniBar label="Dispo" value={1} color={colors.accentGreen} />
                  <MiniBar
                    label={`Factures ${CUSHION_DAYS} j`}
                    value={input!.liquidCash > 0 ? stats.billsSoon / input!.liquidCash : stats.billsSoon > 0 ? 1 : 0}
                    color={input!.liquidCash >= stats.billsSoon ? colors.textSecondary : WARN_TONE}
                  />
                </PressScale>
              </Reveal>

              <Reveal index={2} style={styles.cell}>
                <PressScale accessibilityRole="button" onPress={() => go('/budgets')} scaleTo={0.96} containerStyle={styles.tileTarget} onLayout={onTileLayout} style={[styles.tile, tileSurface, tileHeightStyle]}>
                  <TileHead icon="speedometer" title="Rythme" />
                  <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1}>
                    {stats.limit > 0 ? `${Math.round((stats.spent / stats.limit) * 100)} %` : '—'}
                  </Text>
                  <MiniBar
                    label="Budget utilisé"
                    value={stats.limit > 0 ? stats.spent / stats.limit : 0}
                    color={stats.limit > 0 && stats.spent / stats.limit > stats.monthPct + 0.05 ? WARN_TONE : colors.accentGreen}
                  />
                  <MiniBar label="Mois écoulé" value={stats.monthPct} color={colors.textMuted} />
                </PressScale>
              </Reveal>

              <Reveal index={3} style={styles.cell}>
                <PressScale accessibilityRole="button" onPress={() => go('/transactions-insights')} scaleTo={0.96} containerStyle={styles.tileTarget} onLayout={onTileLayout} style={[styles.tile, tileSurface, tileHeightStyle]}>
                  <TileHead icon="leaf" title="Épargne" />
                  <View style={styles.ringRow}>
                    <RingGauge
                      progress={Math.max(0, stats.savingsRate ?? 0)}
                      color={(stats.savingsRate ?? 0) > 0 ? colors.accentGreen : colors.textMuted}
                      size={68}
                      stroke={6}
                    >
                      <Text style={[styles.ringText, { color: colors.text }]}>
                        {stats.savingsRate == null ? '—' : `${Math.round(stats.savingsRate * 100)}%`}
                      </Text>
                    </RingGauge>
                    <Text style={[styles.tileCaption, styles.ringCaption, { color: colors.textMuted }]}>du revenu mis de côté ce mois</Text>
                  </View>
                </PressScale>
              </Reveal>

              <Reveal index={4} style={styles.cell}>
                <PressScale accessibilityRole="button" onPress={() => go('/subscriptions-insights')} scaleTo={0.96} containerStyle={styles.tileTarget} onLayout={onTileLayout} style={[styles.tile, tileSurface, tileHeightStyle]}>
                  <TileHead icon="repeat" title="Abonnements" />
                  <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1}>
                    {money(input!.subscriptionsMonthly)}
                  </Text>
                  <Text style={[styles.tileCaption, { color: colors.textMuted }]}>
                    par mois · {input!.subscriptionsCount} actif{input!.subscriptionsCount > 1 ? 's' : ''}
                  </Text>
                  <Text style={[styles.tileCaption, { color: colors.textMuted }]}>
                    ≈ {money(input!.subscriptionsMonthly * 12)} / an
                  </Text>
                </PressScale>
              </Reveal>
            </View>
          ) : null}

          {/* 3. Goals — same GoalTile as Accueil / Wallet, plus the Copilote's next-goal suggestion */}
          {stats ? (
            <Reveal index={5} style={styles.section}>
              <SectionLabel title="Objectifs" actionLabel="Tout voir" onAction={() => router.navigate('/accounts')} />
              {suggestion ? (
                <View style={[styles.suggestion, tileSurface]}>
                  <View style={styles.suggestionTag}>
                    <AppIcon family="ionicons" name="sparkles" size={12} color={colors.accentGreen} />
                    <Text style={[styles.suggestionTagText, { color: colors.accentGreen }]}>Suggestion du Copilote</Text>
                  </View>
                  <View style={styles.suggestionHead}>
                    <UserPickedIconWell icon={suggestion.icon} size={36} />
                    <View style={styles.suggestionCopy}>
                      <Text style={[styles.suggestionName, { color: colors.text }]} numberOfLines={2}>
                        {suggestion.name.split(' · ')[0]}
                      </Text>
                      <Text style={[styles.suggestionMeta, { color: colors.textMuted }]} numberOfLines={1}>
                        {money(suggestion.targetAmount)} · {money(suggestion.monthly)} / mois
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.suggestionReason, { color: colors.textSecondary }]} numberOfLines={2}>
                    {suggestion.reason}
                  </Text>
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel={`Créer l’objectif ${suggestion.name}`}
                    onPress={() => void openSuggestedGoal()}
                    scaleTo={0.97}
                    style={[styles.suggestionButton, { backgroundColor: colors.text }]}
                  >
                    <AppIcon family="ionicons" name="add" size={16} color={colors.background} />
                    <Text style={[styles.suggestionButtonText, { color: colors.background }]}>Créer cet objectif</Text>
                  </PressScale>
                </View>
              ) : null}
              <View style={styles.goalGrid}>
                {stats.goals.map((goal) => (
                  <View key={goal.id} style={styles.goalCell}>
                    <GoalTile
                      name={goal.name}
                      icon={<UserPickedIconWell icon={goal.icon ?? 'flag-outline'} size={32} />}
                      saved={goal.saved}
                      target={goal.target}
                      onPress={() => go({ pathname: '/goal-detail', params: { goalId: goal.id } })}
                    />
                  </View>
                ))}
                {/* Always offer a new goal — it also fills the empty half next to an odd goal. */}
                <View style={styles.goalCell}>
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel="Créer un nouvel objectif d’épargne"
                    onPress={() => void openNewGoal()}
                    scaleTo={0.96}
                    containerStyle={styles.tileTarget}
                    style={[styles.newGoalTile, { borderColor: colors.containerBorder }]}
                  >
                    <View style={[styles.newGoalIcon, { backgroundColor: colors.surfaceElevated }]}>
                      <AppIcon family="ionicons" name="add" size={22} color={colors.text} />
                    </View>
                    <Text style={[styles.newGoalTitle, { color: colors.text }]}>Nouvel objectif</Text>
                  </PressScale>
                </View>
              </View>
            </Reveal>
          ) : null}

          {/* 4. Tips */}
          {insights && insights.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>Rien à signaler pour l’instant — bravo !</Text>
          ) : null}
          {groups.map((group, groupIndex) => (
            <Reveal key={group.title} index={groupIndex + 6} style={styles.section}>
              <SectionLabel title={group.title} />
              <ListCard>
                {group.items.map((insight, index) => (
                  <CopilotInsightRow
                    key={insight.id}
                    // Calm palette here too: « risk » reads as amber, not red.
                    insight={insight.tone === 'risk' ? { ...insight, tone: 'warn' } : insight}
                    borderTop={index > 0}
                    isLast={index === group.items.length - 1}
                    onPress={insight.route ? () => router.push(insight.route as never) : undefined}
                  />
                ))}
              </ListCard>
            </Reveal>
          ))}
        </ScrollView>

        {cushionOpen ? (
          <BillsCushionSheet
            suggestedMonthly={suggestion?.kind === 'bills-cushion' ? suggestion.monthly : 0}
            onClose={() => setCushionOpen(false)}
            onCreated={() => {
              setCushionOpen(false);
              dataEvents.emit();
            }}
          />
        ) : null}

        {goalDeps ? (
          <SavingsGoalFormModal
            form={goalForm}
            setForm={setGoalForm}
            goals={goalDeps.goals}
            dashboard={goalDeps.dashboard}
            categoryBudgets={goalDeps.categoryBudgets}
            recurringPayments={goalDeps.recurringPayments}
            saving={savingGoal}
            onDismiss={() => setGoalForm(null)}
            onSave={() => void saveGoal()}
            feedback={goalFeedback}
          />
        ) : null}
      </View>
    </PageTransition>
  );
}

function TileHead({ icon, title }: { icon: string; title: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.tileHead}>
      <AppIcon family="ionicons" name={icon} size={14} color={colors.textMuted} />
      <Text style={[styles.tileTitle, { color: colors.textMuted }]}>{title}</Text>
    </View>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.miniBar}>
      <Text style={[styles.miniLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <AnimatedBar progress={Math.min(1, value)} color={color} trackColor={colors.borderSubtle} height={5} delay={150} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  section: { marginBottom: SECTION_GAP + spacing.sm },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  scoreValue: { ...jakartaBoldText, fontSize: 30, letterSpacing: -1, lineHeight: 34 },
  scoreCaption: { ...jakartaMediumText, fontSize: 11 },
  heroCopy: { flex: 1, minWidth: 0, gap: 4 },
  heroTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroTagText: { ...jakartaSemiboldText, fontSize: 12 },
  heroTitle: { ...jakartaBoldText, fontSize: 20, letterSpacing: -0.3 },
  heroBody: { ...jakartaMediumText, fontSize: 13, lineHeight: 18 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: SECTION_GAP - 4 },
  // Cells stretch to the row; tiles fill the cell and share one height so both rows line up.
  cell: { width: '50%', paddingHorizontal: 5, paddingBottom: 10, alignSelf: 'stretch' },
  /** The touch target must stretch too, or the tile's flex: 1 has nothing to fill (uneven tiles). */
  tileTarget: { flex: 1 },
  tile: { flex: 1, borderRadius: 20, borderWidth: 1, padding: 14, gap: 8, minHeight: 168 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileTitle: { ...jakartaSemiboldText, fontSize: 12.5 },
  tileValue: { ...jakartaBoldText, fontSize: 20, letterSpacing: -0.4 },
  tileCaption: { ...jakartaMediumText, fontSize: 12, lineHeight: 16 },
  miniBar: { gap: 4 },
  miniLabel: { ...jakartaMediumText, fontSize: 11 },
  ringRow: { alignItems: 'flex-start', gap: 8 },
  ringText: { ...jakartaBoldText, fontSize: 12, letterSpacing: -0.3 },
  ringCaption: { marginTop: 2 },

  suggestion: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 10, marginBottom: 10 },
  suggestionTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  suggestionTagText: { ...jakartaSemiboldText, fontSize: 12 },
  suggestionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  suggestionCopy: { flex: 1, minWidth: 0, gap: 2 },
  suggestionName: { ...jakartaSemiboldText, fontSize: 15 },
  suggestionMeta: { ...jakartaMediumText, fontSize: 12.5 },
  suggestionReason: { ...jakartaMediumText, fontSize: 13, lineHeight: 18 },
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 20,
  },
  suggestionButtonText: { ...jakartaSemiboldText, fontSize: 13.5 },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  goalCell: { width: '50%', paddingHorizontal: 5, paddingBottom: 10, alignSelf: 'stretch' },
  newGoalTile: {
    flex: 1,
    minHeight: 150,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  newGoalIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  newGoalTitle: { ...jakartaSemiboldText, fontSize: 15 },

  empty: { ...jakartaMediumText, fontSize: 14, textAlign: 'center', paddingVertical: spacing.xl },
});

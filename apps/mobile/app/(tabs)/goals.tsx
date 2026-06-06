import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardProgressBar } from '@/components/DashboardProgressBar';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { PageTransition } from '@/components/PageTransition';
import { NetWorthAmountRow } from '@/components/NetWorthAmountRow';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import { GoalSparkChart, buildGoalSparklineSeries } from '@/components/GoalSparkChart';
import { floatingGlassButtonPressed } from '@/constants/floatingGlassButton';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  LINEAR_CHART_ACCENT,
  LINEAR_CHART_ACCENT_LIGHT,
  LINEAR_CHART_END_DOT_INNER_R,
  LINEAR_CHART_GLOW_MID_OPACITY,
  LINEAR_CHART_GLOW_MID_TRANSLATE_Y,
  LINEAR_CHART_GLOW_OUTER_OPACITY,
  LINEAR_CHART_STROKE_GLOW_MID,
  LINEAR_CHART_STROKE_GLOW_OUTER,
  LINEAR_CHART_STROKE_MAIN,
} from '@/constants/linearChart';
import {
  FLOATING_NAV_CONTENT_PADDING,
  getGoalChartBaseGreen,
  getGoalChartDashPattern,
  getGoalChartOpacity,
  getGoalGreenShade,
  interBoldText,
  interExtraBoldText,
  PAGE_PADDING_HORIZONTAL,
  portfolioLight,
  PORTFOLIO_SECTION_GAP,
  PROGRESS_BAR_TRACK_HEIGHT,
  SECTION_TITLE_STYLE,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import {
  deleteSavingsGoal,
  getCategoryBudgets,
  getDashboard,
  getRecurringPayments,
  getSavingsGoals,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { savingsGoalIncrementalProgress } from '@/lib/savingsGoalProgress';
import { portfolioNumericText, rowLabel, rowTitleTextProps, rowValue, singleLineAmountProps } from '@/lib/textLayout';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { FormFeedback } from '@/lib/formFeedback';
import type { CategoryBudget, DashboardSummary, RecurringPayment, SavingsGoal } from '@/types';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import {
  SavingsGoalFormModal,
  createGoalEditForm,
  createNewGoalForm,
  saveSavingsGoalForm,
  type GoalForm,
} from '@/lib/savingsGoalsForm';

const DELTA_MINT_BG = portfolioLight.deltaBg;
const DELTA_MINT_BORDER = portfolioLight.deltaBorder;
const DARK_DELTA_MINT_BG = 'rgba(0, 230, 118, 0.15)';
const DARK_DELTA_MINT_BORDER = 'rgba(0, 230, 118, 0.28)';
const GOALS_PAGE_PADDING = PAGE_PADDING_HORIZONTAL;
const DETAIL_SHEET_TOP_RADIUS = 22;
const OVERVIEW_CHART_W = 320;
const OVERVIEW_CHART_H = 112;
const OVERVIEW_LABEL_H = 16;
const OVERVIEW_TOTAL_H = OVERVIEW_CHART_H + OVERVIEW_LABEL_H;
const OVERVIEW_PAD_X = 12;
const OVERVIEW_PAD_Y = 12;
const GOAL_ICON_WELL_SIZE = 40;
const GOAL_ICON_SIZE = 22;

type GoalProjection = {
  progress: number;
  remaining: number;
  weeksToGoal: number | null;
  requiredWeekly: number | null;
  monthlyContribution: number;
  weeklyObligationsTotal: number;
  budgetUseRatio: number | null;
  freeMoneyLeftRatio: number | null;
  targetDate: string | null;
  hint: string;
};

function formatMoney(value: number) {
  return formatDisplayMoneyAbsolute(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function colorWithAlpha(color: string, alpha: number) {
  const hex = color.replace('#', '').trim();
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(5,150,105,${alpha})`;

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function getReadableIconColor(backgroundColor: string): '#000000' | '#FFFFFF' {
  const hex = backgroundColor.replace('#', '').trim();
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return '#FFFFFF';

  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  const toLinear = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  const luminance = 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);

  return contrastWithBlack > contrastWithWhite ? '#000000' : '#FFFFFF';
}

function projectedCompletionLabel(goal: SavingsGoal): string | null {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  if (remaining <= 0) return 'Objectif atteint';
  const w = goal.weeklyContribution ?? 0;
  if (w > 0) {
    const weeks = Math.ceil(remaining / w);
    const d = new Date();
    d.setDate(d.getDate() + weeks * 7);
    return `Fin estimée · ${d.toISOString().slice(0, 10)}`;
  }
  if (goal.dueDate?.trim()) return `Date cible · ${goal.dueDate}`;
  return null;
}

function GoalsHeaderRow({ onAdd, onManage }: { onAdd: () => void; onManage: () => void }) {
  const { colors: themeColors } = useAppTheme();

  return (
    <View style={styles.goalsHeaderRow}>
      <Text style={[styles.pageTitle, styles.pageTitleInHeader, { color: themeColors.text }]}>Objectifs</Text>
      <View style={styles.goalsHeaderActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gérer les objectifs"
          onPress={onManage}
          style={[styles.goalsHeaderIconButton, { backgroundColor: themeColors.surfaceElevated }]}
        >
          <Ionicons name="list-outline" size={20} color={themeColors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajouter un objectif"
          onPress={onAdd}
          style={[styles.goalsHeaderIconButton, { backgroundColor: themeColors.surfaceElevated }]}
        >
          <Ionicons name="add-outline" size={20} color={themeColors.text} />
        </Pressable>
      </View>
    </View>
  );
}

function GoalsProgressBadge({ progress, targetAmount }: { progress: number; targetAmount: number }) {
  const { isLight } = useAppTheme();
  const pct = Math.round(progress * 100);
  const deltaTextColor = isLight ? LINEAR_CHART_ACCENT_LIGHT : LINEAR_CHART_ACCENT;

  return (
    <View
      style={[
        styles.progressBadge,
        {
          backgroundColor: isLight ? DELTA_MINT_BG : DARK_DELTA_MINT_BG,
          borderColor: isLight ? DELTA_MINT_BORDER : DARK_DELTA_MINT_BORDER,
        },
      ]}
    >
      <Text style={[styles.progressBadgeText, { color: deltaTextColor }]}>
        ↗ {pct} % atteint · objectif {formatMoney(targetAmount)}
      </Text>
    </View>
  );
}

export default function GoalsHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors, ghost, isLight } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const goalsListYRef = useRef(0);
  const skipScrollOnceRef = useRef(false);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<GoalForm | null>(null);
  const [iconPickerExpanded, setIconPickerExpanded] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editFormFeedback, setEditFormFeedback] = useState<FormFeedback | null>(null);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

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

  useRefreshOnFocus(load);
  useEffect(() => dataEvents.subscribe(load), [load]);

  useScrollToTopOnFocus(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
    skipScrollOnceRef,
  );

  const totals = useMemo(
    () =>
      goals.reduce(
        (acc, g) => ({
          current: acc.current + g.currentAmount,
          target: acc.target + g.targetAmount,
        }),
        { current: 0, target: 0 },
      ),
    [goals],
  );

  const headerProgress = totals.target > 0 ? totals.current / totals.target : 0;
  const headerGoalGreen = isLight ? LINEAR_CHART_ACCENT_LIGHT : LINEAR_CHART_ACCENT;
  const gridTone = isLight ? 'rgba(15,23,42,0.2)' : 'rgba(255,255,255,0.14)';
  const textColor = themeColors.text;
  const mutedTextColor = isLight ? themeColors.textMuted : '#909090';
  const handleOpenNewGoal = useCallback(() => {
    skipScrollOnceRef.current = true;
    tapHaptic();
    setIconPickerExpanded(false);
    setEditForm(createNewGoalForm());
  }, []);

  const handleManageGoals = useCallback(() => {
    tapHaptic();
    if (goals.length > 0) {
      scrollRef.current?.scrollTo({ y: goalsListYRef.current, animated: true });
    }
  }, [goals.length]);

  const handleOpenDetail = useCallback((goalId: string) => {
    tapHaptic();
    setSelectedGoalId(goalId);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedGoalId(null);
  }, []);

  const handleModify = useCallback(() => {
    const goal = goals.find((g) => g.id === selectedGoalId);
    if (!goal) return;
    tapHaptic();
    setIconPickerExpanded(false);
    setEditForm(createGoalEditForm(goal));
  }, [goals, selectedGoalId]);

  const handleCloseEdit = useCallback(() => {
    setEditForm(null);
    setEditFormFeedback(null);
    setIconPickerExpanded(false);
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
      setIconPickerExpanded(false);
      successHaptic();
    } finally {
      setSavingEdit(false);
    }
  }, [editForm, isLight, load]);

  const handleDeleteGoal = useCallback(() => {
    tapHaptic();
    setConfirmDeleteVisible(true);
  }, []);

  const handleConfirmDeleteGoal = useCallback(async () => {
    if (!selectedGoalId) return;
    setConfirmDeleteVisible(false);
    await deleteSavingsGoal(selectedGoalId);
    setSelectedGoalId(null);
    await load();
    successHaptic();
  }, [load, selectedGoalId]);

  const selectedGoal = useMemo(
    () => goals.find((g) => g.id === selectedGoalId) ?? null,
    [goals, selectedGoalId],
  );

  const selectedGoalDetails = useMemo(() => {
    if (!selectedGoal) return null;
    const progress = savingsGoalIncrementalProgress(selectedGoal);
    const pct = Math.round(progress * 100);
    const proj = projectedCompletionLabel(selectedGoal);
    const projection = getGoalProjection(selectedGoal, dashboard, categoryBudgets, recurringPayments);
    const remaining = Math.max(0, selectedGoal.targetAmount - selectedGoal.currentAmount);
    return { pct, proj, projection, remaining };
  }, [categoryBudgets, dashboard, recurringPayments, selectedGoal]);
  const selectedGoalAccent = selectedGoal
    ? getGoalGreenShade(selectedGoal.id, isLight)
    : headerGoalGreen;

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
          <GoalsHeaderRow
            onAdd={handleOpenNewGoal}
            onManage={handleManageGoals}
          />
          <DashboardSectionLabel style={styles.heroEyebrow}>ÉPARGNE CUMULÉE</DashboardSectionLabel>
          <NetWorthAmountRow totalBalance={totals.current} />
          {totals.target > 0 ? (
            <GoalsProgressBadge progress={headerProgress} targetAmount={totals.target} />
          ) : null}
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
                <GoalsOverviewChart
                  goals={goals}
                  isLight={isLight}
                  gridColor={gridTone}
                  labelColor={mutedTextColor}
                  titleColor={textColor}
                />

                <View
                  style={styles.goalsListSection}
                  onLayout={(event) => {
                    goalsListYRef.current = event.nativeEvent.layout.y;
                  }}
                >
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
                  const metaParts = [
                    goal.weeklyContribution != null && goal.weeklyContribution > 0
                      ? `+${formatMoney(goal.weeklyContribution)} / sem`
                      : null,
                    goal.dueDate?.trim() ? `Échéance ${goal.dueDate}` : null,
                  ].filter(Boolean);

                  return (
                    <Pressable
                      key={goal.id}
                      android_ripple={null}
                      onPress={() => handleOpenDetail(goal.id)}
                    >
                      <DashboardCard innerStyle={styles.goalCardInner} padding={0}>
                      <View style={styles.goalCardMain}>
                        <View style={styles.goalIdentity}>
                          <UserPickedIconBadge
                            icon={goal.icon || 'flag-outline'}
                            color={goalAccent}
                            size={GOAL_ICON_WELL_SIZE}
                            iconSize={GOAL_ICON_SIZE}
                          />
                          <View style={styles.goalCardHeadText}>
                            <Text style={[styles.goalName, { color: textColor }]} {...rowTitleTextProps}>
                              {goal.name}
                            </Text>
                            {metaParts.length > 0 ? (
                              <Text style={[styles.goalMeta, { color: mutedTextColor }]} {...rowTitleTextProps}>
                                {metaParts.join(' · ')}
                              </Text>
                            ) : null}
                          </View>
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
                          <View style={[styles.goalPctPill, { backgroundColor: colorWithAlpha(goalAccent, isLight ? 0.2 : 0.28) }]}>
                            <Text style={[styles.goalPct, { color: goalAccent }]}>{pct} %</Text>
                          </View>
                        </View>
                      </View>

                      <DashboardProgressBar pct={Math.min(100, pct)} color={goalAccent} marginTop={0} />
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

      <BottomSheet
        visible={selectedGoalId !== null}
        onClose={handleCloseDetail}
        sheetStyle={[
          styles.detailSheet,
          { backgroundColor: themeColors.cardBackground, borderTopWidth: 0 },
        ]}
      >
        {selectedGoal && selectedGoalDetails ? (
          <>
            <View style={styles.detailHeader}>
              <Text style={[styles.detailGoalName, { color: themeColors.text }]} {...rowTitleTextProps}>
                {selectedGoal.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Modifier l'objectif"
                hitSlop={10}
                onPress={handleModify}
                style={({ pressed }) => [styles.detailActionBtn, { backgroundColor: themeColors.surfaceElevated }, pressed && styles.detailBtnPressed]}
              >
                <Ionicons name="pencil-outline" size={15} color={themeColors.text} />
                <Text style={[styles.modifierLabel, { color: themeColors.text }]}>Modifier</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                hitSlop={10}
                onPress={handleCloseDetail}
                style={({ pressed }) => [styles.detailCloseBtn, { backgroundColor: themeColors.surfaceElevated }, pressed && styles.detailBtnPressed]}
              >
                <Ionicons name="close" size={18} color={themeColors.text} />
              </Pressable>
            </View>

            <View style={[styles.detailHero, { backgroundColor: themeColors.cardBackground }]}>
              <Text style={[styles.detailHeroEyebrow, { color: themeColors.textMuted }]}>Progression</Text>
              <Text
                style={[styles.detailAmount, { color: themeColors.text }]}
                {...singleLineAmountProps}
              >
                {formatMoney(selectedGoal.currentAmount)}
                <Text style={[styles.detailAmountOf, { color: themeColors.textMuted }]}>
                  {' '}/ {formatMoney(selectedGoal.targetAmount)}
                </Text>
              </Text>
              <View
                style={[
                  styles.detailHeroProgressRow,
                ]}
              >
                <View style={[styles.detailProgressTrack, { backgroundColor: themeColors.surfaceElevated }]}>
                  <View
                    style={[
                      styles.detailProgressFill,
                      { width: `${Math.min(100, selectedGoalDetails.pct)}%`, backgroundColor: selectedGoalAccent },
                    ]}
                  />
                </View>
                <Text style={[styles.detailPct, { color: selectedGoalAccent }]}>{selectedGoalDetails.pct} %</Text>
              </View>
              <Text style={[styles.detailHeroMeta, { color: themeColors.textMuted }]}>
                Reste à épargner · {formatMoney(selectedGoalDetails.remaining)}
              </Text>
            </View>

            <View style={styles.detailChartBlock}>
              <Text style={[styles.detailSectionLabel, { color: themeColors.textMuted }]}>Tendance</Text>
              <GoalSparkChart
                goal={selectedGoal}
                stroke={selectedGoalAccent}
                areaFill={colorWithAlpha(selectedGoalAccent, isLight ? 0.08 : 0.12)}
                gridColor={gridTone}
                labelColor={themeColors.textMuted}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voir l'historique des transactions de cet objectif"
              hitSlop={12}
              style={({ pressed }) => [
                styles.historyWide,
                { backgroundColor: themeColors.cardBackground },
                pressed && styles.pressed,
              ]}
              onPress={() => {
                tapHaptic();
                router.push({ pathname: '/savings-goal-transactions', params: { id: selectedGoal.id } });
              }}
            >
              <Ionicons name="list-outline" size={18} color={selectedGoalAccent} />
              <Text style={[styles.historyWideText, { color: themeColors.text }]}>
                Voir historique de transactions
              </Text>
            </Pressable>

            <View style={[styles.detailMetaGrid, { backgroundColor: themeColors.cardBackground }]}>
              <DetailMetaCell label="Cible" value={formatMoney(selectedGoal.targetAmount)} />
              <DetailMetaCell label="Épargné" value={formatMoney(selectedGoal.currentAmount)} />
              <DetailMetaCell label="Reste" value={formatMoney(selectedGoalDetails.remaining)} />
              <DetailMetaCell
                label="Contribution hebdo"
                value={
                  selectedGoal.weeklyContribution != null && selectedGoal.weeklyContribution > 0
                    ? `+${formatMoney(selectedGoal.weeklyContribution)}`
                    : 'Non renseignée'
                }
              />
              <DetailMetaCell
                label="Date cible"
                value={selectedGoal.dueDate?.trim() ? selectedGoal.dueDate : 'Aucune date maximale'}
                wide
              />
            </View>

            <View style={[styles.detailProjectionPanel, { backgroundColor: themeColors.cardBackground }]}>
              <Text style={[styles.detailProjectionTitle, { color: themeColors.text }]}>Projection</Text>
              {selectedGoalDetails.projection ? (
                <>
                  <DetailProjectionRow label="Progression" value={formatPercent(selectedGoalDetails.projection.progress)} />
                  <DetailProjectionRow label="Reste à épargner" value={formatMoney(selectedGoalDetails.projection.remaining)} />
                  {selectedGoalDetails.projection.weeksToGoal != null ? (
                    <DetailProjectionRow
                      label="Durée au rythme choisi"
                      value={formatGoalDuration(selectedGoalDetails.projection.weeksToGoal)}
                    />
                  ) : null}
                  {selectedGoalDetails.projection.requiredWeekly != null ? (
                    <DetailProjectionRow
                      label="Requis par semaine"
                      value={`${formatMoney(selectedGoalDetails.projection.requiredWeekly)} / semaine`}
                    />
                  ) : null}
                  {selectedGoalDetails.projection.targetDate != null ? (
                    <DetailProjectionRow
                      label="Date estimée d'atteinte"
                      value={selectedGoalDetails.projection.targetDate}
                    />
                  ) : null}
                  {selectedGoalDetails.projection.monthlyContribution > 0 ? (
                    <DetailProjectionRow
                      label="Montant par mois"
                      value={formatMoney(selectedGoalDetails.projection.monthlyContribution)}
                    />
                  ) : null}
                  {selectedGoalDetails.projection.budgetUseRatio != null &&
                  selectedGoalDetails.projection.monthlyContribution > 0 ? (
                    <DetailProjectionRow
                      label="Part du budget"
                      value={formatPercent(selectedGoalDetails.projection.budgetUseRatio)}
                    />
                  ) : null}
                  {selectedGoalDetails.projection.weeklyObligationsTotal > 0 ? (
                    <DetailProjectionRow
                      label="Obligations + objectif / semaine"
                      value={`${formatMoney(selectedGoalDetails.projection.weeklyObligationsTotal)} / semaine`}
                    />
                  ) : null}
                  <Text style={[styles.detailProjectionHint, { color: themeColors.textMuted }]}>
                    {selectedGoalDetails.projection.hint}
                  </Text>
                </>
              ) : (
                <Text style={[styles.detailProjectionHint, { color: themeColors.textMuted }]}>
                  {selectedGoalDetails.proj ?? 'Projection disponible lorsque le rythme hebdomadaire est renseigné.'}
                </Text>
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Supprimer l'objectif"
              style={({ pressed }) => [
                styles.deleteButton,
                { backgroundColor: themeColors.dangerMuted, borderColor: themeColors.danger },
                pressed && styles.deleteButtonPressed,
              ]}
              onPress={handleDeleteGoal}
            >
              <Ionicons name="trash-outline" size={16} color={themeColors.danger} />
              <Text style={[styles.deleteText, { color: themeColors.danger }]}>Supprimer l'objectif</Text>
            </Pressable>
          </>
        ) : null}
      </BottomSheet>

      <ConfirmDeleteModal
        visible={confirmDeleteVisible}
        title="Supprimer l'objectif ?"
        message={
          selectedGoal
            ? `Supprimer ${selectedGoal.name} ? Les transactions existantes restent dans l'historique général.`
            : 'Cette action est irréversible.'
        }
        onConfirm={() => void handleConfirmDeleteGoal()}
        onCancel={() => setConfirmDeleteVisible(false)}
      />

      <SavingsGoalFormModal
        form={editForm}
        setForm={setEditForm}
        goals={goals}
        dashboard={dashboard}
        categoryBudgets={categoryBudgets}
        recurringPayments={recurringPayments}
        saving={savingEdit}
        iconPickerExpanded={iconPickerExpanded}
        setIconPickerExpanded={setIconPickerExpanded}
        onDismiss={handleCloseEdit}
        onSave={handleSaveEdit}
        feedback={editFormFeedback}
      />
    </View>
    </PageTransition>
  );
}

function DetailProjectionRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.detailProjectionRow}>
      <Text style={[styles.detailProjectionLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailProjectionValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function DetailMetaCell({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.detailMetaCell, wide && styles.detailMetaCellWide]}>
      <Text style={[styles.detailInfoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailInfoValue, { color: colors.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function GoalsOverviewChart({
  goals,
  isLight,
  gridColor,
  labelColor,
  titleColor,
}: {
  goals: SavingsGoal[];
  isLight: boolean;
  gridColor: string;
  labelColor: string;
  titleColor: string;
}) {
  const chartBaseGreen = getGoalChartBaseGreen(isLight);
  const chart = useMemo(() => {
    const now = new Date();
    const byGoal = goals.map((goal) => {
      const series = buildGoalSparklineSeries(goal, now);
      const t0 = series.ticks[0]?.t ?? series.points[0]?.t ?? now.getTime();
      const tLast = now.getTime();
      const span = Math.max(tLast - t0, 1);
      const iw = OVERVIEW_CHART_W - OVERVIEW_PAD_X * 2;
      const ih = OVERVIEW_CHART_H - OVERVIEW_PAD_Y * 2;
      const target = Math.max(goal.targetAmount, 0);
      const points = series.points.map((point) => {
        const progress = target > 0 ? clamp(point.v / target, 0, 1) : 0;
        return {
          t: point.t,
          x: OVERVIEW_PAD_X + ((point.t - t0) / span) * iw,
          y: OVERVIEW_PAD_Y + (1 - progress) * ih,
        };
      });
      const path = points.map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
      return {
        goal,
        color: chartBaseGreen,
        opacity: getGoalChartOpacity(goal.id),
        dashPattern: getGoalChartDashPattern(goal.id),
        legendColor: getGoalGreenShade(goal.id, isLight),
        path,
        last: points[points.length - 1] ?? null,
        ticks: series.ticks,
        t0,
        span,
      };
    });

    return {
      lines: byGoal,
      ticks: byGoal[0]?.ticks ?? [],
      t0: byGoal[0]?.t0 ?? now.getTime(),
      span: byGoal[0]?.span ?? 1,
    };
  }, [chartBaseGreen, goals, isLight]);

  const legendGoals = chart.lines.slice(0, 6);
  const hiddenLegendCount = Math.max(0, chart.lines.length - legendGoals.length);

  return (
    <View style={styles.overviewChartWrapper}>
      <DashboardCard padding={GOALS_PAGE_PADDING}>
        <View style={styles.overviewChartBlock}>
          <View style={styles.overviewHeader}>
            <DashboardSectionLabel>Vue d'ensemble</DashboardSectionLabel>
            <Text style={[styles.overviewTitle, { color: titleColor }]}>Progression des objectifs</Text>
          </View>
          <Svg width="100%" height={OVERVIEW_TOTAL_H} viewBox={`0 0 ${OVERVIEW_CHART_W} ${OVERVIEW_TOTAL_H}`}>
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = OVERVIEW_PAD_Y + ratio * (OVERVIEW_CHART_H - OVERVIEW_PAD_Y * 2);
          return (
            <Line
              key={`grid-${ratio}`}
              x1={OVERVIEW_PAD_X}
              y1={y}
              x2={OVERVIEW_CHART_W - OVERVIEW_PAD_X}
              y2={y}
              stroke={gridColor}
              strokeWidth={1}
              opacity={ratio === 0.5 ? 0.35 : 0.22}
            />
          );
        })}
        {chart.lines.map((line) => (
          <Path
            key={`${line.goal.id}-glow-outer`}
            d={line.path}
            fill="none"
            stroke={line.color}
            strokeWidth={LINEAR_CHART_STROKE_GLOW_OUTER}
            strokeOpacity={LINEAR_CHART_GLOW_OUTER_OPACITY * line.opacity}
            strokeDasharray={line.dashPattern}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {chart.lines.map((line) => (
          <Path
            key={`${line.goal.id}-glow-mid`}
            d={line.path}
            fill="none"
            stroke={line.color}
            strokeWidth={LINEAR_CHART_STROKE_GLOW_MID}
            strokeOpacity={LINEAR_CHART_GLOW_MID_OPACITY * line.opacity}
            strokeDasharray={line.dashPattern}
            strokeLinecap="round"
            strokeLinejoin="round"
            transform={`translate(0 ${LINEAR_CHART_GLOW_MID_TRANSLATE_Y})`}
          />
        ))}
        {chart.lines.map((line) => (
          <Path
            key={line.goal.id}
            d={line.path}
            fill="none"
            stroke={line.color}
            strokeWidth={LINEAR_CHART_STROKE_MAIN}
            strokeOpacity={line.opacity}
            strokeDasharray={line.dashPattern}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {chart.lines.map((line) =>
          line.last ? (
            <Circle
              key={`${line.goal.id}-last`}
              cx={line.last.x}
              cy={line.last.y}
              r={LINEAR_CHART_END_DOT_INNER_R}
              fill={line.legendColor}
            />
          ) : null,
        )}
        {chart.ticks.map((tick) => {
          const x = OVERVIEW_PAD_X + ((tick.t - chart.t0) / chart.span) * (OVERVIEW_CHART_W - OVERVIEW_PAD_X * 2);
          if (x < OVERVIEW_PAD_X - 4 || x > OVERVIEW_CHART_W - OVERVIEW_PAD_X + 4) return null;
          return (
            <SvgText
              key={`${tick.t}-${tick.label}`}
              x={x}
              y={OVERVIEW_CHART_H + 12}
              fill={labelColor}
              fontSize={9}
              fontWeight="600"
              textAnchor="middle"
            >
              {tick.label}
            </SvgText>
          );
        })}
      </Svg>
      <View style={styles.overviewLegend}>
        {legendGoals.map((line) => (
          <View key={`${line.goal.id}-legend`} style={styles.overviewLegendItem}>
            <View style={[styles.overviewLegendDot, { backgroundColor: line.legendColor }]} />
            <Text style={[styles.overviewLegendLabel, { color: labelColor }]} {...rowTitleTextProps}>
              {line.goal.name}
            </Text>
          </View>
        ))}
        {hiddenLegendCount > 0 ? (
          <Text style={[styles.overviewLegendMore, { color: labelColor }]}>+{hiddenLegendCount}</Text>
        ) : null}
      </View>
        </View>
      </DashboardCard>
    </View>
  );
}

function getGoalProjection(
  goal: SavingsGoal,
  dashboard: DashboardSummary | null,
  categoryBudgets: CategoryBudget[],
  recurringPayments: RecurringPayment[],
): GoalProjection | null {
  const targetAmount = goal.targetAmount;
  const currentAmount = goal.currentAmount;
  const weeklyContribution = goal.weeklyContribution ?? 0;

  if (
    !Number.isFinite(targetAmount) ||
    !Number.isFinite(currentAmount) ||
    !Number.isFinite(weeklyContribution) ||
    targetAmount < 0 ||
    currentAmount < 0 ||
    weeklyContribution < 0
  ) {
    return null;
  }

  const initialForProgress = Math.min(Math.max(goal.initialSavedAmount ?? currentAmount, 0), currentAmount);
  const remaining = Math.max(0, targetAmount - currentAmount);
  const weeksToGoal = weeklyContribution > 0 && remaining > 0
    ? Math.ceil(remaining / weeklyContribution)
    : null;
  const requiredWeekly = getRequiredWeekly(remaining, goal.dueDate);
  const monthlyContribution = (weeklyContribution * 52) / 12;
  const monthlyIncome = dashboard?.monthlyIncome ?? 0;
  const categoryLimits = categoryBudgets.reduce((sum, item) => sum + toPositiveAmount(item.limitAmount), 0);
  const recurringPaymentsTotal = recurringPayments.reduce(
    (sum, payment) => sum + (payment.active && payment.kind !== 'income' ? monthlyEquivalent(payment) : 0),
    0,
  );
  const monthlyObligationsTotal = categoryLimits + recurringPaymentsTotal;
  const weeklyObligationsTotal = monthlyObligationsTotal / 4 + weeklyContribution;
  const plannedTotal = monthlyObligationsTotal + monthlyContribution;
  const freeMoneyLeft = monthlyIncome > 0 ? monthlyIncome - plannedTotal : null;
  const budgetUseRatio = monthlyIncome > 0 && monthlyContribution > 0
    ? monthlyContribution / monthlyIncome
    : null;
  const freeMoneyLeftRatio = monthlyIncome > 0 && freeMoneyLeft != null
    ? freeMoneyLeft / monthlyIncome
    : null;
  const targetDate = weeklyContribution > 0 && remaining > 0
    ? addWeeks(new Date(), Math.ceil(remaining / weeklyContribution))
    : remaining <= 0
      ? new Date()
      : null;

  return {
    progress: savingsGoalIncrementalProgress({
      targetAmount,
      currentAmount,
      initialSavedAmount: initialForProgress,
    }),
    remaining,
    weeksToGoal,
    requiredWeekly,
    monthlyContribution,
    weeklyObligationsTotal,
    budgetUseRatio,
    freeMoneyLeftRatio,
    targetDate: targetDate ? formatDateKey(targetDate) : null,
    hint: getSavingsHint(freeMoneyLeftRatio, requiredWeekly, weeklyContribution),
  };
}

function getRequiredWeekly(remaining: number, dueDate?: string) {
  const trimmedDueDate = dueDate?.trim() ?? '';
  const date = new Date(trimmedDueDate);
  if (!trimmedDueDate || Number.isNaN(date.getTime())) return null;
  const weeks = Math.max(
    1,
    Math.ceil((date.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)),
  );
  return Math.max(remaining, 0) / weeks;
}

function getSavingsHint(
  freeMoneyLeftRatio: number | null,
  requiredWeekly: number | null,
  weeklyContribution: number,
) {
  if (requiredWeekly != null && weeklyContribution > 0 && weeklyContribution < requiredWeekly) {
    return "À ce rythme, la date cible risque de ne pas être atteinte.";
  }
  if (freeMoneyLeftRatio == null) {
    return "Entre une contribution hebdomadaire pour estimer sa place dans ton budget.";
  }
  if (freeMoneyLeftRatio < 0) {
    return "Projection prudente: les limites, paiements récurrents et objectifs dépassent les revenus connus.";
  }
  if (freeMoneyLeftRatio < 0.1) {
    return "Projection serrée: garde une marge pour les imprévus.";
  }
  return "Projection confortable après les limites, paiements récurrents et objectifs.";
}

function monthlyEquivalent(payment: RecurringPayment) {
  const amount = toPositiveAmount(payment.amount);
  if (payment.frequency === 'weekly') return amount * 52 / 12;
  if (payment.frequency === 'biweekly') return amount * 26 / 12;
  if (payment.frequency === 'yearly') return amount / 12;
  return amount;
}

function toPositiveAmount(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

function addWeeks(date: Date, weeks: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + weeks * 7);
  return next;
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatGoalDuration(weeks: number) {
  if (weeks < 4) return `${weeks} sem.`;

  const totalDays = weeks * 7;
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  const parts: string[] = [];

  if (months > 0) {
    parts.push(`${months} mois`);
  }
  if (days > 0) {
    parts.push(`${days} jour${days > 1 ? 's' : ''}`);
  }

  return parts.join(' et ') || '0 jour';
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0 %';
  return `${Math.round(value * 100)} %`;
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
  goalsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  goalsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalsHeaderIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    ...interExtraBoldText,
    fontSize: 32,
    letterSpacing: -0.8,
  },
  pageTitleInHeader: {
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  heroEyebrow: {
    marginBottom: 6,
  },
  progressBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  progressBadgeText: {
    ...interBoldText,
    fontSize: 13,
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
  overviewChartWrapper: {
    marginHorizontal: GOALS_PAGE_PADDING,
  },
  overviewChartBlock: {
    gap: spacing.sm,
  },
  overviewHeader: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  overviewTitle: {
    ...SECTION_TITLE_STYLE,
  },
  overviewLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  overviewLegendItem: {
    maxWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  overviewLegendDot: {
    width: 9,
    height: 9,
    borderRadius: 99,
  },
  overviewLegendLabel: {
    flexShrink: 1,
    ...interBoldText,
    fontSize: typography.micro,
  },
  overviewLegendMore: {
    ...interExtraBoldText,
    fontSize: typography.micro,
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
    minHeight: 92,
    gap: spacing.sm,
  },
  goalCardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  goalIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconWell: {
    width: GOAL_ICON_WELL_SIZE,
    height: GOAL_ICON_WELL_SIZE,
    minWidth: GOAL_ICON_WELL_SIZE,
    minHeight: GOAL_ICON_WELL_SIZE,
    flexShrink: 0,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCardHeadText: { flex: 1, minWidth: 0, gap: 5 },
  goalName: {
    ...rowLabel,
    ...interExtraBoldText,
  },
  goalMeta: {
    ...interBoldText,
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  goalAmountBlock: {
    flexShrink: 0,
    minWidth: 96,
    maxWidth: 124,
    alignItems: 'flex-end',
    gap: 5,
  },
  goalPctPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  goalPct: {
    ...portfolioNumericText,
    fontSize: typography.micro,
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

  // Detail sheet
  detailSheet: {
    borderTopLeftRadius: DETAIL_SHEET_TOP_RADIUS,
    borderTopRightRadius: DETAIL_SHEET_TOP_RADIUS,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  detailGoalName: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.dashboardGreeting,
    fontWeight: '800',
  },
  detailActionBtn: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    height: 36,
    borderRadius: 14,
  },
  modifierLabel: {
    fontSize: typography.micro,
    fontWeight: '700',
  },
  detailCloseBtn: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 14,
  },
  detailBtnPressed: { opacity: 0.72 },
  detailAmount: {
    ...portfolioNumericText,
    fontSize: 32,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  detailAmountOf: {
    ...portfolioNumericText,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  detailHero: {
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  detailHeroEyebrow: {
    fontSize: typography.micro,
    fontWeight: '900',
    letterSpacing: 0.58,
    textTransform: 'uppercase',
  },
  detailHeroProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailHeroMeta: { fontSize: typography.caption, fontWeight: '700' },
  detailProgressTrack: {
    flex: 1,
    height: PROGRESS_BAR_TRACK_HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  detailProgressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  detailPct: {
    ...portfolioNumericText,
    fontSize: typography.meta,
    minWidth: 44,
    textAlign: 'right',
  },
  detailChartBlock: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  historyWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius.card,
    marginBottom: spacing.md,
  },
  historyWideText: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  detailSectionLabel: {
    fontSize: typography.micro,
    fontWeight: '900',
    letterSpacing: 0.58,
    textTransform: 'uppercase',
  },
  detailMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  detailMetaCell: {
    width: '50%',
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  detailMetaCellWide: {
    width: '100%',
  },
  detailInfoLabel: { fontSize: typography.micro, fontWeight: '600', marginBottom: 2 },
  detailInfoValue: { ...rowValue, fontSize: typography.meta },
  detailProjectionPanel: {
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  detailProjectionTitle: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  detailProjectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailProjectionLabel: {
    flex: 1,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  detailProjectionValue: {
    ...rowValue,
    textAlign: 'right',
  },
  detailProjectionHint: {
    fontSize: typography.caption,
    lineHeight: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  deleteButtonPressed: { opacity: 0.72 },
  deleteText: {
    fontSize: typography.meta,
    fontWeight: '800',
  },
});

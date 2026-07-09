import { type Dispatch, type SetStateAction, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePickerField } from '@/components/MinimalDatePicker';
import { GoalSparkChartCarousel } from '@/components/GoalSparkChartCarousel';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { formValidationError, type FormFeedback, type FormSaveResult } from '@/lib/formFeedback';
import { tapHaptic } from '@/lib/haptics';
import {
  convertContributionAmountBetweenFrequencies,
  fromWeeklyContributionAmount,
  SAVINGS_GOAL_CONTRIBUTION_FREQUENCIES,
  savingsGoalContributionFrequencyLabel,
  toWeeklyContributionAmount,
  type SavingsGoalContributionFrequency,
} from '@/lib/savingsGoalContribution';
import { ProgressBar } from '@/components/ProgressBar';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { SCREEN_TOP_GUTTER, ghost, ghostCardShadow } from '@/constants/ghostUi';
import { LINEAR_CHART_ACCENT_LIGHT } from '@/constants/linearChart';
import {
  CHIP_BORDER_WIDTH,
  CHIP_PADDING_HORIZONTAL,
  FLOATING_NAV_CONTENT_PADDING,
  getGoalGreenShade,
  PAGE_TITLE_CONTENT_GAP,
  colors,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { getCategoryBudgets, getDashboard, getRecurringPayments, getSavingsGoals, upsertSavingsGoal } from '@/lib/db';
import { savingsGoalIncrementalProgress } from '@/lib/savingsGoalProgress';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { parseFormattedNumber, sanitizeNumericInput, formatNumberDisplay } from '@/lib/formatNumber';
import { chipLabelTextProps, singleLineLabelStyle } from '@/lib/textLayout';
import type { CategoryBudget, DashboardSummary, RecurringPayment, SavingsGoal } from '@/types';

export type GoalForm = {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  /** Sentinel '' on new goal → set from currentAmount on first save; persisted on edit. */
  initialSavedAmount: string;
  weeklyContribution: string;
  contributionFrequency: SavingsGoalContributionFrequency;
  dueDate: string;
  color: string;
  icon: string;
  iconMode: IconSelectionMode;
  createdAt: string;
};

type IconName = keyof typeof Ionicons.glyphMap;
type IconSelectionMode = 'auto' | 'manual';

const DEFAULT_COLOR = LINEAR_CHART_ACCENT_LIGHT;
const DEFAULT_ICON: IconName = 'flag-outline';

export function createNewGoalForm(): GoalForm {
  const id = createLocalId();
  return {
    id,
    name: '',
    targetAmount: '',
    currentAmount: '',
    initialSavedAmount: '',
    weeklyContribution: '',
    contributionFrequency: 'weekly',
    dueDate: '',
    color: getGoalGreenShade(id, true),
    icon: DEFAULT_ICON,
    iconMode: 'auto',
    createdAt: new Date().toISOString(),
  };
}

export type NewGoalFormSuggestion = {
  name: string;
  targetAmount?: number;
  icon?: string;
};

export function createNewGoalFormFromSuggestion(suggestion: NewGoalFormSuggestion): GoalForm {
  const form = createNewGoalForm();
  return {
    ...form,
    name: suggestion.name,
    icon: suggestion.icon ?? getAutomaticGoalIcon(suggestion.name),
    targetAmount:
      suggestion.targetAmount != null && suggestion.targetAmount > 0
        ? String(suggestion.targetAmount)
        : '',
  };
}

export function createGoalEditForm(goal: SavingsGoal): GoalForm {
  const frequency = (goal.contributionFrequency ?? 'weekly') as SavingsGoalContributionFrequency;
  const weeklyStored = goal.weeklyContribution ?? 0;
  const displayAmount =
    weeklyStored > 0 ? fromWeeklyContributionAmount(weeklyStored, frequency) : 0;

  return {
    id: goal.id,
    name: goal.name,
    targetAmount: String(goal.targetAmount || ''),
    currentAmount: String(goal.currentAmount || ''),
    initialSavedAmount: String(goal.initialSavedAmount ?? 0),
    weeklyContribution: displayAmount > 0 ? String(displayAmount) : '',
    contributionFrequency: frequency,
    dueDate: goal.dueDate ?? '',
    color: getGoalGreenShade(goal.id, true),
    icon: getAutomaticGoalIcon(goal.name),
    iconMode: 'auto',
    createdAt: goal.createdAt,
  };
}

export function SavingsGoalFormModal({
  form,
  setForm,
  goals,
  dashboard,
  categoryBudgets,
  recurringPayments,
  saving,
  onDismiss,
  onSave,
  feedback,
}: {
  form: GoalForm | null;
  setForm: Dispatch<SetStateAction<GoalForm | null>>;
  goals: SavingsGoal[];
  dashboard: DashboardSummary | null;
  categoryBudgets: CategoryBudget[];
  recurringPayments: RecurringPayment[];
  saving: boolean;
  feedback?: FormFeedback | null;
  onDismiss: () => void;
  onSave: () => void | Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const { colors: themeColors, ghost: themeGhost, isLight } = useAppTheme();
  const projection = useMemo(
    () => getGoalProjection(form, dashboard, categoryBudgets, recurringPayments, goals),
    [categoryBudgets, dashboard, form, goals, recurringPayments],
  );
  const suggestedWeekly = projection?.requiredWeekly ?? null;
  const contributionFrequency = form?.contributionFrequency ?? 'weekly';
  const suggestedAtFrequency =
    suggestedWeekly != null
      ? fromWeeklyContributionAmount(suggestedWeekly, contributionFrequency)
      : null;
  const contributionPlaceholder = suggestedAtFrequency != null
    ? `${formatSuggestedAmount(suggestedAtFrequency)} $ minimum`
    : '75';
  const weeklyFeedback = projection ? getWeeklyContributionFeedback(projection) : null;
  const enteredContribution = form?.weeklyContribution.trim()
    ? parseAmount(form.weeklyContribution)
    : null;
  const enteredWeekly =
    enteredContribution != null && !Number.isNaN(enteredContribution)
      ? toWeeklyContributionAmount(enteredContribution, contributionFrequency)
      : null;
  const isWeeklyBelowSuggestion =
    suggestedWeekly != null &&
    enteredWeekly != null &&
    !Number.isNaN(enteredWeekly) &&
    enteredWeekly >= 0 &&
    enteredWeekly < suggestedWeekly * 0.995;
  const themed = useMemo(
    () => ({
      modalBackdrop: { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' },
      sheet: { backgroundColor: themeColors.containerBackground, borderColor: themeColors.containerBorder },
      handle: { backgroundColor: themeColors.borderStrong },
      closeButton: { backgroundColor: themeGhost.obsidianSoft },
      selected: { backgroundColor: themeColors.text },
      selectedText: { color: themeGhost.void },
      text: { color: themeColors.text },
      textMuted: { color: themeColors.textMuted },
      warningCard: {
        backgroundColor: isLight ? 'rgba(201, 111, 26, 0.10)' : 'rgba(255, 177, 92, 0.12)',
        borderColor: themeColors.warning,
      },
      warningText: { color: themeColors.warning },
      submitDisabled: { backgroundColor: themeGhost.obsidianSoft },
    }),
    [isLight, themeColors, themeGhost],
  );
  const selectedColor = form ? getGoalGreenShade(form.id, isLight) : LINEAR_CHART_ACCENT_LIGHT;
  const chartCarouselTone = useMemo(
    () => ({
      stroke: selectedColor,
      grid: isLight ? 'rgba(15,23,42,0.2)' : 'rgba(255,255,255,0.14)',
      fill: isLight ? 'rgba(5,150,105,0.08)' : 'rgba(0,250,154,0.09)',
    }),
    [isLight, selectedColor],
  );
  const resolvedIcon = form ? getAutomaticGoalIcon(form.name) : DEFAULT_ICON;

  return (
    <Modal visible={form != null} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={[styles.modalBackdrop, themed.modalBackdrop]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalKeyboard}
        >
          <View style={[styles.modalCard, themed.sheet]}>
            <View style={[styles.handle, themed.handle]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, themed.text]}>{form?.name ? 'Modifier' : 'Nouvel objectif'}</Text>
              <Pressable onPress={onDismiss} hitSlop={12} style={[styles.modalClose, themed.closeButton]}>
                <AppIcon family="ionicons" name="close" size={19} color={themeColors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.modalContent,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <GoalKindHeader
                name={form?.name ?? ''}
                resolvedIcon={resolvedIcon}
                onChangeName={(value) =>
                  setForm((cur) =>
                    cur
                      ? {
                          ...cur,
                          name: value,
                          icon: getAutomaticGoalIcon(value),
                          iconMode: 'auto',
                        }
                      : cur,
                  )
                }
              />
              {form != null && goals.some((g) => g.id === form.id) ? (
                <GoalSparkChartCarousel
                  goals={goals}
                  focusGoalId={form.id}
                  stroke={chartCarouselTone.stroke}
                  areaFill={chartCarouselTone.fill}
                  gridColor={chartCarouselTone.grid}
                  labelColor={themeColors.textMuted}
                  captionColor={themeColors.textSecondary}
                  captionTemplate="Courbe · %s"
                />
              ) : null}
              <View style={styles.twoCols}>
                <FormField
                  label="Cible"
                  value={form?.targetAmount ?? ''}
                  placeholder="5000"
                  keyboardType="decimal-pad"
                  onChangeText={(value) =>
                    setForm((cur) => (cur ? { ...cur, targetAmount: sanitizeAmount(value) } : cur))
                  }
                />
                <FormField
                  label="Épargné"
                  value={form?.currentAmount ?? ''}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  onChangeText={(value) =>
                    setForm((cur) => (cur ? { ...cur, currentAmount: sanitizeAmount(value) } : cur))
                  }
                />
              </View>
              <DatePickerField
                label="Date cible (optionnelle)"
                value={form?.dueDate ?? ''}
                placeholder="Aucune date maximale"
                allowClear
                variant="sheet"
                onChangeDate={(value) => setForm((cur) => (cur ? { ...cur, dueDate: value } : cur))}
              />
              <FormField
                label="Montant des versements"
                value={form?.weeklyContribution ?? ''}
                placeholder={contributionPlaceholder}
                keyboardType="decimal-pad"
                onChangeText={(value) =>
                  setForm((cur) => (cur ? { ...cur, weeklyContribution: sanitizeAmount(value) } : cur))
                }
              />
              <ContributionFrequencyField
                frequency={contributionFrequency}
                onSelectFrequency={(frequency) =>
                  setForm((cur) => {
                    if (!cur) return cur;
                    const currentAmount = cur.weeklyContribution.trim()
                      ? parseAmount(cur.weeklyContribution)
                      : null;
                    let nextAmount = cur.weeklyContribution;
                    if (
                      currentAmount != null &&
                      !Number.isNaN(currentAmount) &&
                      currentAmount > 0 &&
                      frequency !== cur.contributionFrequency
                    ) {
                      nextAmount = formatSuggestedAmount(
                        convertContributionAmountBetweenFrequencies(
                          currentAmount,
                          cur.contributionFrequency,
                          frequency,
                        ),
                      );
                    }
                    return {
                      ...cur,
                      contributionFrequency: frequency,
                      weeklyContribution: nextAmount,
                    };
                  })
                }
                themed={themed}
              />
              {suggestedWeekly != null ? (
                <Text style={[styles.minimumHint, themed.textMuted]}>
                  Minimum requis pour atteindre la date cible: {formatSuggestedAmount(suggestedAtFrequency ?? suggestedWeekly)} $ {savingsGoalContributionFrequencyLabel(contributionFrequency).toLowerCase()}.
                </Text>
              ) : null}
              {isWeeklyBelowSuggestion && suggestedWeekly != null ? (
                <View style={[styles.weeklyWarning, themed.warningCard]}>
                  <Text style={[styles.weeklyWarningText, themed.warningText]}>
                    Ce montant ne permettra pas d'atteindre la date cible. Entre au moins{' '}
                    {formatSuggestedAmount(suggestedAtFrequency ?? suggestedWeekly)} $ {savingsGoalContributionFrequencyLabel(contributionFrequency).toLowerCase()} pour la respecter.
                  </Text>
                </View>
              ) : null}
              {!isWeeklyBelowSuggestion && weeklyFeedback ? (
                <Text style={[styles.minimumHint, themed.textMuted]}>{weeklyFeedback}</Text>
              ) : null}

              {projection ? <GoalProjectionCard projection={projection} /> : null}

              {feedback ? (
                <ThemedFormMessage
                  variant={feedback.variant}
                  title={feedback.title}
                  message={feedback.message}
                />
              ) : null}

              <PrimarySaveButton
                label={saving ? 'Enregistrement...' : 'Enregistrer'}
                onPress={() => void onSave()}
                disabled={saving}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function ContributionFrequencyField({
  frequency,
  onSelectFrequency,
  themed,
}: {
  frequency: SavingsGoalContributionFrequency;
  onSelectFrequency: (frequency: SavingsGoalContributionFrequency) => void;
  themed: {
    selected: { backgroundColor: string };
    selectedText: { color: string };
    text: { color: string };
  };
}) {
  const { colors, ghost } = useAppTheme();

  return (
    <View style={styles.frequencyField}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Fréquence des versements</Text>
      <View style={styles.frequencyRow}>
        {SAVINGS_GOAL_CONTRIBUTION_FREQUENCIES.map((item) => {
          const on = frequency === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                tapHaptic();
                onSelectFrequency(item.id);
              }}
              style={[
                styles.frequencyChip,
                { backgroundColor: ghost.obsidianSoft, borderColor: colors.borderStrong },
                on && themed.selected,
              ]}
            >
              <Text
                style={[styles.frequencyChipText, singleLineLabelStyle, themed.text, on && themed.selectedText]}
                {...chipLabelTextProps()}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function FormField({
  label,
  value,
  placeholder,
  keyboardType,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad';
  onChangeText: (value: string) => void;
}) {
  const { colors, ghost } = useAppTheme();
  const InputComponent = keyboardType === 'decimal-pad' ? NumericAmountInput : TextInput;

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <InputComponent
        style={[
          styles.input,
          { backgroundColor: ghost.obsidianSoft, borderColor: colors.borderStrong, color: colors.text },
        ]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

function GoalKindHeader({
  name,
  resolvedIcon,
  onChangeName,
}: {
  name: string;
  resolvedIcon: string;
  onChangeName: (value: string) => void;
}) {
  const { colors, ghost } = useAppTheme();

  return (
    <View
      style={[styles.goalKindHeader, { backgroundColor: ghost.obsidianSoft, borderColor: colors.borderStrong }]}
    >
      <UserPickedIconWell icon={resolvedIcon} size={52} wellGlyphWhite />
      <TextInput
        style={[styles.goalKindName, { color: colors.text }]}
        value={name}
        onChangeText={onChangeName}
        placeholder="Ex. Fonds d'urgence"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Nom de l'objectif"
      />
    </View>
  );
}


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

function GoalProjectionCard({ projection }: { projection: GoalProjection }) {
  const { colors, ghost } = useAppTheme();

  return (
    <View style={[styles.projectionCard, { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder }]}>
      <Text style={[styles.projectionTitle, { color: colors.text }]}>Projection</Text>
      <ProjectionRow label="Progression" value={formatPercent(projection.progress)} />
      <ProjectionRow label="Reste à épargner" value={formatDisplayMoneyAbsolute(projection.remaining)} />
      {projection.weeksToGoal != null ? (
        <ProjectionRow label="Durée au rythme choisi" value={formatGoalDuration(projection.weeksToGoal)} />
      ) : null}
      {projection.requiredWeekly != null ? (
        <ProjectionRow label="Requis par semaine" value={formatDisplayMoneyAbsolute(projection.requiredWeekly)} />
      ) : null}
      {projection.targetDate != null && projection.requiredWeekly == null ? (
        <ProjectionRow label="Date estimée d'atteinte" value={projection.targetDate} />
      ) : null}
      {projection.monthlyContribution > 0 ? (
        <ProjectionRow label="Montant par mois" value={formatDisplayMoneyAbsolute(projection.monthlyContribution)} />
      ) : null}
      {projection.budgetUseRatio != null && projection.monthlyContribution > 0 ? (
        <ProjectionRow label="Part du budget" value={formatPercent(projection.budgetUseRatio)} />
      ) : null}
      {projection.weeklyObligationsTotal > 0 ? (
        <ProjectionRow
          label="Obligations + objectif / semaine"
          value={`${formatDisplayMoneyAbsolute(projection.weeklyObligationsTotal)} / semaine`}
        />
      ) : null}
      <Text style={[styles.projectionHint, { color: colors.textMuted }]}>{projection.hint}</Text>
    </View>
  );
}

function ProjectionRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.projectionRow}>
      <Text style={[styles.projectionLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.projectionValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function createLocalId() {
  return `goal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function saveSavingsGoalForm(form: GoalForm, isLight: boolean): Promise<FormSaveResult> {
  const name = form.name.trim();
  const targetAmount = parseAmount(form.targetAmount);
  const currentAmount = parseAmount(form.currentAmount || '0');
  const contributionAmount = form.weeklyContribution.trim()
    ? parseAmount(form.weeklyContribution)
    : undefined;
  const weeklyContribution =
    contributionAmount != null
      ? toWeeklyContributionAmount(contributionAmount, form.contributionFrequency)
      : undefined;

  if (!name) {
    return formValidationError('Nom requis', 'Ajoute un nom pour ton objectif.');
  }
  if (Number.isNaN(targetAmount) || targetAmount <= 0) {
    return formValidationError('Cible invalide', 'Entre un montant cible supérieur à 0.');
  }
  if (Number.isNaN(currentAmount) || currentAmount < 0) {
    return formValidationError('Montant invalide', 'Entre un montant épargné positif ou 0.');
  }
  if (
    form.weeklyContribution.trim() &&
    (contributionAmount == null ||
      Number.isNaN(contributionAmount) ||
      contributionAmount < 0 ||
      weeklyContribution == null ||
      Number.isNaN(weeklyContribution) ||
      weeklyContribution < 0)
  ) {
    return formValidationError('Contribution invalide', 'Entre un montant de versement positif ou 0.');
  }

  let initialSavedAmount: number;
  if (!form.initialSavedAmount.trim()) {
    initialSavedAmount = currentAmount;
  } else {
    initialSavedAmount = parseAmount(form.initialSavedAmount);
    if (Number.isNaN(initialSavedAmount) || initialSavedAmount < 0) {
      return formValidationError('Montant invalide', 'Réessaie avec un montant initial valide.');
    }
  }
  initialSavedAmount = Math.min(Math.max(initialSavedAmount, 0), currentAmount);

  await upsertSavingsGoal({
    id: form.id,
    name,
    targetAmount,
    currentAmount,
    initialSavedAmount,
    weeklyContribution,
    contributionFrequency: form.contributionFrequency,
    dueDate: form.dueDate.trim() || undefined,
    color: getGoalGreenShade(form.id, isLight),
    icon: getSelectedGoalIcon(form),
    createdAt: form.createdAt,
  });

  return true;
}

function getGoalProjection(
  form: GoalForm | null,
  dashboard: DashboardSummary | null,
  categoryBudgets: CategoryBudget[],
  recurringPayments: RecurringPayment[],
  goals: SavingsGoal[],
): GoalProjection | null {
  if (!form) return null;
  const targetAmount = parseAmount(form.targetAmount || '0');
  const currentAmount = parseAmount(form.currentAmount || '0');
  const contributionAmount = form.weeklyContribution.trim()
    ? parseAmount(form.weeklyContribution)
    : 0;
  const weeklyContribution = toWeeklyContributionAmount(
    contributionAmount,
    form.contributionFrequency ?? 'weekly',
  );

  if (
    Number.isNaN(targetAmount) ||
    Number.isNaN(currentAmount) ||
    Number.isNaN(contributionAmount) ||
    Number.isNaN(weeklyContribution) ||
    targetAmount < 0 ||
    currentAmount < 0 ||
    contributionAmount < 0 ||
    weeklyContribution < 0
  ) {
    return null;
  }

  const initialSavedRaw = form.initialSavedAmount.trim()
    ? parseAmount(form.initialSavedAmount)
    : currentAmount;
  if (Number.isNaN(initialSavedRaw) || initialSavedRaw < 0) {
    return null;
  }
  const initialForProgress = Math.min(initialSavedRaw, currentAmount);

  const remaining = Math.max(0, targetAmount - currentAmount);
  const weeksToGoal = weeklyContribution > 0 && remaining > 0
    ? Math.ceil(remaining / weeklyContribution)
    : null;
  const requiredWeekly = getRequiredWeekly(remaining, form.dueDate);
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

function getRequiredWeekly(remaining: number, dueDate: string) {
  const date = new Date(dueDate.trim());
  if (!dueDate.trim() || Number.isNaN(date.getTime())) return null;
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
    return 'À ce rythme, la date cible risque de ne pas être atteinte.';
  }
  if (freeMoneyLeftRatio == null) {
    return 'Entre une contribution hebdomadaire pour estimer sa place dans ton budget.';
  }
  if (freeMoneyLeftRatio < 0) {
    return 'Projection prudente: les limites, paiements récurrents et objectifs dépassent les revenus connus.';
  }
  if (freeMoneyLeftRatio < 0.1) {
    return 'Projection serrée: garde une marge pour les imprévus.';
  }
  return 'Projection confortable après les limites, paiements récurrents et objectifs.';
}

function getWeeklyContributionFeedback(projection: GoalProjection) {
  if (projection.requiredWeekly == null || projection.monthlyContribution <= 0) return null;
  const weeklyContribution = (projection.monthlyContribution * 12) / 52;
  if (weeklyContribution < projection.requiredWeekly) return null;
  if (weeklyContribution <= projection.requiredWeekly * 1.05) {
    return 'Ça va être serré, mais réalisable avec de la rigueur.';
  }
  return projection.targetDate
    ? `À ce rythme, tu atteindras l'objectif vers le ${projection.targetDate}.`
    : null;
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

function getSelectedGoalIcon(form: GoalForm): string {
  return getAutomaticGoalIcon(form.name);
}

function getAutomaticGoalIcon(name: string): string {
  const normalized = normalizeSearchText(name);
  if (matchesAny(normalized, ['urgence', 'emergency', 'securite', 'securité'])) return 'shield-check-outline';
  if (matchesAny(normalized, ['voyage', 'vacance', 'vacances', 'travel', 'trip', 'avion'])) return 'airplane-outline';
  if (matchesAny(normalized, ['maison', 'condo', 'logement', 'hypotheque', 'home'])) return 'home-outline';
  if (matchesAny(normalized, ['auto', 'voiture', 'vehicule', 'car'])) return 'car-outline';
  if (matchesAny(normalized, ['ecole', 'etude', 'universite', 'cours', 'school'])) return 'school-outline';
  if (matchesAny(normalized, ['cadeau', 'noel', 'anniversaire', 'gift'])) return 'gift-outline';
  if (matchesAny(normalized, ['mariage', 'amour', 'couple', 'coeur'])) return 'heart-outline';
  if (matchesAny(normalized, ['entreprise', 'business', 'travail', 'projet'])) return 'briefcase-outline';
  if (matchesAny(normalized, ['velo', 'bicycle'])) return 'bicycle-outline';
  if (matchesAny(normalized, ['retraite', 'placement', 'investissement', 'reer', 'celi'])) return 'trophy-outline';
  if (matchesAny(normalized, ['luxe', 'bijou', 'diamant'])) return 'diamond-outline';
  if (matchesAny(normalized, ['cash', 'argent', 'epargne', 'fonds'])) return 'cash-outline';
  return DEFAULT_ICON;
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function matchesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function sanitizeAmount(value: string) {
  return sanitizeNumericInput(value);
}

function parseAmount(value: string) {
  return parseFormattedNumber(value);
}

function formatSuggestedAmount(value: number) {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) {
    return formatNumberDisplay(rounded, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return formatNumberDisplay(rounded, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0 %';
  return `${Math.round(value * 100)} %`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: PAGE_TITLE_CONTENT_GAP,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
  topTitle: {
    color: ghost.muted,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 2.7,
    textTransform: 'uppercase',
  },
  scroller: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  summaryCardInner: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: typography.meta,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  total: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  helper: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 20 },
  list: { gap: spacing.md },
  cardInner: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pressedCard: { opacity: 0.82 },
  iconWell: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, minWidth: 0, gap: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cardTitle: { flex: 1, color: colors.text, fontSize: typography.body, fontWeight: '800' },
  percent: { fontSize: typography.body, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: typography.micro, fontWeight: '600' },
  dueDate: { color: colors.textMuted, fontSize: typography.micro, fontWeight: '600' },
  emptyCardInner: {
    gap: spacing.sm,
  },
  emptyTitle: { color: colors.text, fontSize: typography.body, fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  modalKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: ghost.obsidian,
    marginTop: 88,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '92%',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: 12,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: { gap: 14, paddingTop: 14 },
  field: { flex: 1, gap: spacing.sm },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  input: {
    minHeight: 50,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: ghost.obsidianSoft,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  twoCols: { flexDirection: 'row', gap: spacing.md },
  frequencyField: { gap: spacing.sm },
  frequencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  frequencyChip: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 96,
    borderRadius: radius.md,
    borderWidth: CHIP_BORDER_WIDTH,
    paddingHorizontal: CHIP_PADDING_HORIZONTAL,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frequencyChipText: {
    maxWidth: '100%',
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
  },
  goalKindHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  goalKindName: {
    flex: 1,
    minWidth: 0,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    paddingVertical: 4,
  },
  minimumHint: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: -6,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  suggestionText: { flex: 1, color: colors.text, fontSize: typography.caption, fontWeight: '800', lineHeight: 18 },
  weeklyWarning: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  weeklyWarningText: { color: colors.warning, fontSize: typography.caption, fontWeight: '700', lineHeight: 20 },
  suggestionButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  suggestionButtonText: { color: '#000000', fontSize: typography.micro, fontWeight: '800' },
  projectionCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: ghost.obsidianSoft,
    padding: spacing.md,
    gap: spacing.sm,
  },
  projectionTitle: { color: colors.text, fontSize: typography.body, fontWeight: '800' },
  projectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  projectionLabel: { flex: 1, color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  projectionValue: { color: colors.text, fontSize: typography.caption, fontWeight: '800' },
  projectionHint: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 20 },
  saveBtn: {
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: colors.primary,
    paddingVertical: 17,
  },
  disabled: { opacity: 0.45 },
  saveText: { color: '#000000', fontSize: 18, fontWeight: '800' },
});

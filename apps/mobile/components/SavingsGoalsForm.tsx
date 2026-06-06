import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePickerField } from '@/components/MinimalDatePicker';
import { GoalSparkChartCarousel } from '@/components/GoalSparkChartCarousel';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ProgressBar } from '@/components/ProgressBar';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import {
  resolveUserPickedIconGlyphColor,
  resolveUserPickedIconWellBackground,
} from '@/lib/userPickedIcon';
import { SCREEN_TOP_GUTTER, ghost, ghostCardShadow } from '@/constants/ghostUi';
import { GOAL_ICON_PICKER_OPTIONS } from '@/constants/categoryOptions';
import { FLOATING_NAV_CONTENT_PADDING, PAGE_TITLE_CONTENT_GAP, colors, radius, spacing, typography } from '@/constants/theme';
import { getCategoryBudgets, getDashboard, getRecurringPayments, getSavingsGoals, upsertSavingsGoal } from '@/lib/db';
import { savingsGoalIncrementalProgress } from '@/lib/savingsGoalProgress';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import type { CategoryBudget, DashboardSummary, RecurringPayment, SavingsGoal } from '@/types';

export type GoalForm = {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  /** Sentinel '' on new goal → set from currentAmount on first save; persisted on edit. */
  initialSavedAmount: string;
  weeklyContribution: string;
  dueDate: string;
  color: string;
  icon: string;
  iconMode: IconSelectionMode;
  createdAt: string;
};

type IconName = keyof typeof Ionicons.glyphMap;
type IconSelectionMode = 'auto' | 'manual';

const GOAL_COLOR_OPTIONS = [
  '#10B981',
  '#38BDF8',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#FB7185',
  '#14B8A6',
  '#64748B',
  '#22C55E',
];
const DEFAULT_COLOR = GOAL_COLOR_OPTIONS[0]!;
const DEFAULT_ICON: IconName = 'flag-outline';

export function createNewGoalForm(): GoalForm {
  return {
    id: createLocalId(),
    name: '',
    targetAmount: '',
    currentAmount: '',
    initialSavedAmount: '',
    weeklyContribution: '',
    dueDate: '',
    color: DEFAULT_COLOR,
    icon: DEFAULT_ICON,
    iconMode: 'auto',
    createdAt: new Date().toISOString(),
  };
}

export function createGoalEditForm(goal: SavingsGoal): GoalForm {
  const automaticIcon = getAutomaticGoalIcon(goal.name);

  return {
    id: goal.id,
    name: goal.name,
    targetAmount: String(goal.targetAmount || ''),
    currentAmount: String(goal.currentAmount || ''),
    initialSavedAmount: String(goal.initialSavedAmount ?? 0),
    weeklyContribution: String(goal.weeklyContribution || ''),
    dueDate: goal.dueDate ?? '',
    color: goal.color || DEFAULT_COLOR,
    icon: goal.icon || DEFAULT_ICON,
    iconMode: goal.icon === automaticIcon ? 'auto' : 'manual',
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
  iconPickerExpanded,
  setIconPickerExpanded,
  onDismiss,
  onSave,
}: {
  form: GoalForm | null;
  setForm: Dispatch<SetStateAction<GoalForm | null>>;
  goals: SavingsGoal[];
  dashboard: DashboardSummary | null;
  categoryBudgets: CategoryBudget[];
  recurringPayments: RecurringPayment[];
  saving: boolean;
  iconPickerExpanded: boolean;
  setIconPickerExpanded: Dispatch<SetStateAction<boolean>>;
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
  const weeklyPlaceholder = suggestedWeekly != null
    ? `${formatSuggestedAmount(suggestedWeekly)} $ minimum`
    : '75';
  const weeklyFeedback = projection ? getWeeklyContributionFeedback(projection) : null;
  const enteredWeekly = form?.weeklyContribution.trim()
    ? parseAmount(form.weeklyContribution)
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
      sheet: { backgroundColor: themeColors.surfaceSolid, borderColor: themeColors.border },
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
  const selectedColor = normalizeColor(form?.color ?? DEFAULT_COLOR);
  const chartCarouselTone = useMemo(
    () => ({
      stroke: selectedColor,
      grid: isLight ? 'rgba(15,23,42,0.2)' : 'rgba(255,255,255,0.14)',
      fill: isLight ? 'rgba(5,150,105,0.08)' : 'rgba(0,250,154,0.09)',
    }),
    [isLight, selectedColor],
  );
  const selectedIcon = form ? getSelectedGoalIcon(form) : DEFAULT_ICON;
  const automaticIcon = form ? getAutomaticGoalIcon(form.name) : DEFAULT_ICON;

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
                <Ionicons name="close" size={19} color={themeColors.textMuted} />
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
              <GoalIconSelector
                selectedIcon={selectedIcon}
                selectedColor={selectedColor}
                automaticIcon={automaticIcon}
                mode={form?.iconMode ?? 'auto'}
                expanded={iconPickerExpanded}
                onToggle={() => {
                  tapHaptic();
                  setIconPickerExpanded((value) => !value);
                }}
                onSelectAuto={() => {
                  tapHaptic();
                  setForm((cur) => (cur ? { ...cur, iconMode: 'auto', icon: getAutomaticGoalIcon(cur.name) } : cur));
                  setIconPickerExpanded(false);
                }}
                onSelectManual={(icon) => {
                  tapHaptic();
                  setForm((cur) => (cur ? { ...cur, icon, iconMode: 'manual' } : cur));
                  setIconPickerExpanded(false);
                }}
              />
              <ColorPicker
                selectedColor={selectedColor}
                onSelect={(color) => setForm((cur) => (cur ? { ...cur, color } : cur))}
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
              <FormField
                label="Nom"
                value={form?.name ?? ''}
                placeholder="Ex. Fonds d'urgence"
                onChangeText={(value) => setForm((cur) => (cur ? { ...cur, name: value } : cur))}
              />
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
              <Text style={[styles.fieldHint, themed.textMuted]}>
                « Épargné » est le solde total (y compris ce qui était déjà mis de côté à la création). Le pourcentage
                mesure la progression sur le reste à épargner après ce point de départ.
              </Text>
              <DatePickerField
                label="Date cible (optionnelle)"
                value={form?.dueDate ?? ''}
                placeholder="Aucune date maximale"
                allowClear
                variant="sheet"
                onChangeDate={(value) => setForm((cur) => (cur ? { ...cur, dueDate: value } : cur))}
              />
              <FormField
                label="Par semaine"
                value={form?.weeklyContribution ?? ''}
                placeholder={weeklyPlaceholder}
                keyboardType="decimal-pad"
                onChangeText={(value) =>
                  setForm((cur) => (cur ? { ...cur, weeklyContribution: sanitizeAmount(value) } : cur))
                }
              />
              {suggestedWeekly != null ? (
                <Text style={[styles.minimumHint, themed.textMuted]}>
                  Minimum requis pour atteindre la date cible: {formatSuggestedAmount(suggestedWeekly)} $ par semaine.
                </Text>
              ) : null}
              {isWeeklyBelowSuggestion && suggestedWeekly != null ? (
                <View style={[styles.weeklyWarning, themed.warningCard]}>
                  <Text style={[styles.weeklyWarningText, themed.warningText]}>
                    Ce montant ne permettra pas d'atteindre la date cible. Entre au moins{' '}
                    {formatSuggestedAmount(suggestedWeekly)} $ / semaine pour la respecter.
                  </Text>
                </View>
              ) : null}
              {!isWeeklyBelowSuggestion && weeklyFeedback ? (
                <Text style={[styles.minimumHint, themed.textMuted]}>{weeklyFeedback}</Text>
              ) : null}

              {projection ? <GoalProjectionCard projection={projection} /> : null}

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

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
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

function GoalIconSelector({
  selectedIcon,
  selectedColor,
  automaticIcon,
  mode,
  expanded,
  onToggle,
  onSelectAuto,
  onSelectManual,
}: {
  selectedIcon: IconName;
  selectedColor: string;
  automaticIcon: IconName;
  mode: IconSelectionMode;
  expanded: boolean;
  onToggle: () => void;
  onSelectAuto: () => void;
  onSelectManual: (icon: IconName) => void;
}) {
  const { colors, ghost, isLight } = useAppTheme();
  const pickerOptions = useMemo(() => {
    const options = [...GOAL_ICON_PICKER_OPTIONS];
    if (isIconName(selectedIcon) && !options.some((option) => option.icon === selectedIcon)) {
      options.unshift({
        id: 'custom',
        label: 'Personnalisé',
        icon: selectedIcon,
        color: normalizeColor(selectedColor) || colors.primary,
      });
    }
    return options;
  }, [colors.primary, selectedColor, selectedIcon]);
  const defaultGlyph = resolveUserPickedIconGlyphColor(null, isLight, colors);

  return (
    <View style={[styles.iconSelector, { backgroundColor: ghost.obsidianSoft, borderColor: colors.borderStrong }]}>
      <View style={styles.iconSelectorTop}>
        <UserPickedIconBadge icon={selectedIcon} color={selectedColor} size={52} iconSize={28} />
        <View style={styles.iconSelectorCopy}>
          <Text style={[styles.iconSelectorLabel, { color: colors.text }]}>
            {mode === 'auto' ? 'Icône automatique' : 'Icône choisie'}
          </Text>
          <Text style={[styles.iconSelectorMeta, { color: colors.textMuted }]}>
            {mode === 'auto' ? "Adaptée au nom de l'objectif" : 'Choix personnalisé'}
          </Text>
        </View>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel="Modifier l'icône"
          hitSlop={10}
          style={({ pressed }) => [styles.iconEditButton, { borderColor: colors.border }, pressed && styles.pressed]}
        >
          <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
      {expanded ? (
        <View style={styles.iconGrid}>
          <Pressable
            onPress={onSelectAuto}
            accessibilityRole="button"
            accessibilityLabel="Utiliser l'icône automatique"
            style={({ pressed }) => [
              styles.autoIconChoice,
              { backgroundColor: resolveUserPickedIconWellBackground(isLight), borderColor: colors.border },
              mode === 'auto' && [styles.iconChoiceSelected, { borderColor: selectedColor }],
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={automaticIcon}
              size={21}
              color={mode === 'auto' ? (normalizeColor(selectedColor) || defaultGlyph) : defaultGlyph}
            />
            <Text
              style={[
                styles.autoIconText,
                { color: mode === 'auto' ? (normalizeColor(selectedColor) || defaultGlyph) : defaultGlyph },
              ]}
            >
              Auto
            </Text>
          </Pressable>
          {pickerOptions.map((option) => {
            const selected = mode === 'manual' && selectedIcon === option.icon;

            return (
              <Pressable
                key={option.id}
                onPress={() => onSelectManual(option.icon)}
                accessibilityRole="button"
                accessibilityLabel={`Choisir l'icône ${option.label}`}
                style={({ pressed }) => [
                  styles.iconChoice,
                  { backgroundColor: resolveUserPickedIconWellBackground(isLight), borderColor: colors.border },
                  selected && [styles.iconChoiceSelected, { borderColor: selectedColor }],
                  pressed && styles.pressed,
                ]}
              >
                <UserPickedIconBadge icon={option.icon} color={option.color} size={36} iconSize={18} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function ColorPicker({
  selectedColor,
  onSelect,
}: {
  selectedColor: string;
  onSelect: (color: string) => void;
}) {
  const { colors, ghost } = useAppTheme();
  const options = getColorOptions(GOAL_COLOR_OPTIONS, selectedColor);

  return (
    <View style={styles.pickerSection}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Couleur</Text>
      <View style={styles.colorGrid}>
        {options.map((color) => {
          const selected = selectedColor.toLowerCase() === color.toLowerCase();

          return (
            <Pressable
              key={color}
              onPress={() => {
                tapHaptic();
                onSelect(color);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Choisir la couleur ${color}`}
              style={({ pressed }) => [
                styles.colorChoice,
                { backgroundColor: ghost.obsidianSoft, borderColor: colors.border },
                selected && [styles.colorChoiceSelected, { borderColor: color }],
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.colorSwatch, { backgroundColor: color }]}>
                {selected ? <Ionicons name="checkmark" size={16} color={getReadableIconColor(color)} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
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
    <View style={[styles.projectionCard, { backgroundColor: ghost.obsidianSoft, borderColor: colors.border }]}>
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

export async function saveSavingsGoalForm(form: GoalForm) {
  const name = form.name.trim();
  const targetAmount = parseAmount(form.targetAmount);
  const currentAmount = parseAmount(form.currentAmount || '0');
  const weeklyContribution = form.weeklyContribution.trim()
    ? parseAmount(form.weeklyContribution)
    : undefined;

  if (!name) {
    Alert.alert('Nom requis', 'Ajoute un nom pour ton objectif.');
    return false;
  }
  if (Number.isNaN(targetAmount) || targetAmount <= 0) {
    Alert.alert('Cible invalide', 'Entre un montant cible supérieur à 0.');
    return false;
  }
  if (Number.isNaN(currentAmount) || currentAmount < 0) {
    Alert.alert('Montant invalide', 'Entre un montant épargné positif ou 0.');
    return false;
  }
  if (Number.isNaN(weeklyContribution) || weeklyContribution < 0) {
    Alert.alert('Contribution invalide', 'Entre une contribution hebdomadaire positive ou 0.');
    return false;
  }

  let initialSavedAmount: number;
  if (!form.initialSavedAmount.trim()) {
    initialSavedAmount = currentAmount;
  } else {
    initialSavedAmount = parseAmount(form.initialSavedAmount);
    if (Number.isNaN(initialSavedAmount) || initialSavedAmount < 0) {
      Alert.alert('Montant invalide', 'Réessaie avec un montant initial valide.');
      return false;
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
    dueDate: form.dueDate.trim() || undefined,
    color: normalizeColor(form.color),
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
  const weeklyContribution = form.weeklyContribution.trim()
    ? parseAmount(form.weeklyContribution)
    : 0;

  if (
    Number.isNaN(targetAmount) ||
    Number.isNaN(currentAmount) ||
    Number.isNaN(weeklyContribution) ||
    targetAmount < 0 ||
    currentAmount < 0 ||
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

function getSelectedGoalIcon(form: GoalForm): IconName {
  if (form.iconMode === 'auto') return getAutomaticGoalIcon(form.name);
  return isIconName(form.icon) ? form.icon : DEFAULT_ICON;
}

function getAutomaticGoalIcon(name: string): IconName {
  const normalized = normalizeSearchText(name);
  if (matchesAny(normalized, ['urgence', 'emergency', 'securite', 'securité'])) return 'umbrella-outline';
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
  return value.replace(/[^0-9.,]/g, '').replace(',', '.');
}

function parseAmount(value: string) {
  return Number.parseFloat(value.replace(',', '.'));
}

function formatSuggestedAmount(value: number) {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0 %';
  return `${Math.round(value * 100)} %`;
}

function isIconName(value: string): value is IconName {
  return value in Ionicons.glyphMap;
}

function getColorOptions(options: string[], selectedColor: string) {
  if (!options.some((color) => color.toLowerCase() === selectedColor.toLowerCase())) {
    return [selectedColor, ...options];
  }
  return options;
}

function normalizeColor(color?: string) {
  return color?.startsWith('#') ? color : DEFAULT_COLOR;
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
  fieldHint: {
    fontSize: typography.micro,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: -spacing.xs,
  },
  iconSelector: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: ghost.obsidianSoft,
    padding: spacing.md,
    gap: spacing.md,
  },
  iconSelectorTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconPreview: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSelectorCopy: { flex: 1, minWidth: 0, gap: 3 },
  iconSelectorLabel: { color: colors.text, fontSize: typography.body, fontWeight: '800' },
  iconSelectorMeta: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  iconEditButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
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
  pickerSection: { gap: spacing.sm },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  autoIconChoice: {
    height: 42,
    minWidth: 82,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: ghost.obsidianSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingHorizontal: spacing.sm,
  },
  autoIconText: { color: colors.textMuted, fontSize: typography.micro, fontWeight: '800' },
  iconChoice: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ghost.obsidianSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  iconChoiceSelected: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
  },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorChoice: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ghost.obsidianSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  colorChoiceSelected: { borderWidth: 1.5 },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
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

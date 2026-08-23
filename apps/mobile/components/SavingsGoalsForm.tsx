import { type Dispatch, type SetStateAction, useMemo } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import {
  DraggableSheetScrollView,
  DraggableSheetSurface,
} from '@/components/DraggableSheetSurface';
import {
  FORM_SHEET_CONTENT_PADDING_TOP,
  FormSheetChromeHeader,
  FormSheetModalBody,
  formSheetScrollContentStyle,
  formSheetScrollPaddingBottom,
  formSheetScrollViewStyle,
  useFormSheetHeight,
  useFormSheetKeyboardInset,
} from '@/lib/sheet/formSheetScroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePickerField } from '@/components/MinimalDatePicker';
import { MdiIcon } from '@/components/MdiIcon';
import { OnyxContainer } from '@/components/OnyxContainer';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { ThemeSegmentedControl } from '@/components/ThemeSegmentedControl';
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
import { ghost } from '@/constants/ghostUi';
import { ONYX_CONTAINER, planFinanceKit } from '@/constants/planFinanceKit';
import {
  FORM_SECTION_LABEL_STYLE,
  getGoalGreenShade,
  jakartaBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  moneyAmountTypography,
  PAGE_TITLE_CONTENT_GAP,
  colors,
  radius,
  spacing,
  typography,
  typographyKit,
} from '@/constants/theme';
import { BUDGET_CATEGORY_ICON_GLYPH_COLOR } from '@/lib/budgetCategoryIcon';
import { upsertSavingsGoal } from '@/lib/db';
import {
  DEFAULT_GOAL_ICON,
  getAutomaticGoalIcon,
} from '@/lib/getAutomaticGoalIcon';
import {
  computeGoalCashflowProjection,
  formatGoalDurationAtPace,
  type GoalProjection,
} from '@/lib/goalProjection';
import { formatDisplayMoneyAbsolute, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import { parseFormattedNumber, sanitizeNumericInput, formatNumberDisplay } from '@/lib/formatNumber';
import { isMdiIconName } from '@/lib/mdiIconCatalog';
import { savingsGoalIncrementalProgress } from '@/lib/savingsGoalProgress';
import { useAppTheme } from '@/lib/themeContext';
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

const DEFAULT_ICON = DEFAULT_GOAL_ICON;

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
  const sheetHeight = useFormSheetHeight(0.92);
  const keyboardInset = useFormSheetKeyboardInset();
  const { colors: themeColors, isLight } = useAppTheme();
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
  const sectionLabelStyle = useMemo(
    () => [FORM_SECTION_LABEL_STYLE, { color: themeColors.text }],
    [themeColors.text],
  );
  const themed = useMemo(
    () => ({
      modalBackdrop: { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' },
      sheet: {
        backgroundColor: themeColors.background,
        borderColor: themeColors.containerBorder,
      },
      closeButton: {
        backgroundColor: themeColors.surfaceElevated,
        borderColor: themeColors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      /** Same glass input shell as add-budget-category / add-transaction. */
      controlStrong: {
        backgroundColor: themeColors.input,
        borderColor: themeColors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      text: { color: themeColors.text },
      textMuted: { color: themeColors.textMuted },
      warningCard: {
        backgroundColor: isLight ? 'rgba(201, 111, 26, 0.10)' : 'rgba(255, 177, 92, 0.12)',
        borderColor: themeColors.warning,
      },
      warningText: { color: themeColors.warning },
    }),
    [isLight, themeColors],
  );
  const resolvedIcon = form ? getAutomaticGoalIcon(form.name) : DEFAULT_ICON;
  const isEditingExistingGoal =
    form != null && goals.some((goal) => goal.id === form.id);

  // Don't mount sheet chrome (date picker, etc.) while closed — wallet hub keeps this modal mounted.
  if (form == null) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onDismiss}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.modalBackdrop, themed.modalBackdrop]}>
          <FormSheetModalBody>
            <DraggableSheetSurface
              onClose={onDismiss}
              sheetHeight={sheetHeight}
              style={[styles.modalCard, themed.sheet]}
            >
              <FormSheetChromeHeader
                title={isEditingExistingGoal ? 'Modifier' : 'Nouvel objectif'}
                onClose={onDismiss}
                titleColor={themeColors.text}
                closeIconColor={themeColors.textMuted}
                handleColor={themeColors.borderStrong}
                closeButtonStyle={themed.closeButton}
              />

              <DraggableSheetScrollView
                style={formSheetScrollViewStyle()}
                keyboardDismissMode="on-drag"
                contentContainerStyle={[
                  styles.modalContent,
                  formSheetScrollContentStyle,
                  { paddingBottom: formSheetScrollPaddingBottom(insets.bottom, keyboardInset) },
                ]}
              >
                <View style={styles.formBody}>
                  <View style={styles.section}>
                    <DashboardSectionLabel style={sectionLabelStyle}>
                      Nom de l'objectif
                    </DashboardSectionLabel>
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
                    <Text style={[styles.fieldHint, themed.textMuted]}>
                      Icône auto selon le nom
                    </Text>
                  </View>

                  <FormField
                    label="Montant cible"
                    value={form?.targetAmount ?? ''}
                    placeholder="5 000"
                    keyboardType="decimal-pad"
                    controlStrong={themed.controlStrong}
                    sectionLabelStyle={sectionLabelStyle}
                    onChangeText={(value) =>
                      setForm((cur) =>
                        cur ? { ...cur, targetAmount: sanitizeAmount(value) } : cur,
                      )
                    }
                  />
                  <FormField
                    label="Montant déjà épargné"
                    value={form?.currentAmount ?? ''}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    controlStrong={themed.controlStrong}
                    sectionLabelStyle={sectionLabelStyle}
                    onChangeText={(value) =>
                      setForm((cur) =>
                        cur ? { ...cur, currentAmount: sanitizeAmount(value) } : cur,
                      )
                    }
                  />

                  <View style={styles.section}>
                    <DatePickerField
                      label="Date cible"
                      value={form?.dueDate ?? ''}
                      placeholder="Optionnelle · aucune date max"
                      allowClear
                      variant="sheet"
                      labelStyle={sectionLabelStyle}
                      surfaceStyle={themed.controlStrong}
                      onChangeDate={(value) =>
                        setForm((cur) => (cur ? { ...cur, dueDate: value } : cur))
                      }
                    />
                    <Text style={[styles.fieldHint, themed.textMuted]}>
                      Facultatif · sert à calculer le versement minimum
                    </Text>
                  </View>

                  <View style={styles.section}>
                    <DashboardSectionLabel style={sectionLabelStyle}>
                      Montant des versements
                    </DashboardSectionLabel>
                    <ThemeSegmentedControl
                      tabs={SAVINGS_GOAL_CONTRIBUTION_FREQUENCIES}
                      active={contributionFrequency}
                      size="sm"
                      variant="section"
                      showDivider={false}
                      onChange={(frequency) => {
                        tapHaptic();
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
                        });
                      }}
                    />
                    <FormField
                      label=""
                      hideLabel
                      value={form?.weeklyContribution ?? ''}
                      placeholder={contributionPlaceholder}
                      keyboardType="decimal-pad"
                      controlStrong={themed.controlStrong}
                      sectionLabelStyle={sectionLabelStyle}
                      onChangeText={(value) =>
                        setForm((cur) =>
                          cur ? { ...cur, weeklyContribution: sanitizeAmount(value) } : cur,
                        )
                      }
                    />
                    {suggestedWeekly != null ? (
                      <Text style={[styles.fieldHint, themed.textMuted]}>
                        Minimum pour la date cible :{' '}
                        {formatSuggestedAmount(suggestedAtFrequency ?? suggestedWeekly)} ${' '}
                        {savingsGoalContributionFrequencyLabel(contributionFrequency).toLowerCase()}
                      </Text>
                    ) : (
                      <Text style={[styles.fieldHint, themed.textMuted]}>
                        Facultatif
                        {isEditingExistingGoal ? ' · estime la projection' : ''}
                      </Text>
                    )}
                    {isWeeklyBelowSuggestion && suggestedWeekly != null ? (
                      <View style={[styles.weeklyWarning, themed.warningCard]}>
                        <Text style={[styles.weeklyWarningText, themed.warningText]}>
                          Ce montant ne permettra pas d'atteindre la date cible. Entre au moins{' '}
                          {formatSuggestedAmount(suggestedAtFrequency ?? suggestedWeekly)} ${' '}
                          {savingsGoalContributionFrequencyLabel(contributionFrequency).toLowerCase()}{' '}
                          pour la respecter.
                        </Text>
                      </View>
                    ) : null}
                    {!isWeeklyBelowSuggestion && weeklyFeedback ? (
                      <Text style={[styles.fieldHint, themed.textMuted]}>{weeklyFeedback}</Text>
                    ) : null}
                  </View>

                  {isEditingExistingGoal && projection ? (
                    <GoalProjectionCard projection={projection} />
                  ) : null}

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
                    loading={saving}
                  />
                </View>
              </DraggableSheetScrollView>
            </DraggableSheetSurface>
          </FormSheetModalBody>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function FormField({
  label,
  value,
  placeholder,
  keyboardType,
  onChangeText,
  controlStrong,
  sectionLabelStyle,
  hideLabel = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad';
  onChangeText: (value: string) => void;
  controlStrong: { backgroundColor: string; borderColor: string; borderWidth: number };
  sectionLabelStyle: StyleProp<TextStyle>;
  hideLabel?: boolean;
}) {
  const { colors } = useAppTheme();
  const InputComponent = keyboardType === 'decimal-pad' ? NumericAmountInput : TextInput;
  const isAmount = keyboardType === 'decimal-pad';

  return (
    <View style={styles.field}>
      {!hideLabel && label ? (
        <DashboardSectionLabel style={sectionLabelStyle}>{label}</DashboardSectionLabel>
      ) : null}
      <View style={[styles.inputShell, controlStrong]}>
        <InputComponent
          style={[styles.inputWithSuffix, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
        />
        {isAmount ? (
          <Text style={[styles.suffix, { color: colors.textSecondary }]}>$</Text>
        ) : null}
      </View>
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
  const { colors, isLight } = useAppTheme();
  const trimmedName = name.trim();
  const glyphColor = isLight ? 'rgba(17,17,17,0.82)' : BUDGET_CATEGORY_ICON_GLYPH_COLOR;
  const mdiName = isMdiIconName(resolvedIcon) ? resolvedIcon : null;
  const useMaterialCommunity = isMaterialCommunityOnlyIcon(resolvedIcon);
  const glyphName = resolveGoalIdentityGlyph(resolvedIcon);

  return (
    <View style={styles.identityRow}>
      <View style={styles.iconAffordance}>
        {trimmedName ? (
          <View style={styles.iconSlot}>
            {mdiName ? (
              <MdiIcon name={mdiName} size={22} color={glyphColor} />
            ) : useMaterialCommunity ? (
              <AppIcon family="material-community" name={resolvedIcon} size={22} color={glyphColor} />
            ) : (
              <AppIcon family="ionicons" name={glyphName} size={22} color={glyphColor} />
            )}
          </View>
        ) : (
          <View style={styles.iconGhostSlot} accessibilityElementsHidden>
            <AppIcon
              family="ionicons"
              name="flag-outline"
              size={20}
              color={colors.textMuted}
            />
          </View>
        )}
      </View>
      <TextInput
        style={[
          styles.nameInput,
          {
            color: colors.text,
            borderBottomColor: colors.border,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
        ]}
        value={name}
        onChangeText={onChangeName}
        placeholder="Ex. Fonds d'urgence"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Nom de l'objectif"
        returnKeyType="next"
      />
    </View>
  );
}

/** Same filled-Ionicons treatment as add-budget-category identity glyph. */
function resolveGoalIdentityGlyph(icon: string): IconName {
  const normalized =
    icon === 'shield-check-outline'
      ? 'shield-checkmark-outline'
      : icon === 'shield-check'
        ? 'shield-checkmark'
        : icon;
  if (normalized.endsWith('-outline')) {
    const filled = normalized.slice(0, -'-outline'.length) as IconName;
    if (Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, filled)) {
      return filled;
    }
  }
  if (Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, normalized)) {
    return normalized as IconName;
  }
  return 'flag';
}

/** MCI-only names (e.g. palm-tree) — avoid ionicons/MCI overlaps like flag-outline. */
function isMaterialCommunityOnlyIcon(icon: string): boolean {
  return (
    Object.prototype.hasOwnProperty.call(MaterialCommunityIcons.glyphMap, icon) &&
    !Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, icon)
  );
}


function GoalProjectionCard({ projection }: { projection: GoalProjection }) {
  const { colors } = useAppTheme();

  return (
    <OnyxContainer halo={false} style={styles.projectionCard}>
      <Text style={[styles.projectionTitle, { color: colors.textMuted }]}>Projection</Text>
      <ProjectionRow label="Progression" value={formatPercent(projection.progress)} />
      <ProjectionRow
        label="Reste à épargner"
        value={formatDisplayMoneyAbsolute(projection.remaining)}
        monetary
      />
      {projection.weeksToGoal != null ? (
        <ProjectionRow
          label="Durée à ce rythme"
          value={formatGoalDurationAtPace(projection.weeksToGoal * 7)}
        />
      ) : null}
      {projection.requiredWeekly != null ? (
        <ProjectionRow
          label="Requis par semaine"
          value={formatDisplayMoneyAbsolute(projection.requiredWeekly)}
          monetary
        />
      ) : null}
      {projection.targetDate != null && projection.requiredWeekly == null ? (
        <ProjectionRow label="Date estimée d'atteinte" value={projection.targetDate} />
      ) : null}
      {projection.monthlyContribution > 0 ? (
        <ProjectionRow
          label="Montant par mois"
          value={formatDisplayMoneyAbsolute(projection.monthlyContribution)}
          monetary
        />
      ) : null}
      {projection.budgetUseRatio != null && projection.monthlyContribution > 0 ? (
        <ProjectionRow label="Part du budget" value={formatPercent(projection.budgetUseRatio)} />
      ) : null}
      {projection.weeklyObligationsTotal > 0 ? (
        <ProjectionRow
          label="Obligations + objectif / semaine"
          value={`${formatDisplayMoneyAbsolute(projection.weeklyObligationsTotal)} / semaine`}
          monetary
        />
      ) : null}
      {projection.cashflowImpactWeekly != null ? (
        <ProjectionRow
          label="Impact sur le cashflow"
          value={`${formatSignedDisplayMoney(projection.cashflowImpactWeekly)} / semaine`}
          monetary
        />
      ) : null}
      <Text style={[styles.projectionHint, { color: colors.textMuted }]}>{projection.hint}</Text>
    </OnyxContainer>
  );
}

function ProjectionRow({
  label,
  value,
  monetary = false,
}: {
  label: string;
  value: string;
  monetary?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.projectionRow}>
      <Text style={[styles.projectionLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text
        style={[
          monetary ? styles.projectionMoney : styles.projectionValue,
          { color: colors.text },
        ]}
      >
        {value}
      </Text>
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
  _goals: SavingsGoal[],
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
  const cashflow = computeGoalCashflowProjection({
    weeklyContribution,
    requiredWeekly,
    dashboard,
    categoryBudgets,
    recurringPayments,
  });
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
    ...cashflow,
    targetDate: targetDate ? formatDateKey(targetDate) : null,
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

function addWeeks(date: Date, weeks: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + weeks * 7);
  return next;
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getSelectedGoalIcon(form: GoalForm): string {
  return getAutomaticGoalIcon(form.name);
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
  },
  modalKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: FORM_SHEET_CONTENT_PADDING_TOP,
  },
  modalContent: {
    paddingTop: spacing.xl,
  },
  formBody: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  field: { gap: spacing.sm },
  inputShell: {
    minHeight: 50,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputWithSuffix: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.md,
    fontSize: typography.body,
    ...jakartaBoldText,
  },
  suffix: {
    ...typographyKit.metaMedium,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  iconAffordance: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconSlot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
  iconGhostSlot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.42,
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
    fontSize: typography.body,
    borderBottomWidth: StyleSheet.hairlineWidth,
    ...jakartaSemiboldText,
  },
  fieldHint: {
    ...typographyKit.metaMedium,
    lineHeight: 16,
    opacity: 0.85,
  },
  weeklyWarning: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  weeklyWarningText: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    lineHeight: 20,
  },
  projectionCard: {
    padding: ONYX_CONTAINER.padding.card,
    gap: spacing.sm,
  },
  projectionTitle: {
    ...typographyKit.eyebrow,
    marginBottom: spacing.xs,
  },
  projectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  projectionLabel: {
    flex: 1,
    ...typographyKit.metaMedium,
  },
  projectionValue: {
    ...typographyKit.metaSemibold,
  },
  projectionMoney: {
    ...moneyAmountTypography({ tier: 'row' }),
  },
  projectionHint: {
    ...typographyKit.metaMedium,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  saveBtn: {
    alignItems: 'center',
    borderRadius: planFinanceKit.radius.button,
    backgroundColor: colors.primary,
    paddingVertical: 17,
  },
  disabled: { opacity: 0.45 },
  saveText: { color: '#000000', fontSize: 18, fontWeight: '800' },
});

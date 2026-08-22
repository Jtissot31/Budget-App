/**
 * Nouvelle catégorie budget — transparentModal route over Budgets
 * (same presentation pattern as add-transaction over history).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  Dimensions,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ThemeSegmentedControl } from '@/components/ThemeSegmentedControl';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import {
  CATEGORY_ICON_PICKER_OPTIONS,
  getCategoryIconName,
  type IconName,
} from '@/constants/categoryOptions';
import { assignCategoryColor } from '@/constants/budgetCategoryColors';
import {
  FORM_SECTION_LABEL_STYLE,
  jakartaBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  radius,
  spacing,
  typography,
  typographyKit,
} from '@/constants/theme';
import { MAX_BUDGET_CATEGORIES } from '@/lib/budgetCategoryModel';
import {
  addCategory,
  getCategories,
  updateCategoryLimit,
  type BudgetCategory,
} from '@/lib/budgetCategories';
import {
  computeBudgetAllocationHeadroom,
  describeCategoryCapacityBlocker,
  describeDuplicateCategory,
  describeDuplicateResolution,
  findConflictingCategory,
  parseBudgetLimitInput,
  validateBudgetCategoryDraft,
  BUDGET_PERIOD_EXCEEDS_MONTHLY_MESSAGE,
  type BudgetCategoryFieldKey,
} from '@/lib/budgetCategoryValidation';
import { upsertCategory, upsertCategoryBudget } from '@/lib/db';
import { formValidationError, type FormFeedback } from '@/lib/formFeedback';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import {
  getPayEstimationSettings,
  toMonthlyAveragePayAmount,
} from '@/lib/payEstimationSettings';
import {
  convertContributionAmountBetweenFrequencies,
  toWeeklyContributionAmount,
  type SavingsGoalContributionFrequency,
} from '@/lib/savingsGoalContribution';
import {
  FORM_SHEET_CONTENT_PADDING_TOP,
  FormSheetChromeHeader,
  FormSheetModalBody,
  formSheetDragHeight,
  formSheetPanelStyle,
  formSheetScrollContentStyle,
  formSheetScrollPaddingBottom,
  formSheetScrollViewStyle,
  scrollFormSheetToTop,
  useFormSheetKeyboardInset,
  useFormSheetScrollToTop,
} from '@/lib/sheet/formSheetScroll';
import { useDraggableSheetGesture } from '@/lib/sheet/useDraggableSheetGesture';
import { useAppTheme } from '@/lib/themeContext';

type PeriodFrequency = Extract<SavingsGoalContributionFrequency, 'weekly' | 'biweekly'>;
type LimitSource = 'manual' | 'auto';
type FieldKey = BudgetCategoryFieldKey;

const PERIOD_EXCEED_MONTHLY_MESSAGE = BUDGET_PERIOD_EXCEEDS_MONTHLY_MESSAGE;

const PERIOD_FREQUENCY_TABS: Array<{ id: PeriodFrequency; label: string }> = [
  { id: 'weekly', label: 'Semaine' },
  { id: 'biweekly', label: 'Bihebdo' },
];

function formatLimitFieldAmount(value: number): string {
  return String(Math.max(0, Math.round(value)));
}

function monthlyFromPeriodAmount(periodAmount: number, frequency: PeriodFrequency): number {
  return convertContributionAmountBetweenFrequencies(periodAmount, frequency, 'monthly');
}

export type AddBudgetCategoryPrefill = {
  name?: string;
  icon?: IconName;
  limit?: number;
};

function createEntityId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

/** First character majuscule; rest of casing unchanged. Empty stays empty. */
function capitalizeCategoryName(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase('fr-CA') + value.slice(1);
}

/** Live-preview parse for derived fields; submit uses `validateBudgetCategoryDraft`. */
function parseLimitInput(value: string): number | null {
  const parsed = parseBudgetLimitInput(value);
  return parsed.ok ? parsed.value : null;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parsePrefillFromParams(params: {
  name?: string | string[];
  icon?: string | string[];
  limit?: string | string[];
}): AddBudgetCategoryPrefill | null {
  const name = firstParam(params.name)?.trim();
  const iconRaw = firstParam(params.icon)?.trim();
  const limitRaw = firstParam(params.limit)?.trim();
  const limitParsed = limitRaw != null ? Number.parseFloat(limitRaw.replace(',', '.')) : NaN;
  const icon = iconRaw ? (iconRaw as IconName) : undefined;
  if (!name && !icon && !(Number.isFinite(limitParsed) && limitParsed > 0)) {
    return null;
  }
  return {
    name: name ? capitalizeCategoryName(name) : undefined,
    icon,
    limit: Number.isFinite(limitParsed) && limitParsed > 0 ? limitParsed : undefined,
  };
}

export default function AddBudgetCategoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    icon?: string;
    limit?: string;
    /** `YYYY-MM` of the Budget screen month — scopes duplicate copy. */
    month?: string | string[];
  }>();
  const prefill = useMemo(() => parsePrefillFromParams(params), [params]);
  const formMonthDate = useMemo(() => {
    const raw = firstParam(params.month)?.trim();
    if (raw && /^\d{4}-\d{2}$/.test(raw)) {
      const [year, month] = raw.split('-').map(Number);
      if (year && month >= 1 && month <= 12) {
        return new Date(year, month - 1, 1);
      }
    }
    return new Date();
  }, [params.month]);

  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardInset = useFormSheetKeyboardInset();
  const [hostHeight, setHostHeight] = useState(windowHeight);
  const onHostMetrics = useCallback(
    (metrics: { hostHeight: number; keyboardInset: number }) => {
      setHostHeight((prev) => (prev === metrics.hostHeight ? prev : metrics.hostHeight));
    },
    [],
  );
  const { colors, isLight } = useAppTheme();
  const sectionLabelStyle = [FORM_SECTION_LABEL_STYLE, { color: colors.text }];

  const [name, setName] = useState(() => capitalizeCategoryName(prefill?.name?.trim() ?? ''));
  const [limit, setLimit] = useState(() =>
    prefill?.limit != null && prefill.limit > 0 ? String(Math.round(prefill.limit)) : '',
  );
  const [limitSource, setLimitSource] = useState<LimitSource | null>(() =>
    prefill?.limit != null && prefill.limit > 0 ? 'manual' : null,
  );
  const [periodFrequency, setPeriodFrequency] = useState<PeriodFrequency>('weekly');
  const [periodLimit, setPeriodLimit] = useState('');
  const [manualIcon, setManualIcon] = useState<IconName | null>(() => prefill?.icon ?? null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [periodCapMessage, setPeriodCapMessage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<BudgetCategory[]>([]);
  const [monthlySalary, setMonthlySalary] = useState<number | null>(null);

  const sheetScrollRef = useRef<Animated.ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const nameSectionRef = useRef<View>(null);
  const limitSectionRef = useRef<View>(null);
  const periodSectionRef = useRef<View>(null);
  const nameInputRef = useRef<TextInput>(null);
  const limitInputRef = useRef<TextInput>(null);
  const periodInputRef = useRef<TextInput>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [categories, paySettings] = await Promise.all([
          getCategories(),
          getPayEstimationSettings(),
        ]);
        if (cancelled) return;
        setExisting(categories);
        setMonthlySalary(
          paySettings.averageAmount != null
            ? toMonthlyAveragePayAmount(paySettings.averageAmount, paySettings.frequency)
            : null,
        );
      } catch {
        if (!cancelled) {
          setExisting([]);
          setMonthlySalary(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allocatedTotal = useMemo(
    () => existing.reduce((sum, category) => sum + Math.max(0, category.limit), 0),
    [existing],
  );

  const parsedLimit = useMemo(() => parseLimitInput(limit), [limit]);
  const parsedPeriodLimit = useMemo(() => {
    if (!periodLimit.trim()) return null;
    return parseLimitInput(periodLimit);
  }, [periodLimit]);
  const periodExceedsMonthly =
    parsedLimit != null && parsedPeriodLimit != null && parsedPeriodLimit > parsedLimit;
  const showPeriodCapMessage = periodCapMessage || periodExceedsMonthly;
  const weeklyLimitToStore = useMemo(() => {
    if (parsedPeriodLimit == null) return null;
    const capped =
      parsedLimit != null ? Math.min(parsedPeriodLimit, parsedLimit) : parsedPeriodLimit;
    return toWeeklyContributionAmount(capped, periodFrequency);
  }, [parsedLimit, parsedPeriodLimit, periodFrequency]);
  const trimmedName = name.trim();
  const resolvedIcon = useMemo((): IconName | null => {
    if (manualIcon) return manualIcon;
    // Never infer from placeholder — only from a real name the user entered (or prefill).
    if (!trimmedName) return null;
    return getCategoryIconName({ name: trimmedName });
  }, [manualIcon, trimmedName]);
  const atCapacity = existing.length >= MAX_BUDGET_CATEGORIES;

  /** Catégorie existante portant le même nom (casse / accents / espaces ignorés). */
  const duplicateCategory = useMemo(
    () =>
      findConflictingCategory(trimmedName, existing, {
        monthDate: formMonthDate,
      }),
    [existing, formMonthDate, trimmedName],
  );

  /**
   * Soft envelope check — never blocks save. Prefer the live headroom helper so the
   * warning updates as the user types, matching `validateBudgetCategoryDraft` notices.
   */
  const allocationHeadroom = useMemo(
    () =>
      computeBudgetAllocationHeadroom({
        otherCategoriesAllocatedTotal: allocatedTotal,
        categoryLimit: parsedLimit,
        monthlyIncome: monthlySalary,
        monthDate: formMonthDate,
      }),
    [allocatedTotal, formMonthDate, monthlySalary, parsedLimit],
  );

  const clearFieldError = useCallback((field: FieldKey) => {
    setFieldErrors((current) => {
      if (current[field] == null) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const scrollToField = useCallback((field: FieldKey) => {
    const sectionRef =
      field === 'name'
        ? nameSectionRef
        : field === 'limit'
          ? limitSectionRef
          : periodSectionRef;
    const inputRef =
      field === 'name' ? nameInputRef : field === 'limit' ? limitInputRef : periodInputRef;
    const content = scrollContentRef.current;
    const section = sectionRef.current;

    const focusInput = () => {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    };

    if (!content || !section) {
      focusInput();
      return;
    }

    section.measureLayout(
      content,
      (_x, y) => {
        requestAnimationFrame(() => {
          sheetScrollRef.current?.scrollTo({
            y: Math.max(y - 16, 0),
            animated: true,
          });
          focusInput();
        });
      },
      () => {
        focusInput();
      },
    );
  }, []);

  const applyPeriodDerivedMonthly = useCallback(
    (periodValue: string, frequency: PeriodFrequency) => {
      const parsed = parseLimitInput(periodValue);
      if (parsed == null) {
        if (limitSource === 'auto') {
          setLimit('');
          setLimitSource(null);
        }
        return;
      }
      setLimit(formatLimitFieldAmount(monthlyFromPeriodAmount(parsed, frequency)));
      setLimitSource('auto');
    },
    [limitSource],
  );

  const handleMonthlyLimitChange = useCallback(
    (value: string) => {
      setLimit(value);
      setLimitSource(value.trim() ? 'manual' : null);
      clearFieldError('limit');
      if (feedback) setFeedback(null);

      const nextMonthly = parseLimitInput(value);
      if (nextMonthly == null) {
        setPeriodCapMessage(false);
        return;
      }
      const currentPeriod = parseLimitInput(periodLimit);
      if (currentPeriod != null && currentPeriod > nextMonthly) {
        setPeriodLimit(formatLimitFieldAmount(nextMonthly));
        setPeriodCapMessage(true);
      } else {
        setPeriodCapMessage(false);
      }
    },
    [clearFieldError, feedback, periodLimit],
  );

  const handlePeriodLimitChange = useCallback(
    (value: string) => {
      setPeriodLimit(value);
      setPeriodCapMessage(false);
      clearFieldError('period');
      clearFieldError('limit');
      if (feedback) setFeedback(null);
      // Period is source of truth when edited — always push monthly from conversion.
      applyPeriodDerivedMonthly(value, periodFrequency);
    },
    [applyPeriodDerivedMonthly, clearFieldError, feedback, periodFrequency],
  );

  const handlePeriodFrequencyChange = useCallback(
    (next: PeriodFrequency) => {
      tapHaptic();
      setPeriodFrequency(next);
      setPeriodCapMessage(false);
      if (periodLimit.trim()) {
        applyPeriodDerivedMonthly(periodLimit, next);
      }
    },
    [applyPeriodDerivedMonthly, periodLimit],
  );

  const closeSheet = useCallback(() => {
    router.back();
  }, [router]);

  // Keyboard-aware: FormSheetModalBody measures the host; clamp without Android KAV.
  const sheetDragHeight = formSheetDragHeight(
    windowHeight,
    keyboardInset,
    hostHeight,
    Dimensions.get('screen').height,
  );

  const {
    panGesture,
    scrollNativeGesture,
    scrollHandler,
    sheetAnimatedStyle,
    backdropAnimatedStyle,
    resetSheetPosition,
    requestClose,
  } = useDraggableSheetGesture({
    onClose: closeSheet,
    sheetHeight: sheetDragHeight,
    handleOnly: true,
    scrollable: true,
  });

  useEffect(() => {
    resetSheetPosition('expanded');
  }, [resetSheetPosition]);

  // Always land on the first field, never mid-form (retries cover late layout).
  useFormSheetScrollToTop(sheetScrollRef, true);

  /**
   * Do NOT auto-focus the name field on Android. Focusing on mount opens the
   * keyboard while the transparentModal root is still settling / resizing, which
   * used to push the flex-end sheet above the viewport. User taps when ready.
   */
  useEffect(() => {
    scrollFormSheetToTop(sheetScrollRef);
  }, []);

  const handleSave = useCallback(async () => {
    const validation = validateBudgetCategoryDraft({
      name,
      limitInput: limit,
      periodInput: periodLimit,
      existing,
      maxCategories: MAX_BUDGET_CATEGORIES,
      monthDate: formMonthDate,
      monthlyIncome: monthlySalary,
      otherCategoriesAllocatedTotal: allocatedTotal,
    });

    if (validation.firstInvalidField != null) {
      setFieldErrors(validation.fieldErrors);
      setFeedback(null);
      scrollToField(validation.firstInvalidField);
      return;
    }

    if (validation.blocked != null) {
      setFieldErrors({});
      setFeedback(
        formValidationError('Trop de catégories', validation.blocked.message),
      );
      return;
    }

    const savedName = validation.normalizedName;
    setSaving(true);
    setFeedback(null);
    setFieldErrors({});
    try {
      const latest = await getCategories();
      const lateDuplicate = findConflictingCategory(savedName, latest, {
        monthDate: formMonthDate,
      });
      if (lateDuplicate) {
        setFieldErrors({
          name: describeDuplicateCategory(lateDuplicate, formMonthDate),
        });
        scrollToField('name');
        return;
      }
      if (latest.length >= MAX_BUDGET_CATEGORIES) {
        setFeedback(
          formValidationError(
            'Trop de catégories',
            describeCategoryCapacityBlocker(MAX_BUDGET_CATEGORIES),
          ),
        );
        return;
      }

      const id = createEntityId('cat');
      const color = assignCategoryColor(latest.map((category) => category.color));
      const icon = manualIcon ?? getCategoryIconName({ name: savedName });
      const savedLimit = validation.limit!;

      await upsertCategory({
        id,
        name: savedName,
        icon,
        color,
      });
      await Promise.all([
        upsertCategoryBudget(id, savedLimit, weeklyLimitToStore),
        addCategory({
          id,
          name: savedName,
          icon,
          color,
          limit: savedLimit,
          spent: 0,
          period: 'monthly',
          created_by: 'user',
          createdAt: new Date().toISOString(),
        }),
      ]);
      successHaptic();
      closeSheet();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de créer la catégorie.';
      setFeedback(formValidationError('Erreur', message));
    } finally {
      setSaving(false);
    }
  }, [
    allocatedTotal,
    closeSheet,
    existing,
    formMonthDate,
    limit,
    manualIcon,
    monthlySalary,
    name,
    periodLimit,
    scrollToField,
    weeklyLimitToStore,
  ]);

  /**
   * Sortie du conflit de noms : reprendre l'enveloppe existante au lieu d'en créer
   * une deuxième portant le même nom.
   */
  const handleAdjustDuplicate = useCallback(async () => {
    if (!duplicateCategory || parsedLimit == null || saving) return;

    tapHaptic();
    setSaving(true);
    setFeedback(null);
    try {
      await Promise.all([
        upsertCategoryBudget(duplicateCategory.id, parsedLimit, weeklyLimitToStore),
        updateCategoryLimit(duplicateCategory.id, parsedLimit),
      ]);
      successHaptic();
      closeSheet();
    } catch {
      setFeedback(
        formValidationError('Erreur', 'Impossible de modifier cette catégorie. Réessaie dans un instant.'),
      );
    } finally {
      setSaving(false);
    }
  }, [closeSheet, duplicateCategory, parsedLimit, saving, weeklyLimitToStore]);

  // Never disabled for a reason the screen does not spell out — the capacity notice
  // below stays visible instead.
  const canSubmit = !saving;
  const sheetContentPaddingBottom = formSheetScrollPaddingBottom(
    insets.bottom,
    keyboardInset,
    windowHeight,
  );

  const themed = useMemo(
    () => ({
      modalBackdrop: {
        backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)',
      },
      sheet: {
        backgroundColor: colors.background,
        borderColor: colors.containerBorder,
      },
      handle: { backgroundColor: colors.borderStrong },
      closeButton: {
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
      /** Same glass input shell as add-transaction (`controlStrong`). */
      controlStrong: {
        backgroundColor: colors.input,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
      },
    }),
    [colors, isLight],
  );

  return (
    <GestureHandlerRootView style={[styles.screen, styles.modalBackdrop]}>
      <Animated.View style={[styles.dragBackdrop, themed.modalBackdrop, backdropAnimatedStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessibilityLabel="Fermer"
        />
      </Animated.View>
      <FormSheetModalBody style={styles.modalKeyboard} onHostMetrics={onHostMetrics}>
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.sheet,
              themed.sheet,
              formSheetPanelStyle(sheetDragHeight),
              sheetAnimatedStyle,
            ]}
          >
            <View style={styles.sheetChrome}>
              <FormSheetChromeHeader
                title="Nouvelle catégorie"
                onClose={requestClose}
                titleColor={colors.text}
                closeIconColor={colors.textMuted}
                handleColor={colors.borderStrong}
                closeButtonStyle={themed.closeButton}
                headerStyle={styles.sheetHeaderPad}
              />
            </View>
            <GestureDetector gesture={scrollNativeGesture}>
              <Animated.ScrollView
                ref={sheetScrollRef}
                style={formSheetScrollViewStyle()}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScrollBeginDrag={() => Keyboard.dismiss()}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                contentContainerStyle={[
                  styles.sheetContent,
                  formSheetScrollContentStyle,
                  { paddingBottom: sheetContentPaddingBottom },
                ]}
              >
                <View ref={scrollContentRef} collapsable={false}>
                <View style={styles.formBody}>
                  <View ref={nameSectionRef} collapsable={false} style={styles.section}>
                    <DashboardSectionLabel style={sectionLabelStyle}>
                      Nom de catégorie
                    </DashboardSectionLabel>
                    {fieldErrors.name ? (
                      <Text style={[styles.fieldError, { color: colors.danger }]}>
                        {fieldErrors.name}
                      </Text>
                    ) : null}
                    <View style={styles.identityRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Changer l'icône de la catégorie"
                        onPress={() => {
                          tapHaptic();
                          setShowIconPicker((open) => !open);
                        }}
                        style={({ pressed }) => [
                          styles.iconAffordance,
                          pressed && styles.pressed,
                        ]}
                      >
                        {resolvedIcon ? (
                          <BudgetCategoryIcon
                            icon={resolvedIcon}
                            name={trimmedName || undefined}
                            wellSize={28}
                            glyphSize={22}
                          />
                        ) : (
                          <View style={styles.iconGhostSlot} accessibilityElementsHidden>
                            <AppIcon
                              family="ionicons"
                              name="pricetag-outline"
                              size={20}
                              color={colors.textMuted}
                            />
                          </View>
                        )}
                      </Pressable>
                      <TextInput
                        ref={nameInputRef}
                        value={name}
                        onChangeText={(value) => {
                          setName(capitalizeCategoryName(value));
                          clearFieldError('name');
                          if (feedback) setFeedback(null);
                        }}
                        placeholder="Ex. Épicerie"
                        placeholderTextColor={colors.textMuted}
                        style={[
                          styles.nameInput,
                          {
                            color: colors.text,
                            borderBottomColor: fieldErrors.name ? colors.danger : colors.border,
                            borderBottomWidth: fieldErrors.name ? 1.5 : StyleSheet.hairlineWidth,
                          },
                        ]}
                        returnKeyType="next"
                      />
                    </View>
                    <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                      {manualIcon ? 'Icône manuelle · toucher pour changer' : 'Icône auto · toucher pour choisir'}
                    </Text>
                    {fieldErrors.name && duplicateCategory && parsedLimit != null ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={describeDuplicateResolution(
                          duplicateCategory,
                          parsedLimit,
                        )}
                        disabled={saving}
                        onPress={() => void handleAdjustDuplicate()}
                        style={({ pressed }) => [
                          styles.resolutionButton,
                          {
                            backgroundColor: colors.surfaceElevated,
                            borderColor: colors.border,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <AppIcon
                          family="ionicons"
                          name="create-outline"
                          size={15}
                          color={colors.primary}
                        />
                        <Text style={[styles.resolutionLabel, { color: colors.primary }]}>
                          {describeDuplicateResolution(duplicateCategory, parsedLimit)}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {showIconPicker ? (
                    <View style={styles.section}>
                      <DashboardSectionLabel style={sectionLabelStyle}>Icône</DashboardSectionLabel>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.iconOptionRow}
                        keyboardShouldPersistTaps="handled"
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Utiliser l'icône automatique"
                          onPress={() => {
                            tapHaptic();
                            setManualIcon(null);
                            setShowIconPicker(false);
                          }}
                          style={[
                            styles.iconOption,
                            {
                              borderColor: manualIcon == null ? colors.primary : colors.border,
                              backgroundColor: colors.surfaceElevated,
                            },
                          ]}
                        >
                          <AppIcon
                            family="ionicons"
                            name="sparkles-outline"
                            size={18}
                            color={manualIcon == null ? colors.primary : colors.textMuted}
                          />
                        </Pressable>
                        {CATEGORY_ICON_PICKER_OPTIONS.map((option) => {
                          const selected = manualIcon === option.icon;
                          return (
                            <Pressable
                              key={option.id}
                              accessibilityRole="button"
                              accessibilityLabel={option.label}
                              onPress={() => {
                                tapHaptic();
                                setManualIcon(option.icon);
                                setShowIconPicker(false);
                              }}
                              style={[
                                styles.iconOption,
                                {
                                  borderColor: selected ? colors.primary : colors.border,
                                  backgroundColor: colors.surfaceElevated,
                                },
                              ]}
                            >
                              <AppIcon
                                family="ionicons"
                                name={option.icon}
                                size={18}
                                color={selected ? colors.primary : colors.textSecondary}
                              />
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : null}

                  <View ref={limitSectionRef} collapsable={false} style={styles.section}>
                    <DashboardSectionLabel style={sectionLabelStyle}>
                      Limite mensuelle
                    </DashboardSectionLabel>
                    {fieldErrors.limit ? (
                      <Text style={[styles.fieldError, { color: colors.danger }]}>
                        {fieldErrors.limit}
                      </Text>
                    ) : null}
                    <View
                      style={[
                        styles.inputShell,
                        themed.controlStrong,
                        (limit.trim() && parsedLimit == null) || fieldErrors.limit
                          ? { borderColor: colors.danger, borderWidth: 1.5 }
                          : null,
                      ]}
                    >
                      <NumericAmountInput
                        ref={limitInputRef}
                        value={limit}
                        onChangeText={handleMonthlyLimitChange}
                        placeholder="600"
                        placeholderTextColor={colors.textMuted}
                        style={[styles.inputWithSuffix, { color: colors.text }]}
                      />
                      <Text style={[styles.suffix, { color: colors.textSecondary }]}>$</Text>
                    </View>
                    {limitSource === 'auto' && parsedLimit != null ? (
                      <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                        Calculé depuis la limite périodique · tu peux modifier
                      </Text>
                    ) : null}
                  </View>

                  <View ref={periodSectionRef} collapsable={false} style={styles.section}>
                    <DashboardSectionLabel style={sectionLabelStyle}>
                      Limite périodique
                    </DashboardSectionLabel>
                    {fieldErrors.period ? (
                      <Text style={[styles.fieldError, { color: colors.danger }]}>
                        {fieldErrors.period}
                      </Text>
                    ) : null}
                    <ThemeSegmentedControl
                      tabs={PERIOD_FREQUENCY_TABS}
                      active={periodFrequency}
                      size="sm"
                      variant="section"
                      onChange={handlePeriodFrequencyChange}
                    />
                    <View
                      style={[
                        styles.inputShell,
                        themed.controlStrong,
                        (periodLimit.trim() && parsedPeriodLimit == null) ||
                        showPeriodCapMessage ||
                        fieldErrors.period
                          ? { borderColor: colors.danger, borderWidth: 1.5 }
                          : null,
                      ]}
                    >
                      <NumericAmountInput
                        ref={periodInputRef}
                        value={periodLimit}
                        onChangeText={handlePeriodLimitChange}
                        placeholder={periodFrequency === 'biweekly' ? '300' : '150'}
                        placeholderTextColor={colors.textMuted}
                        style={[styles.inputWithSuffix, { color: colors.text }]}
                      />
                      <Text style={[styles.suffix, { color: colors.textSecondary }]}>$</Text>
                    </View>
                    {showPeriodCapMessage ? (
                      <Text style={[styles.fieldError, { color: colors.warning }]}>
                        {PERIOD_EXCEED_MONTHLY_MESSAGE}
                      </Text>
                    ) : !fieldErrors.period ? (
                      <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                        Facultatif · l’enveloppe budget reste mensuelle
                      </Text>
                    ) : null}
                  </View>

                  {atCapacity ? (
                    <ThemedFormMessage
                      variant="error"
                      title="Trop de catégories"
                      message={describeCategoryCapacityBlocker(MAX_BUDGET_CATEGORIES)}
                    />
                  ) : null}

                  {allocationHeadroom.warning ? (
                    <ThemedFormMessage
                      variant="warning"
                      title="Au-delà de ton revenu"
                      message={allocationHeadroom.warning}
                    />
                  ) : null}

                  {feedback ? <ThemedFormMessage {...feedback} /> : null}

                  <PrimarySaveButton
                    label={saving ? 'Création...' : 'Créer la catégorie'}
                    onPress={() => void handleSave()}
                    loading={saving}
                    disabled={!canSubmit}
                  />
                </View>
                </View>
              </Animated.ScrollView>
            </GestureDetector>
          </Animated.View>
        </GestureDetector>
      </FormSheetModalBody>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalBackdrop: {
    flex: 1,
  },
  dragBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sheetChrome: {
    flexShrink: 0,
    paddingTop: FORM_SHEET_CONTENT_PADDING_TOP,
  },
  sheetHeaderPad: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  formBody: {
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  section: {
    gap: spacing.sm,
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
  fieldError: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    lineHeight: 18,
  },
  /** Way out of a duplicate name: reuse the existing envelope instead. */
  resolutionButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  resolutionLabel: {
    ...typographyKit.metaSemibold,
  },
  iconOptionRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  pressed: {
    opacity: 0.78,
  },
});

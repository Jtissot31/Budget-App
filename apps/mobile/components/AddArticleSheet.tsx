import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextStyle,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DraggableSheetSurface } from '@/components/DraggableSheetSurface';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetCategoryPicker } from '@/components/BudgetCategoryPicker';
import { DetailSubSection } from '@/components/DetailSectionRows';
import { EditableField } from '@/components/EditableField';
import { GhostNumpad } from '@/components/GhostNumpad';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import type { SettingsPickerOption } from '@/components/SettingsPickerSheet';
import {
  containerSurfaceStyle,
  detailSectionLabelStyle,
  detailSubSectionHeaderStyle,
  moneyAmountTypography,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { loadBudgetCategoriesForPicker } from '@/lib/budgetCategories';
import { inferCategoryId } from '@/lib/categoryInference';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { formatMoneyAmountInput } from '@/lib/formatMoneyAmountInput';
import { parseFormattedNumber } from '@/lib/formatNumber';
import { isArticlePriceWithinBudget } from '@/lib/itemizedNote';
import { tapHaptic } from '@/lib/haptics';
import { detailRowEditableContainer, detailRowSelectValueText } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';
import type { Category } from '@/types';

const detailRowSelectTextStyle: TextStyle = {
  ...detailRowSelectValueText,
  textAlign: 'right',
};

type AddArticleStep = 'name' | 'category' | 'price';
type AddArticleVariant = 'sheet' | 'inline';

export type InlineArticleScrollTarget = {
  /** Y of the name input row top, relative to the inline form container. */
  nameTop: number;
  /** Y of the bottom edge of the name input, relative to the inline form container. */
  nameBottom: number;
  /** Bottom edge to keep above the keyboard (suggestions list or name input). */
  extentBottom: number;
};

export function isInlineArticleScrollTargetReady(target: InlineArticleScrollTarget): boolean {
  return target.extentBottom > 0 || target.nameBottom > 0;
}

export type AddArticleSheetProps = {
  visible: boolean;
  onAdd: (name: string, price: string, categoryId: string | null, categoryName: string | null) => void;
  onClose: () => void;
  variant?: AddArticleVariant;
  /** Max price allowed for this article (transaction total minus existing articles). Omit for no cap. */
  maxArticlePrice?: number;
  scrollToOffset?: (localY: number, offset?: number) => void;
  onInlineScrollTargetChange?: (target: InlineArticleScrollTarget) => void;
  onNameFocusChange?: (focused: boolean) => void;
  onContentLayout?: () => void;
};

const MIN_NAME_CHARS_FOR_INFERENCE = 2;

export function AddArticleSheet({
  visible,
  onAdd,
  onClose,
  variant = 'sheet',
  maxArticlePrice,
  scrollToOffset,
  onInlineScrollTargetChange,
  onNameFocusChange,
  onContentLayout,
}: AddArticleSheetProps) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * 0.88);
  const isInline = variant === 'inline';
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [step, setStep] = useState<AddArticleStep>('name');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryManuallySelected, setCategoryManuallySelected] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const nameInputRef = useRef<TextInput>(null);
  const nameInputFocusedRef = useRef(false);
  const sheetScrollRef = useRef<ScrollView>(null);
  const nameSectionY = useRef(0);
  const nameInputBottomY = useRef(0);
  const formExtentBottomY = useRef(0);
  const categorySectionY = useRef(0);
  const priceSectionY = useRef(0);
  const numpadSectionY = useRef(0);
  const prevInlineExtentBottom = useRef(0);

  const displayPrice = useMemo(
    () => (price.length ? formatMoneyAmountInput(price) : '0,00'),
    [price],
  );

  useEffect(() => {
    if (!visible) return;
    setCategoryId(null);
    setCategoryManuallySelected(false);
    let cancelled = false;

    const loadCategories = () =>
      loadBudgetCategoriesForPicker()
        .then((cats) => {
          if (!cancelled) setCategories(cats);
        })
        .catch(() => {
          if (!cancelled) setCategories([]);
        });

    void loadCategories();
    const unsubscribe = dataEvents.subscribe(() => {
      void loadCategories();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [visible]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const inferredCategoryId = useMemo(() => {
    const articleName = name.trim();
    if (articleName.length < MIN_NAME_CHARS_FOR_INFERENCE || categories.length === 0) return null;
    return inferCategoryId(articleName, categories, null);
  }, [categories, name]);

  const effectiveCategoryId = categoryManuallySelected ? categoryId : (categoryId ?? inferredCategoryId);

  const categoryOptions = useMemo<SettingsPickerOption<string>[]>(
    () =>
      categories.map((category) => ({
        id: category.id,
        label: category.name,
        budgetCategoryIcon: { icon: category.icon, name: category.name },
      })),
    [categories],
  );

  const categoryLabel = useMemo(() => {
    if (!effectiveCategoryId) return '';
    return categoryById.get(effectiveCategoryId)?.name ?? '';
  }, [categoryById, effectiveCategoryId]);

  const trimmedName = name.trim();

  const buildInlineScrollTarget = useCallback((): InlineArticleScrollTarget => {
    const nameTop = nameSectionY.current;
    const nameBottom =
      nameInputBottomY.current > 0 ? nameTop + nameInputBottomY.current : nameTop;
    const extentBottom = formExtentBottomY.current > 0 ? formExtentBottomY.current : nameBottom;
    return { nameTop, nameBottom, extentBottom };
  }, []);

  const scrollToY = useCallback((y: number, offset = 16) => {
    if (isInline) {
      if (scrollToOffset) {
        scrollToOffset(y, offset);
      }
      return;
    }
    sheetScrollRef.current?.scrollTo({ y: Math.max(y - offset, 0), animated: true });
  }, [isInline, scrollToOffset]);

  const notifyInlineContentLayout = useCallback((force = false) => {
    if (!isInline) return;
    const target = buildInlineScrollTarget();
    const extentChanged = target.extentBottom !== prevInlineExtentBottom.current;
    prevInlineExtentBottom.current = target.extentBottom;
    if (isInlineArticleScrollTargetReady(target)) {
      onInlineScrollTargetChange?.(target);
    }
    if (force || extentChanged) {
      onContentLayout?.();
    }
  }, [buildInlineScrollTarget, isInline, onContentLayout, onInlineScrollTargetChange]);

  const scrollToPriceNumpad = useCallback(() => {
    const targetY =
      numpadSectionY.current > 0
        ? priceSectionY.current + numpadSectionY.current
        : priceSectionY.current;
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollToY(targetY);
      }, 120);
    });
  }, [scrollToY]);

  const goToPriceStep = useCallback(() => {
    tapHaptic();
    Keyboard.dismiss();
    nameInputRef.current?.blur();
    setStep('price');
    scrollToPriceNumpad();
  }, [scrollToPriceNumpad]);

  const goToCategoryStep = useCallback(() => {
    if (!name.trim()) return;
    tapHaptic();
    Keyboard.dismiss();
    nameInputRef.current?.blur();
    if (categories.length === 0) {
      goToPriceStep();
      return;
    }
    setStep('category');
    requestAnimationFrame(() => {
      scrollToY(categorySectionY.current);
    });
  }, [categories.length, goToPriceStep, name, scrollToY]);

  const onCategorySelect = useCallback((selectedCategoryId: string) => {
    setCategoryId(selectedCategoryId);
    setCategoryManuallySelected(true);
    if (isInline) {
      Keyboard.dismiss();
      return;
    }
    goToPriceStep();
  }, [goToPriceStep, isInline]);

  const reset = useCallback(() => {
    setName('');
    setPrice('');
    setStep('name');
    setCategoryId(null);
    setCategoryManuallySelected(false);
    nameInputFocusedRef.current = false;
    prevInlineExtentBottom.current = 0;
  }, []);

  useEffect(() => {
    if (!visible) return;
    setStep('name');
    prevInlineExtentBottom.current = 0;
    const focusTimer = setTimeout(() => {
      nameInputRef.current?.focus();
    }, isInline ? 120 : 400);
    return () => clearTimeout(focusTimer);
  }, [isInline, visible]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const hasBudgetCap = maxArticlePrice != null && Number.isFinite(maxArticlePrice);
  // Soft hint only when remaining > 0. Never hard-block with « entièrement réparti »
  // (empty form often has amount 0 → remaining 0; with articles, user may still add lines).
  const softBudgetCap = hasBudgetCap && maxArticlePrice > 0 ? maxArticlePrice : undefined;

  const handlePriceChange = useCallback((next: string) => {
    if (softBudgetCap == null) {
      setPrice(next);
      return;
    }
    if (next.length === 0) {
      setPrice('');
      return;
    }
    const parsed = parseFormattedNumber(next);
    if (!Number.isFinite(parsed) || isArticlePriceWithinBudget(parsed, softBudgetCap)) {
      setPrice(next);
    }
  }, [softBudgetCap]);

  const parsedPrice = parseFormattedNumber(price);
  const hasValidPrice = price.length > 0 && Number.isFinite(parsedPrice) && parsedPrice > 0;
  const priceWithinBudget =
    softBudgetCap == null
      ? hasValidPrice
      : hasValidPrice && isArticlePriceWithinBudget(parsedPrice, softBudgetCap);
  // Category is optional while adding an article — required only on form Enregistrer.
  const canAdvanceFromName = trimmedName.length > 0;
  const canAdvanceFromCategory = true;
  const canSave = canAdvanceFromName && priceWithinBudget;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed || !canSave) return;
    tapHaptic();
    const resolvedCategoryId = categoryManuallySelected ? categoryId : (categoryId ?? inferredCategoryId);
    const resolvedCategory = resolvedCategoryId ? categoryById.get(resolvedCategoryId) : undefined;
    onAdd(trimmed, price, resolvedCategoryId ?? null, resolvedCategory?.name ?? null);
    reset();
    if (isInline) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 120);
      });
      return;
    }
    onClose();
  };

  const handlePrimaryAction = () => {
    if (!isInline && step === 'name') {
      goToCategoryStep();
      return;
    }
    if (!isInline && step === 'category') {
      if (!canAdvanceFromCategory) return;
      goToPriceStep();
      return;
    }
    handleSave();
  };

  const primaryLabel = !isInline && step !== 'price' ? 'Suivant' : 'Ajouter';
  const primaryDisabled = isInline ? !canSave : (
    step === 'name' ? !canAdvanceFromName : step === 'category' ? !canAdvanceFromCategory : !canSave
  );
  const inputSurface = containerSurfaceStyle(isLight);

  if (isInline && !visible) {
    return null;
  }

  const categoryPickerField = (
    <EditableField
      type="select"
      value={categoryLabel}
      selectedId={effectiveCategoryId ?? ''}
      selectOptions={categoryOptions}
      pickerTitle="Catégorie"
      onSave={onCategorySelect}
      placeholder="Choisir une catégorie"
      accessibilityLabel="Choisir la catégorie"
      align="right"
      containerStyle={detailRowEditableContainer}
      textStyle={detailRowSelectTextStyle}
    />
  );

  const sheetNameField = (
    <View
      style={styles.articleFieldGroup}
      onLayout={(event) => {
        nameSectionY.current = event.nativeEvent.layout.y;
      }}
    >
      <Text style={[detailSubSectionHeaderStyle(), { color: colors.textMuted }]}>Nom</Text>
      <View
        style={[
          styles.articleInputShell,
          {
            backgroundColor: inputSurface.backgroundColor,
            borderColor: inputSurface.borderColor,
            borderWidth: inputSurface.borderWidth,
          },
        ]}
      >
        <TextInput
          key="article-name-input"
          ref={nameInputRef}
          style={[styles.articleNameInput, { color: colors.text }]}
          placeholder="Nom de l'article…"
          placeholderTextColor={colors.textMuted}
          value={name}
          autoCorrect={false}
          autoComplete="off"
          onChangeText={(text) => {
            setName(text);
            if (step === 'price' || step === 'category') {
              setStep('name');
              setCategoryId(null);
              setCategoryManuallySelected(false);
            }
          }}
          onFocus={() => {
            nameInputFocusedRef.current = true;
            setStep('name');
            onNameFocusChange?.(true);
          }}
          onBlur={() => {
            nameInputFocusedRef.current = false;
            onNameFocusChange?.(false);
          }}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={goToCategoryStep}
        />
      </View>
    </View>
  );

  const inlineNameAmountRow = (
    <View
      style={styles.inlineNameAmountRow}
      onLayout={(event) => {
        const { y, height } = event.nativeEvent.layout;
        nameSectionY.current = y;
        nameInputBottomY.current = height;
        notifyInlineContentLayout();
      }}
    >
      <View
        style={[
          styles.inlineNameShell,
          {
            backgroundColor: inputSurface.backgroundColor,
            borderColor: inputSurface.borderColor,
            borderWidth: inputSurface.borderWidth,
          },
        ]}
      >
        <TextInput
          key="article-name-input"
          ref={nameInputRef}
          style={[styles.inlineNameInput, { color: colors.text }]}
          placeholder="Nom article…"
          placeholderTextColor={colors.textMuted}
          value={name}
          autoCorrect={false}
          autoComplete="off"
          onChangeText={(text) => {
            setName(text);
            if (!text.trim()) {
              setCategoryId(null);
              setCategoryManuallySelected(false);
            }
          }}
          onFocus={() => {
            nameInputFocusedRef.current = true;
            notifyInlineContentLayout(true);
            onNameFocusChange?.(true);
          }}
          onBlur={() => {
            nameInputFocusedRef.current = false;
            onNameFocusChange?.(false);
          }}
          returnKeyType="done"
          blurOnSubmit={false}
          onSubmitEditing={() => {
            Keyboard.dismiss();
            nameInputRef.current?.blur();
          }}
        />
      </View>
    </View>
  );

  const nestedFieldLabelStyle = [
    styles.nestedFieldLabel,
    { color: colors.textMuted },
  ];

  const inlinePriceField = (
    <View style={styles.inlinePriceBlock}>
      <Text style={nestedFieldLabelStyle}>Prix</Text>
      <View
        style={[
          styles.inlinePriceShell,
          {
            backgroundColor: inputSurface.backgroundColor,
            borderColor: inputSurface.borderColor,
            borderWidth: inputSurface.borderWidth,
          },
        ]}
      >
        <Text
          style={[
            styles.inlinePriceCurrency,
            moneyAmountTypography({ tier: 'row' }),
            { color: colors.textMuted },
          ]}
        >
          $
        </Text>
        <NumericAmountInput
          style={[
            styles.inlinePriceInput,
            moneyAmountTypography({ tier: 'row' }),
            { color: price.length > 0 ? colors.text : colors.textMuted },
          ]}
          placeholder="0,00"
          placeholderTextColor={colors.textMuted}
          value={price}
          onChangeText={handlePriceChange}
          keyboardType="decimal-pad"
          accessibilityLabel="Montant de l'article"
        />
      </View>
      {softBudgetCap != null ? (
        <Text style={[styles.inlineBudgetHint, typographyKit.microMedium, { color: colors.textMuted }]}>
          Max. {formatDisplayMoneyAbsolute(softBudgetCap)}
        </Text>
      ) : null}
    </View>
  );

  const inlineCancelLink = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Annuler"
      onPress={handleClose}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={({ pressed }) => [styles.inlineCancelLink, pressed && styles.pressed]}
    >
      <Text style={[typographyKit.microMedium, { color: colors.textMuted }]}>Annuler</Text>
    </Pressable>
  );

  const sheetCategoryField = categories.length > 0 ? (
    <View
      onLayout={(event) => {
        categorySectionY.current = event.nativeEvent.layout.y;
      }}
    >
      <DetailSubSection
        section={{
          title: 'Catégorie',
          rows: [
            {
              label: 'Catégorie',
              value: categoryLabel,
              icon: 'pricetag-outline',
              valueContent: categoryPickerField,
            },
          ],
        }}
        colors={colors}
      />
    </View>
  ) : null;

  const inlineCategoryField = categories.length > 0 ? (
    <View
      style={styles.inlineCategoryBlock}
      onLayout={() => {
        notifyInlineContentLayout();
      }}
    >
      <BudgetCategoryPicker
        categories={categories}
        searchText={trimmedName}
        selectedId={effectiveCategoryId}
        onSelect={onCategorySelect}
        labelStyle={nestedFieldLabelStyle}
      />
    </View>
  ) : null;

  const inlineFooterActions = (
    <View style={[styles.inlineFooterActions, { borderTopColor: colors.border }]}>
      {inlineCancelLink}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajouter l'article"
        disabled={!canSave}
        onPress={handleSave}
        style={({ pressed }) => [
          styles.inlineAddButton,
          { backgroundColor: colors.primary },
          !canSave && styles.inlineAddButtonDisabled,
          pressed && canSave && styles.pressed,
        ]}
      >
        <Text
          style={[
            typographyKit.caption,
            styles.inlineAddButtonLabel,
            { color: canSave ? '#000000' : colors.textMuted },
          ]}
        >
          Ajouter
        </Text>
      </Pressable>
    </View>
  );

  const sheetPriceField = (
    <View
      style={styles.articleFieldGroup}
      onLayout={(event) => {
        priceSectionY.current = event.nativeEvent.layout.y;
      }}
    >
      <View style={styles.articlePriceHeaderRow}>
        <Text style={[detailSubSectionHeaderStyle(), { color: colors.textMuted }]}>Prix</Text>
        {softBudgetCap != null ? (
          <Text style={[styles.articlePriceBudgetHint, typographyKit.metaMedium, { color: colors.textMuted }]}>
            Max. {formatDisplayMoneyAbsolute(softBudgetCap)}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.articlePriceShell,
          {
            backgroundColor: inputSurface.backgroundColor,
            borderColor: inputSurface.borderColor,
            borderWidth: inputSurface.borderWidth,
          },
        ]}
      >
        <Text style={[styles.articleCurrencySymbol, moneyAmountTypography({ tier: 'stat' }), { color: colors.textMuted }]}>
          $
        </Text>
        <Text style={[styles.articlePriceInput, moneyAmountTypography({ tier: 'stat' }), { color: colors.text }]}>
          {displayPrice}
        </Text>
      </View>
      <View
        onLayout={(event) => {
          numpadSectionY.current = event.nativeEvent.layout.y;
        }}
      >
        <GhostNumpad value={price} onChange={handlePriceChange} />
      </View>
    </View>
  );

  const actionRow = (
    <View style={styles.articleSheetActions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Annuler"
        onPress={handleClose}
        style={({ pressed }) => [
          styles.articleCancelButton,
          { borderColor: colors.border },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.articleCancelButtonText, { color: colors.textMuted }]}>Annuler</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={!isInline && step !== 'price' ? 'Étape suivante' : "Confirmer l'article"}
        disabled={primaryDisabled}
        onPress={handlePrimaryAction}
        style={({ pressed }) => [
          styles.articleSaveButton,
          { backgroundColor: colors.primary },
          primaryDisabled && styles.articleSaveButtonDisabled,
          pressed && !primaryDisabled && styles.pressed,
        ]}
      >
        <Text style={styles.articleSaveButtonText}>{primaryLabel}</Text>
      </Pressable>
    </View>
  );

  const inlineFormBody = (
    <View
      style={styles.inlineArticleForm}
      onLayout={(event) => {
        formExtentBottomY.current = event.nativeEvent.layout.height;
        notifyInlineContentLayout();
      }}
    >
      {inlineNameAmountRow}
      {inlinePriceField}
      {inlineCategoryField}
      {inlineFooterActions}
    </View>
  );

  const sheetFormBody = (
    <>
      <View style={styles.articleSheetHeader}>
        <Text style={[detailSectionLabelStyle(), { color: colors.textMuted }]}>ARTICLE</Text>
        <Text style={[typographyKit.bodyBold, { color: colors.text }]}>Ajouter un article</Text>
      </View>

      <View style={styles.articleSheetFixedTop}>
        {sheetNameField}
      </View>

      <ScrollView
        ref={sheetScrollRef}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.articleSheetScroll}
        contentContainerStyle={styles.articleSheetScrollContent}
      >
        {sheetCategoryField}
        {sheetPriceField}
      </ScrollView>

      {actionRow}
    </>
  );

  if (isInline) {
    return inlineFormBody;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            style={styles.sheetBackdropDismiss}
            onPress={handleClose}
          />
          <DraggableSheetSurface
            onClose={handleClose}
            sheetHeight={sheetHeight}
            style={[
              styles.articleSheet,
              {
                backgroundColor: colors.containerBackground,
                borderColor: colors.containerBorder,
                paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xl),
              },
            ]}
          >
            <View style={[styles.articleSheetHandle, { backgroundColor: colors.border }]} />
            {sheetFormBody}
          </DraggableSheetSurface>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end' as const,
  },
  sheetBackdropDismiss: {
    flex: 1,
  },
  pressed: { opacity: 0.78 },
  articleSheet: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    maxHeight: '88%',
  },
  articleSheetHandle: {
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center' as const,
    marginBottom: spacing.sm,
  },
  articleSheetHeader: {
    gap: spacing.xs,
  },
  inlineArticleForm: {
    gap: spacing.md,
    overflow: 'visible' as const,
    zIndex: 10,
  },
  /** Nested under ARTICLES — quieter than major section eyebrows. */
  nestedFieldLabel: {
    ...typographyKit.microMedium,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  inlineNameAmountRow: {
    paddingBottom: spacing.xs,
  },
  inlineNameShell: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center' as const,
  },
  inlineNameInput: {
    ...typographyKit.bodyMedium,
    paddingVertical: spacing.sm,
    backgroundColor: 'transparent',
  },
  inlinePriceBlock: {
    gap: spacing.sm,
  },
  inlinePriceShell: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 50,
  },
  inlinePriceCurrency: {
    flexShrink: 0,
  },
  inlinePriceInput: {
    flex: 1,
    minWidth: 96,
    paddingVertical: spacing.sm,
    textAlign: 'left' as const,
    backgroundColor: 'transparent',
  },
  inlineBudgetHint: {
    textAlign: 'right' as const,
    paddingRight: spacing.xs,
  },
  inlineCategoryBlock: {
    gap: spacing.sm,
  },
  inlineFooterActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.xs,
    paddingTop: spacing.md + 2,
  },
  inlineCancelLink: {
    flexShrink: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  inlineAddButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  inlineAddButtonDisabled: {
    opacity: 0.35,
    backgroundColor: 'transparent',
  },
  inlineAddButtonLabel: {
    letterSpacing: 0.1,
  },
  articleSheetFixedTop: {
    gap: spacing.md,
  },
  articleSheetScroll: {
    flexShrink: 1,
    flexGrow: 0,
  },
  articleSheetScrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  articleFieldGroup: {
    gap: spacing.xs,
  },
  articlePriceHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
  },
  articlePriceBudgetHint: {
    flexShrink: 1,
    textAlign: 'right' as const,
  },
  articleInputShell: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center' as const,
  },
  articleNameInput: {
    ...typographyKit.bodyMedium,
    paddingVertical: spacing.sm,
    backgroundColor: 'transparent',
  },
  articlePriceShell: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  articleCurrencySymbol: {
    fontSize: 24,
    letterSpacing: -0.5,
  },
  articlePriceInput: {
    flex: 1,
    fontSize: 32,
    letterSpacing: -1,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  articleSheetActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  articleCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  articleCancelButtonText: {
    ...typographyKit.metaMedium,
  },
  articleSaveButton: {
    flex: 1.35,
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  articleSaveButtonText: {
    ...typographyKit.caption,
    color: '#000000',
    letterSpacing: 0.1,
  },
  articleSaveButtonDisabled: {
    opacity: 0.35,
  },
});

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
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GhostNumpad } from '@/components/GhostNumpad';
import { getCategoryIconName } from '@/constants/categoryOptions';
import {
  articlesReceiptTypography,
  chipSelectableShellStyle,
  containerSurfaceStyle,
  detailSectionLabelStyle,
  detailSubSectionHeaderStyle,
  interBoldText,
  radius,
  spacing,
  tagContainerStyle,
  tagTypography,
  typography,
  typographyKit,
} from '@/constants/theme';
import { getCategorySearchChoices, inferCategoryId } from '@/lib/categoryInference';
import {
  filterActiveCategoryBudgets,
  getArticleNameHistory,
  getCategories,
  getCategoryBudgets,
} from '@/lib/db';
import { formatMoneyAmountInput } from '@/lib/formatMoneyAmountInput';
import { tapHaptic } from '@/lib/haptics';
import { normalizeArticleSearch } from '@/lib/itemizedNote';
import { chipLabelTextProps, singleLineLabelStyle } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';
import type { Category } from '@/types';

const FRENCH_ARTICLE_PRESETS = [
  'Pain', 'Lait', 'Café', 'Eau', 'Légumes', 'Fruits', 'Viande', 'Fromage',
  'Beurre', 'Œufs', 'Pâtes', 'Riz', 'Sucre', 'Sel', 'Huile', 'Farine',
  'Yaourt', 'Jus', 'Savon', 'Shampoing',
];

type AddArticleStep = 'name' | 'category' | 'price';
type AddArticleVariant = 'sheet' | 'inline';

export type AddArticleSheetProps = {
  visible: boolean;
  onAdd: (name: string, price: string, categoryId: string | null, categoryName: string | null) => void;
  onClose: () => void;
  defaultCategoryId?: string | null;
  merchantHint?: string;
  variant?: AddArticleVariant;
  scrollToOffset?: (localY: number, offset?: number) => void;
};

export function AddArticleSheet({
  visible,
  onAdd,
  onClose,
  defaultCategoryId,
  merchantHint,
  variant = 'sheet',
  scrollToOffset,
}: AddArticleSheetProps) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isInline = variant === 'inline';
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [step, setStep] = useState<AddArticleStep>('name');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryManuallySelected, setCategoryManuallySelected] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suggestionPool, setSuggestionPool] = useState<string[]>([]);
  const nameInputRef = useRef<TextInput>(null);
  const sheetScrollRef = useRef<ScrollView>(null);
  const categorySectionY = useRef(0);
  const priceSectionY = useRef(0);
  const numpadSectionY = useRef(0);

  const displayPrice = useMemo(
    () => (price.length ? formatMoneyAmountInput(price) : '0,00'),
    [price],
  );

  useEffect(() => {
    if (!visible) return;
    setCategoryId(defaultCategoryId ?? null);
    setCategoryManuallySelected(false);
    getArticleNameHistory()
      .then((history) => {
        const historyLower = new Set(history.map((n) => n.toLowerCase()));
        const extras = FRENCH_ARTICLE_PRESETS.filter((p) => !historyLower.has(p.toLowerCase()));
        setSuggestionPool([...history, ...extras]);
      })
      .catch(() => {
        setSuggestionPool(FRENCH_ARTICLE_PRESETS);
      });
    void Promise.all([getCategories(), getCategoryBudgets()])
      .then(([cats, budgets]) => {
        const budgetIds = new Set(filterActiveCategoryBudgets(budgets).map((b) => b.categoryId));
        setCategories(cats.filter((c) => c.name !== 'Revenus' && budgetIds.has(c.id)));
      })
      .catch(() => {
        void getCategories().then((cats) => setCategories(cats.filter((c) => c.name !== 'Revenus')));
      });
  }, [defaultCategoryId, visible]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const inferredCategoryId = useMemo(() => {
    const searchText = name.trim() || merchantHint?.trim() || '';
    if (!searchText || categories.length === 0) return null;
    return inferCategoryId(searchText, categories, defaultCategoryId ?? null);
  }, [categories, defaultCategoryId, merchantHint, name]);

  const effectiveCategoryId = categoryManuallySelected ? categoryId : (categoryId ?? inferredCategoryId);

  const categoryChoices = useMemo(
    () => getCategorySearchChoices(name.trim() || merchantHint?.trim() || '', categories, effectiveCategoryId),
    [categories, effectiveCategoryId, merchantHint, name],
  );

  const filteredSuggestions = useMemo(() => {
    const query = name.trim();
    if (!query) return [];
    const normalizedQuery = normalizeArticleSearch(query);
    const prefixMatches: string[] = [];
    const containsMatches: string[] = [];
    for (const item of suggestionPool) {
      const normalizedItem = normalizeArticleSearch(item);
      if (normalizedItem === normalizedQuery) continue;
      if (normalizedItem.startsWith(normalizedQuery)) {
        prefixMatches.push(item);
      } else if (normalizedItem.includes(normalizedQuery)) {
        containsMatches.push(item);
      }
    }
    return [...prefixMatches, ...containsMatches].slice(0, 6);
  }, [name, suggestionPool]);

  const showSuggestionSection = name.trim().length > 0;

  const scrollToY = useCallback((y: number, offset = 16) => {
    if (isInline && scrollToOffset) {
      scrollToOffset(y, offset);
      return;
    }
    sheetScrollRef.current?.scrollTo({ y: Math.max(y - offset, 0), animated: true });
  }, [isInline, scrollToOffset]);

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

  const selectSuggestion = useCallback((item: string) => {
    tapHaptic();
    setName(item);
    Keyboard.dismiss();
    nameInputRef.current?.blur();
    if (categories.length === 0) {
      setStep('price');
      scrollToPriceNumpad();
      return;
    }
    setStep('category');
    requestAnimationFrame(() => {
      scrollToY(categorySectionY.current);
    });
  }, [categories.length, scrollToPriceNumpad, scrollToY]);

  const onCategorySelect = useCallback((selectedCategoryId: string) => {
    setCategoryId(selectedCategoryId);
    setCategoryManuallySelected(true);
    goToPriceStep();
  }, [goToPriceStep]);

  const reset = useCallback(() => {
    setName('');
    setPrice('');
    setStep('name');
    setCategoryId(null);
    setCategoryManuallySelected(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setStep('name');
    const focusTimer = setTimeout(() => {
      if (isInline) {
        scrollToY(0, 24);
      }
      nameInputRef.current?.focus();
    }, isInline ? 120 : 400);
    return () => clearTimeout(focusTimer);
  }, [isInline, scrollToY, visible]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    tapHaptic();
    const resolvedCategoryId = categoryManuallySelected ? categoryId : (categoryId ?? inferredCategoryId);
    const resolvedCategory = resolvedCategoryId ? categoryById.get(resolvedCategoryId) : undefined;
    onAdd(trimmed, price, resolvedCategoryId ?? null, resolvedCategory?.name ?? null);
    reset();
    onClose();
  };

  const canSave = name.trim().length > 0;
  const inputSurface = containerSurfaceStyle(isLight);
  const chipBorderMuted = colors.border;

  if (isInline && !visible) {
    return null;
  }

  const nameField = (
    <View style={styles.articleFieldGroup}>
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
          ref={nameInputRef}
          style={[styles.articleNameInput, { color: colors.text }]}
          placeholder="Nom de l'article…"
          placeholderTextColor={colors.textMuted}
          value={name}
          autoCorrect={false}
          autoComplete="off"
          onChangeText={(text) => {
            setName(text);
            if (step === 'price' || step === 'category') setStep('name');
          }}
          onFocus={() => setStep('name')}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={goToCategoryStep}
        />
      </View>
    </View>
  );

  const suggestionField = showSuggestionSection ? (
    <View style={styles.articleSuggestionsGroup}>
      <Text style={[detailSubSectionHeaderStyle(), { color: colors.textMuted }]}>Suggestions</Text>
      <View style={styles.articleChipsRow}>
        {filteredSuggestions.length > 0 ? (
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={styles.articleChipsContent}
          >
            {filteredSuggestions.map((item) => (
              <Pressable
                key={item}
                onPress={() => selectSuggestion(item)}
                style={({ pressed }) => [
                  tagContainerStyle({
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    bordered: true,
                    pill: true,
                  }),
                  pressed && styles.articlePressed,
                ]}
              >
                <Text style={tagTypography({ color: colors.text })}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  ) : null;

  const categoryField = categories.length > 0 ? (
    <View
      style={styles.articleFieldGroup}
      onLayout={(event) => {
        categorySectionY.current = event.nativeEvent.layout.y;
      }}
    >
      <Text style={[detailSubSectionHeaderStyle(), { color: colors.textMuted }]}>Catégorie</Text>
      <View
        style={[
          styles.articleCategoryShell,
          {
            backgroundColor: inputSurface.backgroundColor,
            borderColor: inputSurface.borderColor,
            borderWidth: inputSurface.borderWidth,
          },
        ]}
      >
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.articleCategoryContent}
        >
          {categoryChoices.map((category) => {
            const selected = effectiveCategoryId === category.id;
            const isInferredOnly =
              selected && !categoryManuallySelected && categoryId === null && inferredCategoryId === category.id;
            return (
              <Pressable
                key={category.id}
                onPress={() => onCategorySelect(category.id)}
                style={({ pressed }) => [
                  styles.articleCategoryChip,
                  chipSelectableShellStyle(selected ? colors.primary : chipBorderMuted),
                  {
                    backgroundColor: selected ? colors.successMuted : colors.surfaceElevated,
                  },
                  pressed && styles.articlePressed,
                ]}
              >
                <Ionicons
                  name={getCategoryIconName(category)}
                  size={13}
                  color={selected ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.articleCategoryChipText,
                    singleLineLabelStyle,
                    { color: selected ? colors.primary : colors.text },
                  ]}
                  {...chipLabelTextProps()}
                >
                  {isInferredOnly ? `→ ${category.name}` : category.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  ) : null;

  const priceField = (
    <View
      style={styles.articleFieldGroup}
      onLayout={(event) => {
        priceSectionY.current = event.nativeEvent.layout.y;
      }}
    >
      <Text style={[detailSubSectionHeaderStyle(), { color: colors.textMuted }]}>Prix</Text>
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
        <Text style={[styles.articleCurrencySymbol, articlesReceiptTypography('medium'), { color: colors.textMuted }]}>
          $
        </Text>
        <Text style={[styles.articlePriceInput, articlesReceiptTypography('medium'), { color: colors.text }]}>
          {displayPrice}
        </Text>
      </View>
      <View
        onLayout={(event) => {
          numpadSectionY.current = event.nativeEvent.layout.y;
        }}
      >
        <GhostNumpad value={price} onChange={setPrice} />
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
        accessibilityLabel="Confirmer l'article"
        disabled={!canSave}
        onPress={handleSave}
        style={({ pressed }) => [
          styles.articleSaveButton,
          { backgroundColor: colors.primary },
          !canSave && styles.articleSaveButtonDisabled,
          pressed && canSave && styles.pressed,
        ]}
      >
        <Text style={styles.articleSaveButtonText}>Ajouter</Text>
      </Pressable>
    </View>
  );

  const scrollableFields = (
    <>
      {categoryField}
      {priceField}
    </>
  );

  const formBody = isInline ? (
    <View
      style={[
        styles.inlineArticleForm,
        {
          backgroundColor: inputSurface.backgroundColor,
          borderColor: inputSurface.borderColor,
          borderWidth: inputSurface.borderWidth,
        },
      ]}
    >
      <View style={styles.inlineArticleHeader}>
        <Text style={[detailSectionLabelStyle(), { color: colors.textMuted }]}>ARTICLE</Text>
        <Text style={[typographyKit.bodyBold, { color: colors.text }]}>Ajouter un article</Text>
      </View>
      {nameField}
      {suggestionField}
      {scrollableFields}
      {actionRow}
    </View>
  ) : (
    <>
      <View style={styles.articleSheetHeader}>
        <Text style={[detailSectionLabelStyle(), { color: colors.textMuted }]}>ARTICLE</Text>
        <Text style={[typographyKit.bodyBold, { color: colors.text }]}>Ajouter un article</Text>
      </View>

      <View style={styles.articleSheetFixedTop}>
        {nameField}
        {suggestionField}
      </View>

      <ScrollView
        ref={sheetScrollRef}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.articleSheetScroll}
        contentContainerStyle={styles.articleSheetScrollContent}
      >
        {scrollableFields}
      </ScrollView>

      {actionRow}
    </>
  );

  if (isInline) {
    return formBody;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
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
        <View
          style={[
            styles.articleSheet,
            {
              backgroundColor: colors.containerBackground,
              borderColor: colors.containerBorder,
              paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xl),
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.articleSheetHandle, { backgroundColor: colors.border }]} />
          {formBody}
        </View>
      </KeyboardAvoidingView>
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
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  inlineArticleHeader: {
    gap: spacing.xs,
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
  articleSuggestionsGroup: {
    gap: spacing.xs,
  },
  articleChipsRow: {
    minHeight: 36,
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
  articleChipsContent: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  articleCategoryShell: {
    borderRadius: radius.md,
    overflow: 'hidden' as const,
  },
  articleCategoryContent: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  articleCategoryChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
  },
  articleCategoryChipText: {
    ...interBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.1,
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
  articlePressed: {
    opacity: 0.75,
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

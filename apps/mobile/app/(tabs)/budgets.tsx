// Budget tab — side hero (ring + remaining) and one Onyx card per category.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { PlusFabIcon } from '@/components/icons/PlusFabIcon';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ListRenderItem,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { BudgetCategoryDetailSheet } from '@/components/budget/BudgetCategoryDetailSheet';
import { BudgetCategoryRow } from '@/components/budget/BudgetCategoryRow';
import { BudgetCategorySuggestionTile } from '@/components/budget/BudgetCategorySuggestionTile';
import { BudgetSideHeroCard } from '@/components/budget/BudgetSideHeroCard';
import { ProtoSectionHeader } from '@/components/proto/ProtoSectionHeader';
import { PageTransition } from '@/components/PageTransition';
import {
  BUDGET_CATEGORY_SUGGESTIONS,
  type BudgetCategorySuggestion,
} from '@/constants/categoryOptions';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { SPACING } from '@/constants/design-tokens';
import {
  BUDGET_CATEGORY_TILE,
  PLAN_FINANCE_CONTAINER,
  budgetCategoryGridColumnStyle,
} from '@/constants/planFinanceKit';
import {
  FLOATING_NAV_CONTENT_PADDING,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_CONTENT_GAP,
  PAGE_TITLE_STYLE,
  destructiveIconColor,
  destructiveTextActionStyle,
  spacing,
  subtleDeleteButtonStyle,
  typographyKit,
} from '@/constants/theme';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import {
  deleteCategory,
  getCategoriesForMonth,
  initializeCategories,
} from '@/lib/budgetCategories';
import {
  canAddBudgetCategory,
  computeBudgetTotals,
  mapBudgetCategoriesToUi,
  sortBudgetCategoriesByPriority,
  type BudgetCategoryUiModel,
} from '@/lib/budgetCategoryModel';
import {
  isCurrentMonth,
  isMonthAfter,
  isMonthBefore,
  startOfMonth,
} from '@/lib/budgetMonth';
import { getMockBudgetEarliestMonthStart } from '@/lib/budgetMonthMock';
import { deleteCategoryBudget, getEarliestExpenseMonthStart } from '@/lib/db';
import { isDemoSeedEnabled } from '@/lib/demoSeedGate';
import { dataEvents } from '@/lib/events';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const SECTION_BREAK = spacing.md;
const GRID_GAP = SPACING.onyxListGap;

function currentMonthStart(): Date {
  return startOfMonth(new Date());
}

type CategoryLayout = 'list' | 'grid';

function CategoryLayoutToggle({
  value,
  onChange,
}: {
  value: CategoryLayout;
  onChange: (next: CategoryLayout) => void;
}) {
  const { colors } = useAppTheme();
  const next = value === 'list' ? 'grid' : 'list';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value === 'list' ? 'Passer en grille' : 'Passer en liste'}
      accessibilityState={{ selected: value === 'grid' }}
      hitSlop={8}
      onPress={() => onChange(next)}
      style={({ pressed }) => [pressed && pageStyles.pressed]}
    >
      <AppIcon
        family="ionicons"
        name={value === 'list' ? 'list-outline' : 'grid-outline'}
        size={16}
        color={colors.textMuted}
      />
    </Pressable>
  );
}

function BudgetPageHeader() {
  const { colors } = useAppTheme();

  return (
    <View style={pageStyles.heroBlock}>
      <Text
        style={[pageStyles.pageTitle, { color: colors.text }]}
        numberOfLines={1}
      >
        Budget du mois
      </Text>
    </View>
  );
}

export default function BudgetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors, isLight } = useAppTheme();
  const listRef = useRef<FlatList<BudgetCategoryUiModel>>(null);
  /** Measured inner width of the wrap grid (padding applied on outer shell). */
  const [gridContentWidth, setGridContentWidth] = useState(0);

  const onCategoriesGridLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    const expected = Math.max(0, windowWidth - PAGE_PADDING_HORIZONTAL * 2);
    // A collapsed grid (one-character columns) reports a sliver. Ignore it
    // so the half-width fallback from the window stays in place.
    if (next <= 0 || (expected > 0 && next < expected * 0.5)) return;
    setGridContentWidth((prev) => (prev === next ? prev : next));
  }, [windowWidth]);

  /** Half-column from real grid width; single tile uses full width. */
  const categoryCellWidthFor = useCallback(
    (count: number) => {
      const contentWidth =
        gridContentWidth > 0
          ? gridContentWidth
          : Math.max(0, windowWidth - PAGE_PADDING_HORIZONTAL * 2);
      if (count <= 1) return contentWidth;
      return Math.floor((contentWidth - GRID_GAP) / 2);
    },
    [gridContentWidth, windowWidth],
  );

  const budgetGridColumnStyle = budgetCategoryGridColumnStyle(
    gridContentWidth > 0
      ? gridContentWidth
      : Math.max(0, windowWidth - PAGE_PADDING_HORIZONTAL * 2),
  );

  const [categories, setCategories] = useState<BudgetCategoryUiModel[]>([]);
  const [detailCategoryId, setDetailCategoryId] = useState<string | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const [categoryLayout, setCategoryLayout] = useState<CategoryLayout>('list');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [confirmDeleteSelectedVisible, setConfirmDeleteSelectedVisible] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  /** Month shown in the hero and category list — always matches `categories`. */
  const [displayMonth, setDisplayMonth] = useState(currentMonthStart);
  /** Month shown in the selector — may lead `displayMonth` while data loads. */
  const [pendingMonth, setPendingMonth] = useState(currentMonthStart);
  const [earliestMonth, setEarliestMonth] = useState(currentMonthStart);
  const latestMonth = currentMonthStart();

  const displayMonthRef = useRef(displayMonth);
  displayMonthRef.current = displayMonth;
  const pendingMonthRef = useRef(pendingMonth);
  pendingMonthRef.current = pendingMonth;
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    void (async () => {
      const dbEarliest = await getEarliestExpenseMonthStart();
      if (isDemoSeedEnabled()) {
        const mockEarliest = getMockBudgetEarliestMonthStart();
        setEarliestMonth(
          isMonthBefore(mockEarliest, dbEarliest) ? mockEarliest : dbEarliest,
        );
      } else {
        setEarliestMonth(dbEarliest);
      }
    })();
  }, []);

  const loadMonth = useCallback(async (targetMonth: Date) => {
    const month = startOfMonth(targetMonth);
    const requestId = ++loadRequestIdRef.current;

    await initializeCategories();
    const budgets = await getCategoriesForMonth(month);
    if (requestId !== loadRequestIdRef.current) return;

    const mapped = mapBudgetCategoriesToUi(budgets);
    displayMonthRef.current = month;
    setDisplayMonth(month);
    setCategories(mapped);
  }, []);

  const navigateToMonth = useCallback(
    (month: Date) => {
      const next = startOfMonth(month);
      pendingMonthRef.current = next;
      setPendingMonth(next);
      setDetailCategoryId(null);
      setManagingCategories(false);
      setSelectedCategoryIds([]);
      void loadMonth(next);
    },
    [loadMonth],
  );

  useRefreshOnFocus(
    useCallback(() => {
      navigateToMonth(currentMonthStart());
    }, [navigateToMonth]),
    { minIntervalMs: 5_000 },
  );

  const refreshDisplayedMonth = useCallback(() => {
    void loadMonth(pendingMonthRef.current);
  }, [loadMonth]);

  useEffect(() => dataEvents.subscribe(refreshDisplayedMonth), [refreshDisplayedMonth]);

  useScrollToTopOnFocus(
    useCallback(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, []),
  );

  const totals = useMemo(() => computeBudgetTotals(categories), [categories]);
  const listCategories = useMemo(
    () => sortBudgetCategoriesByPriority(categories),
    [categories],
  );
  const showAddButton = canAddBudgetCategory(categories.length);

  const openCategoryDetail = useCallback((id: string) => {
    setDetailCategoryId(id);
  }, []);

  const toggleManagingCategories = useCallback(() => {
    tapHaptic();
    setManagingCategories((prev) => {
      if (prev) setSelectedCategoryIds([]);
      return !prev;
    });
  }, []);

  const selectCategoryLayout = useCallback((next: CategoryLayout) => {
    setCategoryLayout((prev) => {
      if (prev === next) return prev;
      tapHaptic();
      return next;
    });
  }, []);

  const toggleCategorySelection = useCallback((id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    );
  }, []);

  const onCategoryRowPress = useCallback(
    (id: string) => {
      if (managingCategories) {
        toggleCategorySelection(id);
        return;
      }
      openCategoryDetail(id);
    },
    [managingCategories, openCategoryDetail, toggleCategorySelection],
  );

  const openBlankCreate = useCallback(() => {
    tapHaptic();
    router.push({
      pathname: '/add-budget-category',
      params: {
        month: `${displayMonth.getFullYear()}-${String(displayMonth.getMonth() + 1).padStart(2, '0')}`,
      },
    });
  }, [displayMonth, router]);

  const openSuggestionCreate = useCallback(
    (suggestion: BudgetCategorySuggestion) => {
      router.push({
        pathname: '/add-budget-category',
        params: {
          name: suggestion.name,
          icon: suggestion.icon,
          month: `${displayMonth.getFullYear()}-${String(displayMonth.getMonth() + 1).padStart(2, '0')}`,
        },
      });
    },
    [displayMonth, router],
  );

  const openDeleteSelectedConfirm = useCallback(() => {
    if (deletingSelected || selectedCategoryIds.length === 0) return;
    tapHaptic();
    setConfirmDeleteSelectedVisible(true);
  }, [deletingSelected, selectedCategoryIds.length]);

  const handleConfirmDeleteSelected = useCallback(async () => {
    if (deletingSelected || selectedCategoryIds.length === 0) return;
    const ids = [...selectedCategoryIds];
    setConfirmDeleteSelectedVisible(false);
    setDeletingSelected(true);
    try {
      setDetailCategoryId(null);
      await Promise.all(
        ids.flatMap((id) => [deleteCategoryBudget(id), deleteCategory(id)]),
      );
      setSelectedCategoryIds([]);
      setManagingCategories(false);
      successHaptic();
      refreshDisplayedMonth();
    } finally {
      setDeletingSelected(false);
    }
  }, [deletingSelected, refreshDisplayedMonth, selectedCategoryIds]);

  const detailCategory = useMemo(
    () => categories.find((category) => category.id === detailCategoryId) ?? null,
    [categories, detailCategoryId],
  );

  const budgetMonth = startOfMonth(pendingMonth);
  const budgetEarliest = startOfMonth(earliestMonth);
  const budgetLatest = startOfMonth(latestMonth);
  const canGoBudgetPrevious = isMonthAfter(budgetMonth, budgetEarliest);
  const canGoBudgetNext = isMonthBefore(budgetMonth, budgetLatest);

  const goBudgetPrevious = useCallback(() => {
    navigateToMonth(new Date(budgetMonth.getFullYear(), budgetMonth.getMonth() - 1, 1));
  }, [budgetMonth, navigateToMonth]);

  const goBudgetNext = useCallback(() => {
    navigateToMonth(new Date(budgetMonth.getFullYear(), budgetMonth.getMonth() + 1, 1));
  }, [budgetMonth, navigateToMonth]);

  const renderItem: ListRenderItem<BudgetCategoryUiModel> = useCallback(() => null, []);

  const listHeaderComponent = useMemo(
    () => (
      <View>
        <View
          style={[
            pageStyles.headerBlock,
            { paddingTop: insets.top + SCREEN_TOP_GUTTER },
          ]}
        >
          <BudgetPageHeader />
        </View>

        <View style={pageStyles.heroSection}>
          <BudgetSideHeroCard
            totalAllocated={totals.totalAllocated}
            totalSpent={totals.totalSpent}
            month={budgetMonth}
            onPrevious={goBudgetPrevious}
            onNext={goBudgetNext}
            canGoPrevious={canGoBudgetPrevious}
            canGoNext={canGoBudgetNext}
          />
        </View>

        {listCategories.length > 0 ? (
          <>
            <View style={pageStyles.listHeader}>
              <ProtoSectionHeader
                title="Budgets par catégorie"
                trailing={
                  <View style={pageStyles.sectionActions}>
                    <CategoryLayoutToggle
                      value={categoryLayout}
                      onChange={selectCategoryLayout}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Ajouter une catégorie"
                      hitSlop={8}
                      onPress={openBlankCreate}
                      style={({ pressed }) => [pressed && pageStyles.pressed]}
                    >
                      <PlusFabIcon
                        size={16}
                        color={showAddButton ? colors.text : colors.textDisabled}
                      />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        managingCategories
                          ? 'Terminer la sélection'
                          : 'Modifier les catégories'
                      }
                      accessibilityState={{ selected: managingCategories }}
                      hitSlop={8}
                      onPress={toggleManagingCategories}
                      style={({ pressed }) => [pressed && pageStyles.pressed]}
                    >
                      <AppIcon
                        family="ionicons"
                        name={managingCategories ? 'checkmark' : 'create-outline'}
                        size={16}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  </View>
                }
              />
            </View>

            <View style={pageStyles.categoriesSectionShell}>
              <View
                style={
                  categoryLayout === 'grid'
                    ? pageStyles.categoryGrid
                    : pageStyles.categoryList
                }
                onLayout={
                  categoryLayout === 'grid' ? onCategoriesGridLayout : undefined
                }
              >
                {listCategories.map((item) => {
                  const row = (
                    <BudgetCategoryRow
                      category={item}
                      selecting={managingCategories}
                      selected={selectedCategoryIds.includes(item.id)}
                      onPress={onCategoryRowPress}
                      layout={categoryLayout}
                    />
                  );
                  if (categoryLayout !== 'grid') {
                    return <View key={item.id}>{row}</View>;
                  }
                  return (
                    <View key={item.id} style={budgetGridColumnStyle}>
                      {row}
                    </View>
                  );
                })}
                {categoryLayout === 'grid' ? (
                  <View
                    style={[
                      budgetGridColumnStyle,
                      Platform.OS === 'web' ? null : pageStyles.addTileNativeFrame,
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Nouvelle catégorie"
                      onPress={openBlankCreate}
                      style={({ pressed }) => [
                        pageStyles.addTile,
                        Platform.OS === 'web' ? null : pageStyles.addTileNative,
                        {
                          borderColor:
                            Platform.OS === 'web' ? colors.border : colors.textMuted,
                        },
                        pressed && pageStyles.pressed,
                      ]}
                    >
                      {Platform.OS === 'web' ? (
                        <PlusFabIcon size={14} color={colors.textMuted} />
                      ) : (
                        <AppIcon
                          family="ionicons"
                          name="add"
                          size={22}
                          color={colors.textMuted}
                        />
                      )}
                      <Text
                        numberOfLines={1}
                        style={[
                          typographyKit.microMedium,
                          pageStyles.addTileLabel,
                          { color: colors.textMuted },
                        ]}
                      >
                        Nouvelle catégorie
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>

            {managingCategories ? (
              <View style={pageStyles.deleteSelectedBlock}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    selectedCategoryIds.length === 0
                      ? 'Sélectionne des catégories à supprimer'
                      : `Supprimer ${selectedCategoryIds.length} catégorie${selectedCategoryIds.length > 1 ? 's' : ''}`
                  }
                  disabled={deletingSelected || selectedCategoryIds.length === 0}
                  onPress={openDeleteSelectedConfirm}
                  style={({ pressed }) => [
                    subtleDeleteButtonStyle(isLight, { alignSelf: 'stretch' }),
                    pressed && pageStyles.pressed,
                    (deletingSelected || selectedCategoryIds.length === 0) &&
                      pageStyles.disabled,
                  ]}
                >
                  <AppIcon
                    family="ionicons"
                    name="trash-outline"
                    size={16}
                    color={destructiveIconColor(isLight)}
                  />
                  <Text style={destructiveTextActionStyle(isLight)}>
                    {deletingSelected
                      ? 'Suppression…'
                      : selectedCategoryIds.length === 0
                        ? 'Sélectionne des catégories'
                        : `Supprimer ${selectedCategoryIds.length} catégorie${selectedCategoryIds.length > 1 ? 's' : ''}`}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={pageStyles.listHeader}>
              <ProtoSectionHeader
                title="SUGGESTIONS"
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ajouter une catégorie"
                    hitSlop={8}
                    onPress={openBlankCreate}
                    style={({ pressed }) => [pressed && pageStyles.pressed]}
                  >
                    <PlusFabIcon
                      size={16}
                      color={showAddButton ? colors.text : colors.textDisabled}
                    />
                  </Pressable>
                }
              />
            </View>

            <View style={pageStyles.categoriesSectionShell}>
              <View
                style={pageStyles.categoriesSection}
                onLayout={onCategoriesGridLayout}
              >
                {BUDGET_CATEGORY_SUGGESTIONS.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      pageStyles.categoryCell,
                      {
                        width: categoryCellWidthFor(
                          BUDGET_CATEGORY_SUGGESTIONS.length,
                        ),
                      },
                    ]}
                  >
                    <BudgetCategorySuggestionTile
                      suggestion={item}
                      onPress={openSuggestionCreate}
                    />
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </View>
    ),
    [
      budgetMonth,
      canGoBudgetNext,
      canGoBudgetPrevious,
      budgetGridColumnStyle,
      categoryCellWidthFor,
      categoryLayout,
      colors.border,
      colors.text,
      colors.textDisabled,
      colors.textMuted,
      listCategories,
      deletingSelected,
      goBudgetNext,
      goBudgetPrevious,
      insets.top,
      isLight,
      managingCategories,
      onCategoriesGridLayout,
      onCategoryRowPress,
      openBlankCreate,
      openDeleteSelectedConfirm,
      openSuggestionCreate,
      selectCategoryLayout,
      selectedCategoryIds,
      showAddButton,
      toggleManagingCategories,
      totals.totalAllocated,
      totals.totalSpent,
    ],
  );

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <FlatList
          ref={listRef}
          data={[]}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.list}
          nestedScrollEnabled
          ListHeaderComponent={listHeaderComponent}
          contentContainerStyle={{
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        />

        <BudgetCategoryDetailSheet
          category={detailCategory}
          visible={detailCategory != null}
          onClose={() => setDetailCategoryId(null)}
          onSaved={refreshDisplayedMonth}
          displayMonth={displayMonth}
          isCurrentMonth={isCurrentMonth(displayMonth)}
        />

        <ConfirmDeleteModal
          visible={confirmDeleteSelectedVisible}
          title={
            selectedCategoryIds.length <= 1
              ? 'Supprimer cette catégorie ?'
              : `Supprimer ${selectedCategoryIds.length} catégories ?`
          }
          message="Retirer ces allocations budget ? Les transactions existantes restent dans l'historique."
          confirmLabel="Supprimer"
          onConfirm={() => void handleConfirmDeleteSelected()}
          onCancel={() => setConfirmDeleteSelectedVisible(false)}
        />
      </View>
    </PageTransition>
  );
}

const pageStyles = StyleSheet.create({
  headerBlock: {
    gap: PAGE_TITLE_CONTENT_GAP,
  },
  heroSection: {
    marginTop: spacing.md,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  listHeader: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginTop: SECTION_BREAK,
    marginBottom: spacing.sm,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  /** Outer shell owns page padding so onLayout width === usable grid width. */
  categoriesSectionShell: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginBottom: spacing.md,
  },
  categoryList: {
    gap: BUDGET_CATEGORY_TILE.gap,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    width: '100%',
    gap: BUDGET_CATEGORY_TILE.gap,
  },
  addTile: {
    height: BUDGET_CATEGORY_TILE.gridHeight,
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: PLAN_FINANCE_CONTAINER.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    overflow: 'hidden',
  },
  /** Native: don't let the column's overflow clip the dashed stroke. */
  addTileNativeFrame: {
    overflow: 'visible',
    flexShrink: 0,
  },
  /**
   * Native card. flexBasis stays off so the 128px height is not reused as the
   * row width. Dashed stroke uses an opaque theme color so Android paints it.
   */
  addTileNative: {
    height: BUDGET_CATEGORY_TILE.gridHeight,
    width: '100%',
    alignSelf: 'stretch',
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: 1,
    borderStyle: 'dashed',
    overflow: 'visible',
  },
  addTileLabel: {
    textAlign: 'center',
  },
  categoriesSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
    gap: GRID_GAP,
  },
  /** Pixel half-width applied inline — no flex grow, odd last tile stays left. */
  categoryCell: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  deleteSelectedBlock: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginBottom: spacing.md,
  },

  pressed: {
    opacity: 0.82, // COMPONENTS.onyxContainer.pressedOpacity
  },
  disabled: {
    opacity: 0.55,
  },
  heroBlock: {
    alignItems: 'flex-start',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  pageTitle: {
    ...PAGE_TITLE_STYLE,
    marginTop: spacing.lg,
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flex: 1 },
});

// Budget categories: mockup layout (compact hero ring + 2-col cards).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ListRenderItem,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { AddBudgetCategoryCta } from '@/components/budget/AddBudgetCategoryCta';
import { BudgetCategoryDetailSheet } from '@/components/budget/BudgetCategoryDetailSheet';
import { BudgetCategoryRow } from '@/components/budget/BudgetCategoryRow';
import { BudgetCategorySuggestionTile } from '@/components/budget/BudgetCategorySuggestionTile';
import { ProtoBudgetSummaryCard } from '@/components/budget/ProtoBudgetSummaryCard';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { ProtoSectionHeader } from '@/components/proto/ProtoSectionHeader';
import { MonthSelector } from '@/components/MonthSelector';
import { PageTransition } from '@/components/PageTransition';
import {
  BUDGET_CATEGORY_SUGGESTIONS,
  type BudgetCategorySuggestion,
} from '@/constants/categoryOptions';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { SPACING } from '@/constants/design-tokens';
import {
  FLOATING_NAV_CONTENT_PADDING,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_CONTENT_GAP,
  PAGE_TITLE_STYLE,
  PORTFOLIO_SECTION_GAP,
  destructiveIconColor,
  destructiveTextActionStyle,
  spacing,
  subtleDeleteButtonStyle,
} from '@/constants/theme';
import { useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import {
  clearAllBudgetCategories,
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
  formatBudgetMonthEyebrow,
  isCurrentMonth,
  isMonthAfter,
  isMonthBefore,
  startOfMonth,
} from '@/lib/budgetMonth';
import { getMockBudgetEarliestMonthStart } from '@/lib/budgetMonthMock';
import { getEarliestExpenseMonthStart } from '@/lib/db';
import { isDemoSeedEnabled } from '@/lib/demoSeedGate';
import { dataEvents } from '@/lib/events';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const SECTION_BREAK = SPACING.xl;
const GRID_GAP = SPACING.onyxListGap;

function currentMonthStart(): Date {
  return startOfMonth(new Date());
}

function BudgetPageHeader({ monthLabel }: { monthLabel: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={pageStyles.heroBlock}>
      <View style={pageStyles.headerRow}>
        <Text style={[pageStyles.pageTitle, { color: colors.text }]} numberOfLines={1}>
          Budget
        </Text>
        <Text style={[pageStyles.monthLabel, { color: colors.textMuted }]} numberOfLines={1}>
          {monthLabel}
        </Text>
      </View>
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
    setGridContentWidth((prev) => (prev === next ? prev : next));
  }, []);

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

  const [categories, setCategories] = useState<BudgetCategoryUiModel[]>([]);
  const [detailCategoryId, setDetailCategoryId] = useState<string | null>(null);
  const [confirmDeleteAllVisible, setConfirmDeleteAllVisible] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
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
      void loadMonth(next);
    },
    [loadMonth],
  );

  useFocusEffect(
    useCallback(() => {
      navigateToMonth(currentMonthStart());
    }, [navigateToMonth]),
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
  const heroCategories = useMemo(
    () =>
      categories
        .filter((category) => category.limit > 0)
        .map((category) => ({
          id: category.id,
          name: category.name,
          spent: category.spent,
          limit: category.limit,
          color: category.color,
        })),
    [categories],
  );

  const hubEyebrow = useMemo(
    () =>
      isCurrentMonth(displayMonth)
        ? 'CE MOIS-CI'
        : formatBudgetMonthEyebrow(displayMonth),
    [displayMonth],
  );

  const showAddButton = canAddBudgetCategory(categories.length);

  const openCategoryDetail = useCallback((id: string) => {
    setDetailCategoryId(id);
  }, []);

  const openBlankCreate = useCallback(() => {
    tapHaptic();
    router.push('/add-budget-category');
  }, [router]);

  const openSuggestionCreate = useCallback(
    (suggestion: BudgetCategorySuggestion) => {
      router.push({
        pathname: '/add-budget-category',
        params: { name: suggestion.name, icon: suggestion.icon },
      });
    },
    [router],
  );

  const openDeleteAllConfirm = useCallback(() => {
    tapHaptic();
    setConfirmDeleteAllVisible(true);
  }, []);

  const handleConfirmDeleteAll = useCallback(async () => {
    if (deletingAll) return;
    setConfirmDeleteAllVisible(false);
    setDeletingAll(true);
    try {
      setDetailCategoryId(null);
      await clearAllBudgetCategories();
      successHaptic();
      refreshDisplayedMonth();
    } finally {
      setDeletingAll(false);
    }
  }, [deletingAll, refreshDisplayedMonth]);

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

  const addCategoryCta = showAddButton ? (
    <View
      style={[
        pageStyles.addCtaBlock,
        listCategories.length === 0 && pageStyles.addCtaUnderHero,
      ]}
    >
      <AddBudgetCategoryCta onPress={openBlankCreate} />
    </View>
  ) : null;

  const listHeaderComponent = useMemo(
    () => (
      <View>
        <View
          style={[
            pageStyles.headerBlock,
            { paddingTop: insets.top + SCREEN_TOP_GUTTER },
          ]}
        >
          <BudgetPageHeader
            monthLabel={displayMonth.toLocaleDateString('fr-CA', {
              month: 'long',
              year: 'numeric',
            })}
          />
        </View>

        <View style={pageStyles.monthSection}>
          <MonthSelector
            month={budgetMonth}
            onPrevious={goBudgetPrevious}
            onNext={goBudgetNext}
            canGoPrevious={canGoBudgetPrevious}
            canGoNext={canGoBudgetNext}
          />
        </View>

        <View style={pageStyles.heroSection}>
          <ProtoBudgetSummaryCard
            totalAllocated={totals.totalAllocated}
            totalSpent={totals.totalSpent}
          />
        </View>

        {listCategories.length > 0 ? (
          <>
            <View style={pageStyles.listHeader}>
              <ProtoSectionHeader
                title="CATÉGORIES"
                actionLabel={showAddButton ? '+ Nouveau' : undefined}
                onAction={showAddButton ? openBlankCreate : undefined}
              />
            </View>

            <View style={pageStyles.categoriesSectionShell}>
              <ProtoGlassCard>
                {listCategories.map((item, index) => (
                  <BudgetCategoryRow
                    key={item.id}
                    category={item}
                    onPress={openCategoryDetail}
                    isLast={index === listCategories.length - 1}
                  />
                ))}
              </ProtoGlassCard>
            </View>

            {addCategoryCta}

            <View style={pageStyles.deleteAllBlock}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Supprimer toutes les catégories"
                disabled={deletingAll}
                onPress={openDeleteAllConfirm}
                style={({ pressed }) => [
                  subtleDeleteButtonStyle(isLight, { alignSelf: 'stretch' }),
                  pressed && pageStyles.pressed,
                  deletingAll && pageStyles.disabled,
                ]}
              >
                <AppIcon
                  family="ionicons"
                  name="trash-outline"
                  size={16}
                  color={destructiveIconColor(isLight)}
                />
                <Text style={destructiveTextActionStyle(isLight)}>
                  {deletingAll ? 'Suppression…' : 'Supprimer toutes les catégories'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            {addCategoryCta}

            <View style={pageStyles.listHeader}>
              <ProtoSectionHeader title="SUGGESTIONS" />
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
      addCategoryCta,
      budgetMonth,
      canGoBudgetNext,
      canGoBudgetPrevious,
      listCategories,
      deletingAll,
      displayMonth,
      goBudgetNext,
      goBudgetPrevious,
      insets.top,
      isLight,
      openBlankCreate,
      openCategoryDetail,
      openDeleteAllConfirm,
      openSuggestionCreate,
      showAddButton,
      totals.totalAllocated,
      totals.totalSpent,
    ],
  );

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={
            isLight
              ? ['rgba(0,168,84,0.06)', 'transparent']
              : ['rgba(0,230,100,0.055)', 'transparent']
          }
          style={pageStyles.ambientGlow}
          pointerEvents="none"
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />

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
          visible={confirmDeleteAllVisible}
          title="Supprimer toutes les catégories ?"
          message="Retirer toutes les allocations budget ? Les transactions existantes restent dans l'historique."
          confirmLabel="Tout supprimer"
          onConfirm={() => void handleConfirmDeleteAll()}
          onCancel={() => setConfirmDeleteAllVisible(false)}
        />
      </View>
    </PageTransition>
  );
}

const pageStyles = StyleSheet.create({
  ambientGlow: {
    position: 'absolute',
    top: -100,
    alignSelf: 'center',
    width: 420,
    height: 260,
    zIndex: 0,
  },
  headerBlock: {
    gap: PAGE_TITLE_CONTENT_GAP,
  },
  monthSection: {
    marginTop: spacing.lg + spacing.xs,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  heroSection: {
    marginTop: PORTFOLIO_SECTION_GAP,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  listHeader: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginTop: SECTION_BREAK,
    marginBottom: spacing.md,
  },
  /** Outer shell owns page padding so onLayout width === usable grid width. */
  categoriesSectionShell: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginBottom: spacing.md,
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
  addCtaBlock: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginBottom: spacing.md,
  },
  /** Breathing room when CTA sits directly under the ring/summary card. */
  addCtaUnderHero: {
    marginTop: spacing.lg,
  },
  deleteAllBlock: {
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
  headerRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  pageTitle: { ...PAGE_TITLE_STYLE, flex: 1, minWidth: 0 },
  monthLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize' as const,
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flex: 1 },
});

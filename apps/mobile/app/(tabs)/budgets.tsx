// Budget categories: mockup layout (compact hero ring + 2-col cards).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
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
import { BudgetHeroCard } from '@/components/budget/BudgetHeroCard';
import { MonthSelector } from '@/components/MonthSelector';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { PageTransition } from '@/components/PageTransition';
import {
  BUDGET_CATEGORY_SUGGESTIONS,
  type BudgetCategorySuggestion,
} from '@/constants/categoryOptions';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
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

const SECTION_BREAK = spacing.xl;
const GRID_GAP = spacing.sm;

function currentMonthStart(): Date {
  return startOfMonth(new Date());
}

function BudgetPageHeader() {
  const { colors } = useAppTheme();

  return (
    <View style={pageStyles.heroBlock}>
      <View style={pageStyles.headerRow}>
        <Text style={[pageStyles.pageTitle, { color: colors.text }]} numberOfLines={1}>
          Budget
        </Text>
      </View>
    </View>
  );
}

export default function BudgetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const listRef = useRef<FlatList<BudgetCategoryUiModel>>(null);

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
          <BudgetPageHeader />
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
          <BudgetHeroCard
            categories={heroCategories}
            totalAllocated={totals.totalAllocated}
            totalSpent={totals.totalSpent}
            hubEyebrow={hubEyebrow}
            isCurrentMonth={isCurrentMonth(displayMonth)}
            onSelectCategory={openCategoryDetail}
          />
        </View>

        {listCategories.length > 0 ? (
          <>
            <View style={pageStyles.listHeader}>
              <DashboardSectionLabel>Catégories</DashboardSectionLabel>
            </View>

            <View style={pageStyles.categoriesSection}>
              {listCategories.map((item) => (
                <View key={item.id} style={pageStyles.categoryCell}>
                  <BudgetCategoryRow
                    category={item}
                    onPress={openCategoryDetail}
                  />
                </View>
              ))}
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
              <DashboardSectionLabel style={{ color: colors.accentGreen }}>
                Suggestions
              </DashboardSectionLabel>
            </View>

            <View style={pageStyles.categoriesSection}>
              {BUDGET_CATEGORY_SUGGESTIONS.map((item) => (
                <View key={item.id} style={pageStyles.categoryCell}>
                  <BudgetCategorySuggestionTile
                    suggestion={item}
                    onPress={openSuggestionCreate}
                  />
                </View>
              ))}
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
      colors.accentGreen,
      deletingAll,
      heroCategories,
      displayMonth,
      goBudgetNext,
      goBudgetPrevious,
      hubEyebrow,
      insets.top,
      isLight,
      openCategoryDetail,
      openDeleteAllConfirm,
      openSuggestionCreate,
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
  categoriesSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginBottom: spacing.md,
    gap: GRID_GAP,
  },
  /** Fixed half-width slot — odd last tile stays same size, left-aligned (no flex stretch). */
  categoryCell: {
    width: '48%',
    maxWidth: '48%',
    flexGrow: 0,
    flexShrink: 0,
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
    opacity: 0.82,
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
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flex: 1 },
});

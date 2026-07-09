// Budget categories: clean slate — rebuild structure/logic here (no legacy donut/hit-test).
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
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddBudgetCategoryModal } from '@/components/budget/AddBudgetCategoryModal';
import { BudgetCategoryDetailSheet } from '@/components/budget/BudgetCategoryDetailSheet';
import { BudgetCategoryAddRow } from '@/components/budget/BudgetCategoryAddRow';
import { BudgetCategoryRow } from '@/components/budget/BudgetCategoryRow';
import { MonthSelector } from '@/components/MonthSelector';
import { BudgetDonut, type BudgetDonutCategory } from '@/components/BudgetDonut';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { PageTransition } from '@/components/PageTransition';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  FLOATING_NAV_CONTENT_PADDING,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_CONTENT_GAP,
  PAGE_TITLE_STYLE,
  PORTFOLIO_SECTION_GAP,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { getCategoriesForMonth, initializeCategories } from '@/lib/budgetCategories';
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
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const SECTION_BREAK = spacing.lg;

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
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const listRef = useRef<FlatList<BudgetCategoryUiModel>>(null);

  const [categories, setCategories] = useState<BudgetCategoryUiModel[]>([]);
  const [detailCategoryId, setDetailCategoryId] = useState<string | null>(null);
  const [addVisible, setAddVisible] = useState(false);
  /** Month shown in the donut hub and category list — always matches `categories`. */
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
      const mockEarliest = getMockBudgetEarliestMonthStart();
      setEarliestMonth(
        isMonthBefore(mockEarliest, dbEarliest) ? mockEarliest : dbEarliest,
      );
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
  const donutCategories = useMemo<readonly BudgetDonutCategory[]>(
    () =>
      categories
        .filter((category) => category.limit > 0)
        .map((category) => ({
          id: category.id,
          name: category.name,
          spent: category.spent,
          limit: category.limit,
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

        <View style={pageStyles.donutSection}>
          <DashboardCard variant="flat" padding={spacing.lg} innerStyle={pageStyles.distributionCard}>
            <MonthSelector
              month={budgetMonth}
              onPrevious={goBudgetPrevious}
              onNext={goBudgetNext}
              canGoPrevious={canGoBudgetPrevious}
              canGoNext={canGoBudgetNext}
            />
            <BudgetDonut
              categories={donutCategories}
              totalAllocated={totals.totalAllocated}
              totalSpent={totals.totalSpent}
              onSelectCategory={(id) => {
                if (id) openCategoryDetail(id);
              }}
              hubEyebrow={hubEyebrow}
              isCurrentMonth={isCurrentMonth(displayMonth)}
            />
          </DashboardCard>
        </View>

        <View style={pageStyles.listHeader}>
          <DashboardSectionLabel>Catégories</DashboardSectionLabel>
          {showAddButton ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajouter une catégorie budget"
              hitSlop={10}
              onPress={() => {
                tapHaptic();
                setAddVisible(true);
              }}
              style={({ pressed }) => [
                pageStyles.addButton,
                {
                  backgroundColor: colors.containerBackground,
                  borderColor: colors.containerBorder,
                },
                pressed && pageStyles.pressed,
              ]}
            >
              <AppIcon family="ionicons" name="add" size={20} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {listCategories.length > 0 ? (
          <View style={pageStyles.categoriesSection}>
            <DashboardCard padding={0} innerStyle={pageStyles.categoriesCard}>
              {listCategories.map((item, index) => (
                <BudgetCategoryRow
                  key={item.id}
                  category={item}
                  onPress={openCategoryDetail}
                  embedded
                  isLast={!showAddButton && index === listCategories.length - 1}
                />
              ))}
              {showAddButton ? (
                <BudgetCategoryAddRow onPress={() => setAddVisible(true)} />
              ) : null}
            </DashboardCard>
          </View>
        ) : null}
      </View>
    ),
    [
      budgetMonth,
      canGoBudgetNext,
      canGoBudgetPrevious,
      listCategories,
      colors.containerBackground,
      colors.containerBorder,
      colors.textSecondary,
      donutCategories,
      displayMonth,
      goBudgetNext,
      goBudgetPrevious,
      hubEyebrow,
      insets.top,
      openCategoryDetail,
      showAddButton,
      totals.totalAllocated,
      totals.totalSpent,
    ],
  );

  const listEmptyComponent = useMemo(
    () => (
      <DashboardCard padding={spacing.lg} innerStyle={pageStyles.emptyCard}>
        <View style={[pageStyles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
          <AppIcon family="ionicons" name="pie-chart-outline" size={22} color={colors.textMuted} />
        </View>
        <Text style={[pageStyles.emptyTitle, typographyKit.bodyBold, { color: colors.text }]}>
          Aucune catégorie budget
        </Text>
        <Text style={[pageStyles.emptyHint, typographyKit.caption, { color: colors.textMuted }]}>
          Ajoutez une catégorie pour suivre vos dépenses mensuelles.
        </Text>
        {showAddButton ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter une catégorie budget"
            onPress={() => {
              tapHaptic();
              setAddVisible(true);
            }}
            style={({ pressed }) => [
              pageStyles.emptyCta,
              { backgroundColor: colors.text, borderColor: colors.text },
              pressed && pageStyles.pressed,
            ]}
          >
            <AppIcon family="ionicons" name="add" size={16} color={colors.background} />
            <Text style={[pageStyles.emptyCtaText, typographyKit.bodyBold, { color: colors.background }]}>
              Ajouter une catégorie
            </Text>
          </Pressable>
        ) : null}
      </DashboardCard>
    ),
    [colors.background, colors.surfaceElevated, colors.text, colors.textMuted, showAddButton],
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
          ListEmptyComponent={categories.length === 0 ? listEmptyComponent : null}
        />

        <AddBudgetCategoryModal
          visible={addVisible}
          onClose={() => setAddVisible(false)}
          onCreated={refreshDisplayedMonth}
        />

        <BudgetCategoryDetailSheet
          category={detailCategory}
          visible={detailCategory != null}
          onClose={() => setDetailCategoryId(null)}
          onSaved={refreshDisplayedMonth}
          displayMonth={displayMonth}
          isCurrentMonth={isCurrentMonth(displayMonth)}
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
  distributionCard: {
    gap: spacing.md,
  },
  donutSection: {
    marginTop: PORTFOLIO_SECTION_GAP,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginTop: SECTION_BREAK,
    marginBottom: spacing.sm,
  },
  categoriesSection: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginBottom: spacing.md,
  },
  categoriesCard: {
    overflow: 'hidden',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.82,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: PAGE_PADDING_HORIZONTAL,
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyHint: {
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    minHeight: 44,
  },
  emptyCtaText: {},
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

// Budget categories: clean slate — rebuild structure/logic here (no legacy donut/hit-test).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddBudgetCategoryModal } from '@/components/budget/AddBudgetCategoryModal';
import { BudgetCategoryDetailSheet } from '@/components/budget/BudgetCategoryDetailSheet';
import { BudgetCategoryRow } from '@/components/budget/BudgetCategoryRow';
import { BudgetDonutChart } from '@/components/BudgetDonutChart';
import { BudgetShortcutCards } from '@/components/budget/BudgetShortcutCards';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { PageTransition } from '@/components/PageTransition';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  FLOATING_NAV_CONTENT_PADDING,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_STYLE,
  PORTFOLIO_SECTION_GAP,
  spacing,
} from '@/constants/theme';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { getCategories, initializeCategories } from '@/lib/budgetCategories';
import {
  canAddBudgetCategory,
  computeBudgetTotals,
  mapBudgetCategoriesToUi,
  sortBudgetCategoriesByLimitDesc,
  type BudgetCategoryUiModel,
} from '@/lib/budgetCategoryModel';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const CATEGORY_COLORS = [
  '#4ADE80',
  '#22C55E',
  '#16A34A',
  '#15803D',
  '#166534',
  '#14532D',
  '#4A5D52',
  '#3A4A40',
  '#2A3530',
];

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);

  const load = useCallback(async () => {
    await initializeCategories();
    const budgets = await getCategories();
    const mapped = sortBudgetCategoriesByLimitDesc(mapBudgetCategoriesToUi(budgets));
    setCategories(mapped);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);
  useRefreshOnFocus(load);

  useScrollToTopOnFocus(
    useCallback(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, []),
  );

  const totals = useMemo(() => computeBudgetTotals(categories), [categories]);
  const donutSegments = useMemo(
    () =>
      categories
        .filter((category) => category.limit > 0)
        .map((category, index) => ({
          id: category.id,
          value: category.limit,
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        })),
    [categories],
  );

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedId) ?? null,
    [categories, selectedId],
  );

  const showAddButton = canAddBudgetCategory(categories.length);

  const handleSelectCategory = useCallback((id: string | null) => {
    if (id === null) {
      setSelectedId(null);
      setDetailVisible(false);
      return;
    }
    setSelectedId(id);
    setDetailVisible(true);
  }, []);

  const renderItem: ListRenderItem<BudgetCategoryUiModel> = useCallback(
    ({ item }) => (
      <BudgetCategoryRow
        category={item}
        selected={selectedId === item.id}
        onPress={handleSelectCategory}
      />
    ),
    [handleSelectCategory, selectedId],
  );

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
          <BudgetShortcutCards
            onPressPlans={() => router.push('/(tabs)/goals')}
            onPressSavingsGoals={() => router.push('/savings-goals')}
          />
        </View>

        <View style={pageStyles.donutSection}>
          <View style={pageStyles.donutSectionHeader}>
            <DashboardSectionLabel>Répartition mensuelle</DashboardSectionLabel>
          </View>
          <BudgetDonutChart
            segments={donutSegments}
            totalAllocated={totals.totalAllocated}
            totalSpent={totals.totalSpent}
            selectedId={selectedId}
            onSelectSegment={handleSelectCategory}
          />
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
                  backgroundColor: colors.input,
                  borderColor: colors.borderSubtle,
                },
                pressed && pageStyles.pressed,
              ]}
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      </View>
    ),
    [
      colors.borderSubtle,
      colors.input,
      colors.text,
      donutSegments,
      handleSelectCategory,
      insets.top,
      router,
      selectedId,
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
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.list}
          nestedScrollEnabled
          ListHeaderComponent={listHeaderComponent}
          contentContainerStyle={{
            gap: spacing.md,
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={[pageStyles.empty, { color: colors.textMuted }]}>
              Aucune catégorie budget. Ajoutez-en une pour commencer.
            </Text>
          }
        />

        <BudgetCategoryDetailSheet
          category={selectedCategory}
          visible={detailVisible}
          onClose={() => setDetailVisible(false)}
          onSaved={load}
        />

        <AddBudgetCategoryModal
          visible={addVisible}
          onClose={() => setAddVisible(false)}
          onCreated={load}
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
    gap: PORTFOLIO_SECTION_GAP,
  },
  donutSection: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  donutSectionHeader: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginTop: PORTFOLIO_SECTION_GAP,
    marginBottom: spacing.sm,
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.82,
  },
  empty: {
    textAlign: 'center',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingVertical: spacing.xl,
    fontSize: 14,
    lineHeight: 20,
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

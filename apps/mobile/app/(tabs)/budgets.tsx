// Budget tab — résumé du mois + une liste groupée de catégories (style historique).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { BudgetCategoryDetailSheet } from '@/components/budget/BudgetCategoryDetailSheet';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { BudgetCategoryTile } from '@/components/budget/BudgetCategoryTile';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  HeaderIconButton,
  ListCard,
  ListRow,
  PageHeader,
  RingGauge,
  SECTION_GAP,
  SectionLabel,
  SummaryCard,
  PillButton,
  PressScale,
  Reveal,
} from '@/components/kit';
import { PageTransition } from '@/components/PageTransition';
import {
  BUDGET_CATEGORY_SUGGESTIONS,
  type BudgetCategorySuggestion,
} from '@/constants/categoryOptions';
import {
  FLOATING_NAV_CONTENT_PADDING,
  PAGE_PADDING_HORIZONTAL,
  destructiveIconColor,
  destructiveTextActionStyle,
  spacing,
  subtleDeleteButtonStyle,
  typographyKit,
  jakartaSemiboldText,
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
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { BUDGET_NEAR, BUDGET_OVER } from '@/lib/budgetTone';
import { BUDGET_SCREEN_CACHE_KEY as BUDGET_CACHE_KEY, readScreenCache, writeScreenCache } from '@/lib/screenCache';
import { useAppTheme } from '@/lib/themeContext';

function currentMonthStart(): Date {
  return startOfMonth(new Date());
}

function monthTitle(month: Date): string {
  const raw = month.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function monthParam(month: Date): string {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
}

function signedMoney(value: number): string {
  return `${value < 0 ? '−' : ''}${formatDisplayMoneyAbsolute(Math.abs(value))}`;
}

export default function BudgetScreen() {
  const router = useRouter();
  /** Deep link: `/budgets?category=<id>` opens that category's detail. */
  const { category: categoryParam } = useLocalSearchParams<{ category?: string }>();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);

  const [cached] = useState(() => readScreenCache<BudgetCategoryUiModel[]>(BUDGET_CACHE_KEY));
  const [categories, setCategories] = useState<BudgetCategoryUiModel[]>(cached ?? []);
  /** False until the first month finishes loading — avoids flashing the empty state. */
  const [hasLoaded, setHasLoaded] = useState(cached != null);
  const [detailCategoryId, setDetailCategoryId] = useState<string | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [confirmDeleteSelectedVisible, setConfirmDeleteSelectedVisible] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  /** Month shown in the summary and category list — always matches `categories`. */
  const [displayMonth, setDisplayMonth] = useState(currentMonthStart);
  /** Month shown in the selector — may lead `displayMonth` while data loads. */
  const [pendingMonth, setPendingMonth] = useState(currentMonthStart);
  const [earliestMonth, setEarliestMonth] = useState(currentMonthStart);
  const latestMonth = currentMonthStart();

  const pendingMonthRef = useRef(pendingMonth);
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    void (async () => {
      const dbEarliest = await getEarliestExpenseMonthStart();
      if (isDemoSeedEnabled()) {
        const mockEarliest = getMockBudgetEarliestMonthStart();
        setEarliestMonth(isMonthBefore(mockEarliest, dbEarliest) ? mockEarliest : dbEarliest);
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

    const uiCategories = mapBudgetCategoriesToUi(budgets);
    if (month.getTime() === currentMonthStart().getTime()) {
      writeScreenCache(BUDGET_CACHE_KEY, uiCategories);
    }
    setDisplayMonth(month);
    setCategories(uiCategories);
    setHasLoaded(true);
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
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  const totals = useMemo(() => computeBudgetTotals(categories), [categories]);
  const listCategories = useMemo(() => sortBudgetCategoriesByPriority(categories), [categories]);

  useEffect(() => {
    if (!categoryParam || !categories.some((c) => c.id === categoryParam)) return;
    setDetailCategoryId(categoryParam);
    router.setParams({ category: undefined });
  }, [categories, categoryParam, router]);
  const showAddButton = canAddBudgetCategory(categories.length);

  const toggleManagingCategories = useCallback(() => {
    tapHaptic();
    setManagingCategories((prev) => {
      if (prev) setSelectedCategoryIds([]);
      return !prev;
    });
  }, []);

  const onCategoryRowPress = useCallback(
    (id: string) => {
      if (managingCategories) {
        setSelectedCategoryIds((prev) =>
          prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
        );
        return;
      }
      setDetailCategoryId(id);
    },
    [managingCategories],
  );

  const openBlankCreate = useCallback(() => {
    if (!showAddButton) return;
    tapHaptic();
    router.push({ pathname: '/add-budget-category', params: { month: monthParam(displayMonth) } });
  }, [displayMonth, router, showAddButton]);

  const openSuggestionCreate = useCallback(
    (suggestion: BudgetCategorySuggestion) => {
      router.push({
        pathname: '/add-budget-category',
        params: { name: suggestion.name, icon: suggestion.icon, month: monthParam(displayMonth) },
      });
    },
    [displayMonth, router],
  );

  const handleConfirmDeleteSelected = useCallback(async () => {
    if (deletingSelected || selectedCategoryIds.length === 0) return;
    const ids = [...selectedCategoryIds];
    setConfirmDeleteSelectedVisible(false);
    setDeletingSelected(true);
    try {
      setDetailCategoryId(null);
      await Promise.all(ids.flatMap((id) => [deleteCategoryBudget(id), deleteCategory(id)]));
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
  const canGoPrevious = isMonthAfter(budgetMonth, startOfMonth(earliestMonth));
  const canGoNext = isMonthBefore(budgetMonth, startOfMonth(latestMonth));
  const viewingCurrent = isCurrentMonth(displayMonth);

  const remaining = totals.totalAllocated - totals.totalSpent;
  const usedRatio = totals.totalAllocated > 0 ? totals.totalSpent / totals.totalAllocated : 0;
  const usedPct = Math.round(usedRatio * 100);
  /** Summary ring: green up to 102 %, orange 103–110 %, red beyond. */
  const usedPctRounded = Math.round(usedRatio * 100);
  const summaryRingColor =
    usedPctRounded <= 102 ? colors.accentGreen : usedPctRounded <= 110 ? BUDGET_NEAR : BUDGET_OVER;

  const daysLeft = useMemo(() => {
    if (!viewingCurrent) return 0;
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return lastDay - now.getDate() + 1;
  }, [viewingCurrent]);

  const overCount = listCategories.filter((c) => c.usage.isOverBudget).length;

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView
          ref={scrollRef}
          style={styles.screen}
          contentContainerStyle={{
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <PageHeader
            topInset={insets.top}
            title="Budget"
            subtitle={monthTitle(budgetMonth)}
            trailing={
              <>
                <HeaderIconButton
                  icon="chevron-back"
                  accessibilityLabel="Mois précédent"
                  onPress={() => {
                    if (!canGoPrevious) return;
                    tapHaptic();
                    navigateToMonth(new Date(budgetMonth.getFullYear(), budgetMonth.getMonth() - 1, 1));
                  }}
                />
                <HeaderIconButton
                  icon="chevron-forward"
                  accessibilityLabel="Mois suivant"
                  onPress={() => {
                    if (!canGoNext) return;
                    tapHaptic();
                    navigateToMonth(new Date(budgetMonth.getFullYear(), budgetMonth.getMonth() + 1, 1));
                  }}
                />
              </>
            }
          />

          {!hasLoaded ? null : listCategories.length > 0 ? (
            <>
              <Reveal index={0} style={styles.section}>
                <SummaryCard
                  label={remaining < 0 ? 'Dépassement' : 'Il te reste'}
                  amount={signedMoney(remaining)}
                  amountValue={remaining}
                  formatAmount={signedMoney}
                  amountColor={colors.text}
                  badge={
                    overCount > 0
                      ? { label: overCount === 1 ? '1 catégorie à revoir' : overCount + ' catégories à revoir', color: colors.textSecondary }
                      : { label: 'Tout est sous contrôle', color: colors.accentGreen }
                  }
                  aside={
                    <RingGauge progress={usedRatio} color={summaryRingColor} size={92} stroke={8}>
                      <Text style={[styles.ringValue, { color: colors.text }]}>{usedPct}%</Text>
                      <Text style={[styles.ringCaption, { color: colors.textMuted }]}>utilisé</Text>
                    </RingGauge>
                  }
                  stats={[
                    { label: 'Dépensé', value: formatDisplayMoneyAbsolute(totals.totalSpent) },
                    { label: 'Prévu', value: formatDisplayMoneyAbsolute(totals.totalAllocated) },
                    viewingCurrent && remaining > 0 && daysLeft > 0
                      ? { label: 'Par jour', value: formatDisplayMoneyAbsolute(remaining / daysLeft) }
                      : { label: 'Catégories', value: String(listCategories.length) },
                  ]}
               />

              </Reveal>

              <Reveal index={1} style={styles.section}>
                <SectionLabel
                  title="Catégories"
                  trailing={
                    <TextAction
                      label={managingCategories ? 'Terminé' : 'Modifier'}
                      onPress={toggleManagingCategories}
                    />
                  }
                />
                <View style={styles.tileGrid}>
                  {listCategories.map((category, index) => (
                    <Reveal key={category.id} index={3 + index} style={styles.tileCell}>
                      <BudgetCategoryTile
                        category={category}
                        selecting={managingCategories}
                        selected={selectedCategoryIds.includes(category.id)}
                        onPress={onCategoryRowPress}
                      />
                    </Reveal>
                  ))}
                  {!managingCategories && showAddButton ? (
                    <View style={styles.tileCell}>
                      <PressScale
                        accessibilityRole="button"
                        accessibilityLabel="Créer une catégorie"
                        onPress={openBlankCreate}
                        scaleTo={0.96}
                        containerStyle={styles.newTileHit}
                        style={[styles.newTile, { borderColor: colors.containerBorder }]}
                      >
                        <View style={[styles.newTileIcon, { backgroundColor: colors.surfaceElevated }]}>
                          <AppIcon family="ionicons" name="add" size={22} color={colors.text} />
                        </View>
                        <Text style={[styles.newTileTitle, { color: colors.text }]}>Nouvelle catégorie</Text>
                      </PressScale>
                    </View>
                  ) : null}
                </View>

                {managingCategories ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={deletingSelected || selectedCategoryIds.length === 0}
                    onPress={() => {
                      tapHaptic();
                      setConfirmDeleteSelectedVisible(true);
                    }}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.pressed,
                      (deletingSelected || selectedCategoryIds.length === 0) && styles.disabled,
                    ]}
                  >
                    <View style={subtleDeleteButtonStyle(isLight, { alignSelf: 'stretch' })}>
                      <AppIcon family="ionicons" name="trash-outline" size={16} color={destructiveIconColor(isLight)} />
                      <Text style={destructiveTextActionStyle(isLight)}>
                        {deletingSelected
                          ? 'Suppression…'
                          : selectedCategoryIds.length === 0
                            ? 'Sélectionne des catégories'
                            : `Supprimer ${selectedCategoryIds.length} catégorie${selectedCategoryIds.length > 1 ? 's' : ''}`}
                      </Text>
                    </View>
                  </Pressable>
                ) : null}
              </Reveal>
            </>
          ) : (
            <View style={styles.section}>
              <SectionLabel title="Commencer avec" actionLabel="Personnalisée" onAction={openBlankCreate} />
              <ListCard>
                {BUDGET_CATEGORY_SUGGESTIONS.map((suggestion, index) => (
                  <ListRow
                    key={suggestion.id}
                    leading={
                      <BudgetCategoryIcon
                        icon={suggestion.icon}
                        name={suggestion.name}
                        id={suggestion.id}
                        wellSize={40}
                        glyphSize={18}
                      />
                    }
                    title={suggestion.name}
                    subtitle="Définir un montant mensuel"
                    trailing={<AppIcon family="ionicons" name="add-circle-outline" size={22} color={colors.textMuted} />}
                    isLast={index === BUDGET_CATEGORY_SUGGESTIONS.length - 1}
                    onPress={() => openSuggestionCreate(suggestion)}
                  />
                ))}
              </ListCard>
            </View>
          )}
        </ScrollView>

        <BudgetCategoryDetailSheet
          category={detailCategory}
          visible={detailCategory != null}
          onClose={() => setDetailCategoryId(null)}
          onSaved={refreshDisplayedMonth}
          displayMonth={displayMonth}
          isCurrentMonth={viewingCurrent}
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

function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <PillButton label={label} onPress={onPress} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  section: { marginBottom: SECTION_GAP + spacing.sm },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  tileCell: { width: '50%', paddingHorizontal: 5, paddingBottom: 10 },
  newTileHit: { flexGrow: 1 },
  // Same dashed tile as « Nouvel objectif » in Copilote.
  newTile: {
    flexGrow: 1,
    minHeight: 136,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  newTileIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  newTileTitle: { ...jakartaSemiboldText, fontSize: 14, lineHeight: 18, textAlign: 'center' },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  textAction: { fontSize: 11 },
  ringValue: { ...typographyKit.metaSemibold, fontSize: 15 },
  ringCaption: { ...typographyKit.metaMedium, fontSize: 9 },
  deleteButton: { marginTop: spacing.md },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
});

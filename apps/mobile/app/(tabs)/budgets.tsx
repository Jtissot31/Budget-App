// Budget tab — résumé du mois + une liste groupée de catégories (style historique).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
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
  SUBTLE_ACCENTS,
  SummaryCard,
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
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);

  const [categories, setCategories] = useState<BudgetCategoryUiModel[]>([]);
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

    setDisplayMonth(month);
    setCategories(mapBudgetCategoriesToUi(budgets));
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
  const toneFor = (ratio: number) => (ratio > 1 ? colors.danger : colors.text);

  const daysLeft = useMemo(() => {
    if (!viewingCurrent) return 0;
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return lastDay - now.getDate() + 1;
  }, [viewingCurrent]);

  /** Share of the current month already elapsed (0..1). */
  const monthProgress = useMemo(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return now.getDate() / lastDay;
  }, []);

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

          {listCategories.length > 0 ? (
            <>
              <View style={styles.section}>
                <SummaryCard
                  label={remaining < 0 ? 'Dépassement' : 'Il te reste'}
                  amount={signedMoney(remaining)}
                  amountValue={remaining}
                  formatAmount={signedMoney}
                  amountColor={remaining < 0 ? colors.danger : colors.text}
                  badge={
                    overCount > 0
                      ? { label: overCount === 1 ? '1 catégorie dépassée' : overCount + ' catégories dépassées', color: colors.danger }
                      : { label: 'Tout est sous contrôle', color: colors.accentGreen }
                  }
                  aside={
                    <RingGauge progress={usedRatio} color={toneFor(usedRatio)} size={76} stroke={8}>
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
               >
                  {/* Pace: how much of the budget is used vs how far we are into the month. */}
                  <View style={styles.paceBlock}>
                    <View style={[styles.paceTrack, { backgroundColor: colors.borderSubtle }]}>
                      <View
                        style={[
                          styles.paceFill,
                          {
                            width: `${Math.min(1, usedRatio) * 100}%`,
                            backgroundColor: usedRatio > 1 ? colors.danger : usedRatio > monthProgress + 0.1 ? colors.warning : colors.accentGreen,
                          },
                        ]}
                      />
                      {viewingCurrent ? (
                        <View style={[styles.paceMarker, { left: `${monthProgress * 100}%`, backgroundColor: colors.text }]} />
                      ) : null}
                    </View>
                    {viewingCurrent ? (
                      <View style={styles.paceLegend}>
                        <Text style={[styles.paceText, { color: colors.textMuted }]}>
                          Utilisé {Math.round(usedRatio * 100)} %
                        </Text>
                        <Text style={[styles.paceText, { color: colors.textMuted }]}>
                          Mois écoulé {Math.round(monthProgress * 100)} %
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </SummaryCard>
              </View>

              <View style={styles.section}>
                <SectionLabel
                  title="Catégories"
                  trailing={
                    <View style={styles.sectionActions}>
                      {!managingCategories && showAddButton ? (
                        <TextAction label="Ajouter" onPress={openBlankCreate} />
                      ) : null}
                      <TextAction
                        label={managingCategories ? 'Terminé' : 'Modifier'}
                        onPress={toggleManagingCategories}
                      />
                    </View>
                  }
                />
                <View style={styles.tileGrid}>
                  {listCategories.map((category, index) => (
                    <View key={category.id} style={styles.tileCell}>
                      <BudgetCategoryTile
                        category={category}
                        accent={SUBTLE_ACCENTS[index % SUBTLE_ACCENTS.length]}
                        selecting={managingCategories}
                        selected={selectedCategoryIds.includes(category.id)}
                        onPress={onCategoryRowPress}
                      />
                    </View>
                  ))}
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
                      subtleDeleteButtonStyle(isLight, { alignSelf: 'stretch' }),
                      styles.deleteButton,
                      pressed && styles.pressed,
                      (deletingSelected || selectedCategoryIds.length === 0) && styles.disabled,
                    ]}
                  >
                    <AppIcon family="ionicons" name="trash-outline" size={16} color={destructiveIconColor(isLight)} />
                    <Text style={destructiveTextActionStyle(isLight)}>
                      {deletingSelected
                        ? 'Suppression…'
                        : selectedCategoryIds.length === 0
                          ? 'Sélectionne des catégories'
                          : `Supprimer ${selectedCategoryIds.length} catégorie${selectedCategoryIds.length > 1 ? 's' : ''}`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
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
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Text style={[typographyKit.metaSemibold, styles.textAction, { color: colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  section: { marginBottom: SECTION_GAP + spacing.sm },
  paceBlock: { gap: 8 },
  paceTrack: { height: 10, borderRadius: 5, overflow: 'visible', position: 'relative' },
  paceFill: { height: '100%', borderRadius: 5 },
  paceMarker: { position: 'absolute', top: -4, width: 2, height: 18, borderRadius: 1, marginLeft: -1 },
  paceLegend: { flexDirection: 'row', justifyContent: 'space-between' },
  paceText: { ...typographyKit.metaMedium, fontSize: 11.5 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  tileCell: { width: '50%', paddingHorizontal: 5, paddingBottom: 10 },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  textAction: { fontSize: 11 },
  ringValue: { ...typographyKit.metaSemibold, fontSize: 15 },
  ringCaption: { ...typographyKit.metaMedium, fontSize: 9 },
  deleteButton: { marginTop: spacing.md },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
});

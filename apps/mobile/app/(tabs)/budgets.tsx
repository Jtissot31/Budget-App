import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/components/BottomSheet';
import { BudgetAllocationChart } from '@/components/BudgetAllocationChart';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardProgressBar } from '@/components/DashboardProgressBar';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { PageTransition } from '@/components/PageTransition';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { GlassContainer } from '@/components/GlassContainer';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ThemedConfirmModal } from '@/components/ThemedConfirmModal';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import {
  BUDGET_PRESETS,
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_PICKER_OPTIONS,
  getCategoryIconName,
  type IconName,
} from '@/constants/categoryOptions';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  FLOATING_NAV_CONTENT_PADDING,
  interBoldText,
  interExtraBoldText,
  interMediumText,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_STYLE,
  PORTFOLIO_SECTION_GAP,
  PROGRESS_BAR_TRACK_HEIGHT,
  SECTION_TITLE_STYLE,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import {
  deleteCategoryBudget,
  getCategoryBudgets,
  getDashboard,
  getSetting,
  setSetting,
  upsertCategory,
  upsertCategoryBudget,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import type { BudgetChartSegment } from '@/lib/budgetChart';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { categoryBudgetBarColor, getCategoryBudgetUsage } from '@/lib/categoryBudgetUsage';
import { rowLabel, rowTitleTextProps, rowValue, singleLineAmountProps } from '@/lib/textLayout';
import { UNIFORM_ROW_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import {
  normalizeUserIconColor,
  resolveUserPickedIconGlyphColor,
  resolveUserPickedIconWellBackground,
} from '@/lib/userPickedIcon';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import type { CategoryBudget, DashboardSummary } from '@/types';

type CategoryForm = {
  id: string;
  name: string;
  icon: string;
  color: string;
  limit: string;
  weeklyLimit: string;
};

const DEFAULT_COLOR = CATEGORY_COLOR_OPTIONS[0];
const DEFAULT_ICON: IconName = 'pricetag-outline';
const DETAIL_SHEET_TOP_RADIUS = 22;
const WEEKS_PER_MONTH = 4.33;

function formatAllocMoney(v: number) {
  return formatDisplayMoneyAbsolute(Math.max(0, v));
}

type BudgetCategoryFormModalProps = {
  form: CategoryForm | null;
  items: CategoryBudget[];
  dashboard: DashboardSummary | null;
  saving: boolean;
  onChangeForm: Dispatch<SetStateAction<CategoryForm | null>>;
  onClose: () => void;
  onSave: () => Promise<void>;
};

function BudgetCategoryFormModal(props: BudgetCategoryFormModalProps) {
  return <BudgetCategoryFormModalContent {...props} />;
}

function BudgetPageHeader({ onAdd }: { onAdd: () => void }) {
  const { colors } = useAppTheme();

  return (
    <View style={pageStyles.headerRow}>
      <Text style={[pageStyles.pageTitle, { color: colors.text }]}>Budget</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajouter une catégorie"
        onPress={onAdd}
        style={[pageStyles.headerIconButton, { backgroundColor: colors.surfaceElevated }]}
      >
        <Ionicons name="add-outline" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

export default function BudgetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [items, setItems] = useState<CategoryBudget[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryBudget | null>(null);
  const [highlightedCategoryId, setHighlightedCategoryId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formErrorVisible, setFormErrorVisible] = useState(false);
  const [formErrorTitle, setFormErrorTitle] = useState('');
  const [formErrorMessage, setFormErrorMessage] = useState('');
  const mutedTextColor = isLight ? colors.textMuted : '#909090';

  const showFormError = useCallback((title: string, message: string) => {
    setFormErrorTitle(title);
    setFormErrorMessage(message);
    setFormErrorVisible(true);
  }, []);

  const load = useCallback(async () => {
    await ensureBudgetPresets();
    const [budgets, nextDashboard] = await Promise.all([getCategoryBudgets(), getDashboard()]);
    setItems(budgets);
    setDashboard(nextDashboard);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);

  useRefreshOnFocus(load);
  useScrollToTopOnFocus(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  const handleAddCategory = useCallback(() => {
    tapHaptic();
    setSelectedCategory(null);
    setForm({
      id: createLocalId(),
      name: '',
      icon: DEFAULT_ICON,
      color: DEFAULT_COLOR,
      limit: '',
      weeklyLimit: '',
    });
  }, []);

  const handleEditCategory = useCallback((category: CategoryBudget) => {
    tapHaptic();
    setSelectedCategory(null);
    setForm({
      id: category.categoryId,
      name: category.categoryName,
      icon: category.categoryIcon || DEFAULT_ICON,
      color: category.categoryColor || DEFAULT_COLOR,
      limit: String(category.limitAmount || ''),
      weeklyLimit: category.weeklyLimitAmount != null ? String(category.weeklyLimitAmount) : '',
    });
  }, []);

  const handleSaveCategory = useCallback(async () => {
    if (!form || saving) return;
    const name = form.name.trim();
    const limit = parseAmount(form.limit);
    const weeklyLimit = form.weeklyLimit.trim() ? parseAmount(form.weeklyLimit) : null;
    if (!name) {
      showFormError('Nom requis', 'Ajoute un nom pour la catégorie.');
      return;
    }
    if (Number.isNaN(limit) || limit < 0) {
      showFormError('Limite invalide', 'Entre une limite mensuelle positive ou 0.');
      return;
    }
    if (weeklyLimit != null && (Number.isNaN(weeklyLimit) || weeklyLimit < 0)) {
      showFormError('Limite hebdomadaire invalide', 'Entre une limite hebdomadaire positive ou laisse le champ vide.');
      return;
    }
    if (weeklyLimit != null && weeklyLimit * WEEKS_PER_MONTH > limit) {
      showFormError(
        'Limite hebdomadaire trop élevée',
        `Une limite de ${weeklyLimit.toFixed(0)} $ par semaine représente environ ${(weeklyLimit * WEEKS_PER_MONTH).toFixed(0)} $ par mois, ce qui dépasse la limite mensuelle de ${limit.toFixed(0)} $.`,
      );
      return;
    }

    setSaving(true);
    await upsertCategory({
      id: form.id,
      name,
      icon: form.icon.trim() || DEFAULT_ICON,
      color: normalizeColor(form.color),
    });
    await upsertCategoryBudget(form.id, limit, weeklyLimit);
    await refreshMonthlyBudgetLimit();
    await load();
    setSaving(false);
    setForm(null);
    successHaptic();
  }, [form, load, saving, showFormError]);

  const handleDeleteCategory = useCallback(
    async (category: CategoryBudget) => {
      await deleteCategoryBudget(category.categoryId);
      await refreshMonthlyBudgetLimit();
      await load();
      setSelectedCategory(null);
      successHaptic();
    },
    [load],
  );

  return (
    <PageTransition>
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['rgba(0,230,100,0.055)', 'transparent']}
        style={pageStyles.ambientGlow}
        pointerEvents="none"
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <ScrollView
        ref={scrollRef}
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + SCREEN_TOP_GUTTER,
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
      >
        <BudgetPageHeader onAdd={handleAddCategory} />
        <BudgetCategoriesSection
          items={items}
          mutedTextColor={mutedTextColor}
          highlightedCategoryId={highlightedCategoryId}
          onHighlightCategory={setHighlightedCategoryId}
          onAddCategory={handleAddCategory}
          onSelectCategory={(category) => {
            setHighlightedCategoryId(category.categoryId);
            setSelectedCategory(category);
          }}
        />
      </ScrollView>

      <BudgetCategoryDetailSheet
        category={selectedCategory}
        onClose={() => {
          setSelectedCategory(null);
          setHighlightedCategoryId(null);
        }}
        onDeleteCategory={handleDeleteCategory}
        onEditCategory={handleEditCategory}
        onOpenHistory={(category) => {
          tapHaptic();
          setSelectedCategory(null);
          router.push({
            pathname: '/budget-category-transactions',
            params: { id: category.categoryId, name: category.categoryName },
          });
        }}
      />

      <BudgetCategoryFormModal
        form={form}
        items={items}
        dashboard={dashboard}
        saving={saving}
        onChangeForm={setForm}
        onClose={() => setForm(null)}
        onSave={handleSaveCategory}
      />

      <ThemedConfirmModal
        visible={formErrorVisible}
        title={formErrorTitle}
        message={formErrorMessage}
        confirmLabel="Compris"
        icon="alert-circle-outline"
        onConfirm={() => setFormErrorVisible(false)}
        onCancel={() => setFormErrorVisible(false)}
      />
    </View>
    </PageTransition>
  );
}

type CategoryRowModel = {
  id: string;
  name: string;
  color: string;
  icon: string;
  limit: number;
  spent: number;
  fraction: number;
};

function buildCategoryModels(items: CategoryBudget[]) {
  const active = items
    .filter((item) => item.limitAmount > 0 || item.spent > 0)
    .sort((a, b) => b.limitAmount - a.limitAmount || b.spent - a.spent);
  const limitTotal = active.reduce((sum, item) => sum + Math.max(0, item.limitAmount), 0);
  const spentTotal = active.reduce((sum, item) => sum + Math.max(0, item.spent), 0);
  const portionTotal = limitTotal > 0 ? limitTotal : spentTotal;

  const rows = active.map<CategoryRowModel>((item) => {
    const limit = Math.max(0, item.limitAmount);
    const spent = Math.max(0, item.spent);
    const amountForPortion = limitTotal > 0 ? limit : spent;
    return {
      id: item.categoryId,
      name: item.categoryName,
      color: item.categoryColor,
      icon: getCategoryIconName(item),
      limit,
      spent,
      fraction: portionTotal > 0 ? amountForPortion / portionTotal : 0,
    };
  });

  const chartSegments: BudgetChartSegment[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    amount: row.limit,
    fraction: row.fraction,
  }));

  return { rows, chartSegments, limitTotal, spentTotal };
}

function BudgetCategoriesSection({
  items,
  mutedTextColor,
  highlightedCategoryId,
  onHighlightCategory,
  onAddCategory,
  onSelectCategory,
}: {
  items: CategoryBudget[];
  mutedTextColor: string;
  highlightedCategoryId: string | null;
  onHighlightCategory: (id: string | null) => void;
  onAddCategory: () => void;
  onSelectCategory: (category: CategoryBudget) => void;
}) {
  const { colors, isLight } = useAppTheme();
  const { rows, chartSegments, limitTotal, spentTotal } = useMemo(() => buildCategoryModels(items), [items]);

  const categoryById = useMemo(() => {
    const lookup = new Map<string, CategoryBudget>();
    items.forEach((item) => lookup.set(item.categoryId, item));
    return lookup;
  }, [items]);

  const handleSegmentPress = useCallback(
    (id: string) => {
      const category = categoryById.get(id);
      if (!category) return;
      tapHaptic();
      onHighlightCategory(id);
      onSelectCategory(category);
    },
    [categoryById, onHighlightCategory, onSelectCategory],
  );

  if (rows.length === 0) {
    return (
      <View style={allocStyles.section}>
        <View style={allocStyles.categoriesHeader}>
          <View style={allocStyles.listTitleGroup}>
            <DashboardSectionLabel>Catégories</DashboardSectionLabel>
            <Text style={[allocStyles.listTitle, { color: colors.text }]}>Mes catégories</Text>
          </View>
        </View>
        <DashboardCard
          innerStyle={allocStyles.emptyCardInner}
          padding={spacing.xl}
        >
          <Ionicons name="pie-chart-outline" size={32} color={mutedTextColor} />
          <Text style={[allocStyles.emptyTitle, { color: colors.text }]}>Aucune catégorie active</Text>
          <Text style={[allocStyles.emptyHint, { color: mutedTextColor }]}>
            Ajoute une limite par catégorie pour visualiser les portions du budget.
          </Text>
          <Pressable
            onPress={onAddCategory}
            style={({ pressed }) => [
              allocStyles.emptyCta,
              { backgroundColor: colors.primary },
              pressed && allocStyles.pressed,
            ]}
          >
            <Text style={[allocStyles.emptyCtaText, { color: isLight ? '#FFFFFF' : '#0a0a0a' }]}>
              Ajouter une catégorie
            </Text>
          </Pressable>
        </DashboardCard>
      </View>
    );
  }

  return (
    <View style={allocStyles.section}>
      <BudgetAllocationChart
        segments={chartSegments}
        totalAllocated={limitTotal}
        totalSpent={spentTotal}
        selectedId={highlightedCategoryId}
        onSelectSegment={handleSegmentPress}
      />

      <View style={allocStyles.listSection}>
        <View style={allocStyles.categoriesHeader}>
          <View style={allocStyles.listTitleGroup}>
            <DashboardSectionLabel>Progression</DashboardSectionLabel>
            <Text style={[allocStyles.listTitle, { color: colors.text }]}>Mes catégories</Text>
          </View>
          <View style={[allocStyles.countBadge, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[allocStyles.countBadgeLabel, { color: mutedTextColor }]}>{rows.length}</Text>
          </View>
        </View>

        <DashboardCard
          style={allocStyles.groupedCard}
          innerStyle={allocStyles.groupedCardInner}
          padding={0}
        >
          {rows.map((row, index) => {
            const usage = getCategoryBudgetUsage(row.limit, row.spent);
            const usagePct = row.limit > 0 ? Math.round((row.spent / row.limit) * 100) : 0;
            const barColor = categoryBudgetBarColor(
              usage.usagePercent,
              usage.isZeroLimitOverspend,
              isLight,
              row.color,
              colors,
            );
            const highlighted = highlightedCategoryId === row.id;

            return (
              <Pressable
                key={row.id}
                android_ripple={null}
                onPress={() => handleSegmentPress(row.id)}
                style={[
                  allocStyles.categoryRowPressable,
                  highlighted && { backgroundColor: isLight ? 'rgba(0,168,84,0.05)' : 'rgba(0,230,100,0.06)' },
                  index < rows.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <View style={allocStyles.categoryRow}>
                  <UserPickedIconBadge icon={row.icon as IconName} size={40} iconSize={20} />
                  <View style={allocStyles.rowBody}>
                    <View style={allocStyles.rowMain}>
                      <Text style={[allocStyles.rowName, { color: colors.text }]} {...rowTitleTextProps}>
                        {row.name}
                      </Text>
                      <View
                        style={[
                          allocStyles.pctPill,
                          {
                            backgroundColor: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)',
                            borderColor: highlighted ? barColor : 'transparent',
                            borderWidth: highlighted ? 1 : 0,
                          },
                        ]}
                      >
                        <Text style={[allocStyles.rowPct, { color: barColor }]}>{`${usagePct} %`}</Text>
                      </View>
                    </View>
                    <DashboardProgressBar
                      pct={usage.progress * 100}
                      color={barColor}
                      height={PROGRESS_BAR_TRACK_HEIGHT}
                      marginTop={0}
                    />
                    <View style={allocStyles.rowMain}>
                      {usage.isZeroLimitOverspend ? (
                        <Text
                          style={[allocStyles.rowAmt, allocStyles.rowAmtLeading, { color: barColor, fontWeight: '700' }]}
                          {...singleLineAmountProps}
                        >
                          Budget dépassé
                        </Text>
                      ) : (
                        <Text
                          style={[allocStyles.rowAmt, allocStyles.rowAmtLeading, { color: mutedTextColor }]}
                          {...singleLineAmountProps}
                        >
                          {`${formatAllocMoney(row.spent)} dépensé`}
                        </Text>
                      )}
                      <Text style={[allocStyles.rowAmt, { color: mutedTextColor }]} {...singleLineAmountProps}>
                        {usage.isZeroLimitOverspend ? '0 $ alloué' : `${formatAllocMoney(row.limit)} limite`}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={mutedTextColor} />
                </View>
              </Pressable>
            );
          })}
        </DashboardCard>
        <AddCategoryCta onPress={onAddCategory} />
      </View>
    </View>
  );
}

function AddCategoryCta({ onPress }: { onPress: () => void }) {
  const { colors, isLight } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ajouter une catégorie"
      onPress={onPress}
      style={({ pressed }) => [
        allocStyles.addCategoryCta,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
        },
        pressed && allocStyles.pressed,
      ]}
    >
      <Ionicons name="add-outline" size={18} color={colors.text} />
      <Text style={[allocStyles.addCategoryCtaLabel, { color: colors.text }]}>Ajouter une catégorie</Text>
    </Pressable>
  );
}

function BudgetCategoryDetailSheet({
  category,
  onClose,
  onDeleteCategory,
  onEditCategory,
  onOpenHistory,
}: {
  category: CategoryBudget | null;
  onClose: () => void;
  onDeleteCategory: (category: CategoryBudget) => Promise<void>;
  onEditCategory: (category: CategoryBudget) => void;
  onOpenHistory: (category: CategoryBudget) => void;
}) {
  const { colors, isLight } = useAppTheme();
  const mutedTextColor = isLight ? colors.textMuted : '#909090';
  const [deleting, setDeleting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const iconName = category ? getCategoryIconName(category) : 'pricetag-outline';
  const usageState = category
    ? getCategoryBudgetUsage(category.limitAmount, category.spent)
    : getCategoryBudgetUsage(0, 0);
  const limit = usageState.limit;
  const spent = usageState.spent;
  const remaining = usageState.isZeroLimitOverspend ? 0 : Math.max(limit - spent, 0);
  const usage = usageState.usagePercent;
  const progress = usageState.progress;
  const detailBarColor = category
    ? categoryBudgetBarColor(
        usageState.usagePercent,
        usageState.isZeroLimitOverspend,
        isLight,
        category.categoryColor,
        colors,
      )
    : colors.primary;

  const confirmDelete = useCallback(() => {
    if (!category || deleting) return;
    setConfirmVisible(true);
  }, [category, deleting]);

  return (
    <>
    <BottomSheet
      visible={Boolean(category)}
      onClose={onClose}
      sheetStyle={[allocStyles.detailSheet, { backgroundColor: colors.cardBackground }]}
      scrollContentContainerStyle={allocStyles.detailContent}
    >
      {category ? (
        <>
          <View style={allocStyles.detailHeader}>
            <Text style={[allocStyles.detailSheetTitle, { color: colors.text }]} {...rowTitleTextProps}>
              {category.categoryName}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Modifier la catégorie ${category.categoryName}`}
              hitSlop={10}
              style={({ pressed }) => [
                allocStyles.detailActionBtn,
                { backgroundColor: colors.surfaceSolid, borderColor: colors.borderStrong },
                pressed && allocStyles.detailBtnPressed,
              ]}
              onPress={() => onEditCategory(category)}
            >
              <Ionicons name="pencil-outline" size={15} color={colors.text} />
              <Text style={[allocStyles.detailActionLabel, { color: colors.text }]}>Modifier</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              hitSlop={10}
              style={({ pressed }) => [
                allocStyles.detailCloseBtn,
                { backgroundColor: colors.surfaceSolid, borderColor: colors.borderStrong },
                pressed && allocStyles.detailBtnPressed,
              ]}
              onPress={onClose}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <View style={[allocStyles.detailHero, { backgroundColor: colors.cardBackground }]}>
            <View style={allocStyles.detailHeroTop}>
              <UserPickedIconBadge icon={iconName as IconName} size={48} iconSize={26} />
              <View style={allocStyles.detailHeroCopy}>
                <Text style={[allocStyles.detailHeroEyebrow, { color: mutedTextColor }]}>Catégorie</Text>
                <Text style={[allocStyles.detailTitle, { color: colors.text }]} numberOfLines={2}>
                  {category.categoryName}
                </Text>
              </View>
            </View>
            <Text style={[allocStyles.detailAmount, { color: colors.text }]} adjustsFontSizeToFit numberOfLines={1}>
              {formatAllocMoney(spent)}
              <Text style={[allocStyles.detailAmountOf, { color: mutedTextColor }]}> / {formatAllocMoney(limit)}</Text>
            </Text>
            <View style={allocStyles.detailProgressRow}>
              <View style={[allocStyles.detailProgressTrack, { backgroundColor: colors.surfaceElevated }]}>
                <View
                  style={[
                    allocStyles.detailProgressFill,
                    { width: `${Math.min(100, progress * 100)}%`, backgroundColor: detailBarColor },
                  ]}
                />
              </View>
              <Text style={[allocStyles.detailUsage, { color: detailBarColor }]}>
                {usageState.isZeroLimitOverspend ? 'Dépassé' : `${usage} %`}
              </Text>
            </View>
            <Text style={[allocStyles.detailHeroMeta, { color: mutedTextColor }]}>
              Restant · {formatAllocMoney(remaining)}
            </Text>
          </View>

          <View style={[allocStyles.detailStatsGrid, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <DetailStat label="Limite mensuelle" value={formatAllocMoney(limit)} />
            <DetailStat label="Limite hebdo" value={category.weeklyLimitAmount != null ? formatAllocMoney(category.weeklyLimitAmount) : 'Non définie'} />
            <DetailStat label="Dépensé" value={formatAllocMoney(spent)} />
            <DetailStat label="Restant" value={formatAllocMoney(remaining)} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Voir l'historique de transaction pour ${category.categoryName}`}
            hitSlop={12}
            style={({ pressed }) => [
              allocStyles.historyWide,
              { backgroundColor: colors.cardBackground, borderColor: colors.border },
              pressed && allocStyles.detailBtnPressed,
            ]}
            onPress={() => onOpenHistory(category)}
          >
            <Ionicons name="list-outline" size={18} color={colors.primary} />
            <Text style={[allocStyles.historyWideText, { color: colors.text }]}>Voir l'historique</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Supprimer la catégorie ${category.categoryName}`}
            disabled={deleting}
            style={({ pressed }) => [
              allocStyles.deleteWide,
              { backgroundColor: colors.dangerMuted, borderColor: colors.danger },
              pressed && allocStyles.detailBtnPressed,
              deleting && allocStyles.disabled,
            ]}
            onPress={confirmDelete}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={[allocStyles.deleteWideText, { color: colors.danger }]}>
              {deleting ? 'Suppression...' : 'Supprimer la catégorie'}
            </Text>
          </Pressable>
        </>
      ) : null}
    </BottomSheet>
    <ConfirmDeleteModal
      visible={confirmVisible}
      title="Supprimer cette catégorie ?"
      message={category ? `${category.categoryName} sera retirée de ton budget. Les transactions existantes restent conservées.` : undefined}
      onConfirm={() => {
        if (!category) return;
        setConfirmVisible(false);
        setDeleting(true);
        void onDeleteCategory(category).finally(() => setDeleting(false));
      }}
      onCancel={() => setConfirmVisible(false)}
    />
    </>
  );
}

function BudgetCategoryFormModalContent({
  form,
  items,
  dashboard,
  saving,
  onChangeForm,
  onClose,
  onSave,
}: BudgetCategoryFormModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, ghost, isLight } = useAppTheme();
  const projection = useMemo(() => getCategoryProjection(form, items, dashboard), [dashboard, form, items]);

  return (
    <Modal visible={form != null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[allocStyles.modalBackdrop, { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0,0,0,0.62)' }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={allocStyles.modalKeyboard}>
          <View style={[allocStyles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={allocStyles.modalHeader}>
              <Text style={[allocStyles.modalTitle, { color: colors.text }]}>
                {form?.name ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
              </Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[allocStyles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
            >
              <CategoryFormField
                label="Nom"
                value={form?.name ?? ''}
                placeholder="Ex. Épicerie"
                onChangeText={(value) => onChangeForm((cur) => (cur ? { ...cur, name: value } : cur))}
              />
              <CategoryFormField
                label="Limite mensuelle"
                value={form?.limit ?? ''}
                placeholder="400"
                keyboardType="decimal-pad"
                onChangeText={(value) => onChangeForm((cur) => (cur ? { ...cur, limit: sanitizeAmount(value) } : cur))}
              />
              <CategoryFormField
                label="Limite hebdomadaire"
                value={form?.weeklyLimit ?? ''}
                placeholder="Ex. 90"
                keyboardType="decimal-pad"
                helper="Optionnelle. Se réinitialise chaque semaine et doit rester dans la limite mensuelle."
                onChangeText={(value) => onChangeForm((cur) => (cur ? { ...cur, weeklyLimit: sanitizeAmount(value) } : cur))}
              />
              <IconPicker
                selectedIcon={form?.icon ?? DEFAULT_ICON}
                selectedColor={normalizeColor(form?.color)}
                onSelect={(icon) => onChangeForm((cur) => (cur ? { ...cur, icon } : cur))}
              />
              <ColorPicker
                selectedColor={normalizeColor(form?.color)}
                onSelect={(color) => onChangeForm((cur) => (cur ? { ...cur, color } : cur))}
              />

              {projection ? <CategoryProjectionCard projection={projection} /> : null}

              <PrimarySaveButton
                label={saving ? 'Enregistrement...' : 'Enregistrer'}
                onPress={() => void onSave()}
                disabled={saving}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function CategoryFormField({
  label,
  value,
  placeholder,
  keyboardType,
  helper,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad';
  helper?: string;
  onChangeText: (value: string) => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={allocStyles.field}>
      <Text style={[allocStyles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[allocStyles.input, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
      />
      {helper ? <Text style={[allocStyles.fieldHint, { color: colors.textMuted }]}>{helper}</Text> : null}
    </View>
  );
}

function IconPicker({
  selectedIcon,
  selectedColor,
  onSelect,
}: {
  selectedIcon: string;
  selectedColor: string;
  onSelect: (icon: string) => void;
}) {
  const { colors, isLight } = useAppTheme();
  const pickerOptions = useMemo(() => {
    const options = [...CATEGORY_ICON_PICKER_OPTIONS];
    if (isIconName(selectedIcon) && !options.some((option) => option.icon === selectedIcon)) {
      options.unshift({
        id: 'custom',
        label: 'Personnalisé',
        icon: selectedIcon,
        color: normalizeUserIconColor(selectedColor) ?? colors.primary,
      });
    }
    return options;
  }, [colors.primary, selectedColor, selectedIcon]);

  return (
    <View style={allocStyles.pickerSection}>
      <Text style={[allocStyles.fieldLabel, { color: colors.textMuted }]}>Icône</Text>
      <View style={allocStyles.iconGrid}>
        {pickerOptions.map((option) => {
          const selected = selectedIcon === option.icon;

          return (
            <Pressable
              key={option.id}
              onPress={() => {
                tapHaptic();
                onSelect(option.icon);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Choisir l'icône ${option.label}`}
              style={({ pressed }) => [
                allocStyles.iconChoice,
                { backgroundColor: resolveUserPickedIconWellBackground(isLight), borderColor: colors.border },
                selected && [allocStyles.iconChoiceSelected, { borderColor: selectedColor }],
                pressed && { opacity: 0.72 },
              ]}
            >
              <UserPickedIconBadge icon={option.icon} color={option.color} size={36} iconSize={18} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ColorPicker({
  selectedColor,
  onSelect,
}: {
  selectedColor: string;
  onSelect: (color: string) => void;
}) {
  const { colors } = useAppTheme();
  const options = getColorOptions(CATEGORY_COLOR_OPTIONS, selectedColor);

  return (
    <View style={allocStyles.pickerSection}>
      <Text style={[allocStyles.fieldLabel, { color: colors.textMuted }]}>Couleur</Text>
      <View style={allocStyles.colorGrid}>
        {options.map((color) => {
          const selected = selectedColor.toLowerCase() === color.toLowerCase();

          return (
            <Pressable
              key={color}
              onPress={() => {
                tapHaptic();
                onSelect(color);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Choisir la couleur ${color}`}
              style={({ pressed }) => [
                allocStyles.colorChoice,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selected && [allocStyles.colorChoiceSelected, { borderColor: color }],
                pressed && { opacity: 0.72 },
              ]}
            >
              <View style={[allocStyles.colorSwatch, { backgroundColor: color }]}>
                {selected ? <Ionicons name="checkmark" size={16} color="#000000" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type CategoryProjection = {
  annualCost: number;
  budgetShare: number;
  projectedTotal: number;
  weeklyMonthlyEquivalent: number | null;
  remainingAfterLimits: number | null;
  commitmentRatio: number | null;
  hint: string;
};

function CategoryProjectionCard({ projection }: { projection: CategoryProjection }) {
  const { colors } = useAppTheme();

  return (
    <GlassContainer
      style={allocStyles.projectionCard}
      padding={spacing.lg}
      borderRadius={radius.xxl}
    >
      <Text style={[allocStyles.projectionTitle, { color: colors.text }]}>Impact estimé</Text>
      <ProjectionRow label="Coût annuel" value={formatDisplayMoneyAbsolute(projection.annualCost)} />
      <ProjectionRow label="Part du budget" value={formatPercent(projection.budgetShare)} />
      {projection.weeklyMonthlyEquivalent != null ? (
        <ProjectionRow label="Hebdo x 4,33" value={`${formatDisplayMoneyAbsolute(projection.weeklyMonthlyEquivalent)} / mois`} />
      ) : null}
      <ProjectionRow label="Budget mensuel total" value={formatDisplayMoneyAbsolute(projection.projectedTotal)} />
      {projection.remainingAfterLimits != null ? (
        <ProjectionRow label="Reste après limites" value={formatDisplayMoneyAbsolute(projection.remainingAfterLimits)} />
      ) : null}
      {projection.commitmentRatio != null ? (
        <ProjectionRow label="Limites / revenus" value={formatPercent(projection.commitmentRatio)} />
      ) : null}
      <Text style={[allocStyles.projectionHint, { color: colors.textMuted }]}>{projection.hint}</Text>
    </GlassContainer>
  );
}

function ProjectionRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={allocStyles.projectionRow}>
      <Text style={[allocStyles.projectionLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[allocStyles.projectionValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={allocStyles.detailStatCell}>
      <Text style={[allocStyles.detailStatLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[allocStyles.detailStatValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pageTitle: { ...PAGE_TITLE_STYLE },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const allocStyles = StyleSheet.create({
  section: { gap: PORTFOLIO_SECTION_GAP },
  listSection: { gap: spacing.md },
  categoriesHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  listTitleGroup: { flex: 1, minWidth: 0, gap: spacing.xs },
  listTitle: { ...SECTION_TITLE_STYLE },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  countBadgeLabel: { ...interBoldText, fontSize: typography.micro },
  groupedCard: { overflow: 'hidden' },
  groupedCardInner: { paddingVertical: 0 },
  categoryRowPressable: { width: '100%' },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: UNIFORM_ROW_MIN_HEIGHT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBody: { flex: 1, minWidth: 0, gap: 7 },
  rowMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowName: { ...rowLabel, ...interExtraBoldText },
  pctPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  rowPct: { ...rowValue, fontSize: typography.micro },
  rowAmt: { ...rowValue, flexShrink: 0 },
  rowAmtLeading: { flex: 1, minWidth: 0, flexShrink: 1 },
  emptyCardInner: { alignItems: 'center', gap: spacing.sm },
  emptyTitle: { ...interExtraBoldText, fontSize: typography.body },
  emptyHint: { ...interMediumText, fontSize: typography.caption, lineHeight: 20, textAlign: 'center' },
  emptyCta: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  emptyCtaText: { ...interBoldText, fontSize: typography.caption },
  pressed: { opacity: 0.82 },
  addCategoryCta: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addCategoryCtaLabel: {
    ...interBoldText,
    fontSize: typography.meta,
  },
  detailSheet: {
    borderTopLeftRadius: DETAIL_SHEET_TOP_RADIUS,
    borderTopRightRadius: DETAIL_SHEET_TOP_RADIUS,
  },
  detailContent: { gap: spacing.lg },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailSheetTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.dashboardGreeting,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  detailActionBtn: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  detailActionLabel: {
    fontSize: typography.micro,
    fontWeight: '700',
  },
  detailCloseBtn: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  detailBtnPressed: { opacity: 0.76 },
  detailHero: {
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  detailHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailHeroCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  detailHeroEyebrow: {
    ...interBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  detailTitle: { ...interExtraBoldText, fontSize: typography.title, letterSpacing: -0.4 },
  detailAmount: { ...interExtraBoldText, fontSize: 32, letterSpacing: -0.6 },
  detailAmountOf: { ...interBoldText, fontSize: 22 },
  detailProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailProgressTrack: {
    flex: 1,
    height: PROGRESS_BAR_TRACK_HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  detailProgressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  detailUsage: { ...interBoldText, fontSize: typography.meta, minWidth: 44, textAlign: 'right' },
  detailHeroMeta: { ...interMediumText, fontSize: typography.caption, fontWeight: '700' },
  historyWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  historyWideText: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  detailStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  detailStatCell: {
    width: '50%',
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  detailStatLabel: { fontSize: typography.micro, fontWeight: '600', marginBottom: 2 },
  detailStatValue: { fontSize: typography.meta, fontWeight: '700' },
  deleteWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
  },
  deleteWideText: { ...interBoldText, fontSize: typography.meta },
  disabled: { opacity: 0.45 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  modalKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '88%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: typography.title, fontWeight: '800' },
  modalContent: { gap: spacing.md, paddingTop: spacing.md },
  field: { flex: 1, gap: spacing.sm },
  fieldLabel: {
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: typography.body,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  fieldHint: { fontSize: typography.micro, lineHeight: 17 },
  pickerSection: { gap: spacing.sm },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconChoice: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconChoiceSelected: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
  },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorChoice: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  colorChoiceSelected: { borderWidth: 1.5 },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectionCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  projectionTitle: { fontSize: typography.body, fontWeight: '800' },
  projectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  projectionLabel: { flex: 1, fontSize: typography.caption, fontWeight: '700' },
  projectionValue: { fontSize: typography.caption, fontWeight: '800' },
  projectionHint: { fontSize: typography.caption, lineHeight: 20 },
  saveButton: {
    alignItems: 'center',
    borderRadius: radius.lg,
    paddingVertical: 16,
  },
  saveButtonText: { color: '#000000', fontSize: typography.body, fontWeight: '800' },
});

const DEFAULT_8_CATEGORIES: { id: string; name: string; icon: string; color: string; limit: number }[] = [
  { id: 'cat-food',      name: 'Épicerie',             icon: 'basket-outline',          color: '#34D399', limit: 400 },
  { id: 'cat-rest',      name: 'Restaurants / cafés',  icon: 'restaurant-outline',      color: '#F97316', limit: 200 },
  { id: 'cat-home',      name: 'Logement',             icon: 'home-outline',            color: '#8B5CF6', limit: 0   },
  { id: 'cat-gas',       name: 'Essence',              icon: 'flame-outline',           color: '#FB7185', limit: 150 },
  { id: 'cat-transport', name: 'Transport',            icon: 'train-outline',           color: '#00A854', limit: 100 },
  { id: 'cat-phone',     name: 'Téléphone / internet', icon: 'phone-portrait-outline',  color: '#14B8A6', limit: 80  },
  { id: 'cat-fun',       name: 'Loisirs',              icon: 'game-controller-outline', color: '#8B5CF6', limit: 80  },
  { id: 'cat-health',    name: 'Santé / pharmacie',    icon: 'medkit-outline',          color: '#34D399', limit: 60  },
];

async function ensureBudgetPresets() {
  const hasSeededPresets = await getSetting('budget_presets_v2_seeded', '0');
  const existingBudgets = await getCategoryBudgets();
  if (hasSeededPresets === '1') {
    return;
  }
  if (existingBudgets.length > 0) {
    await setSetting('budget_presets_v2_seeded', '1');
    return;
  }

  for (const preset of DEFAULT_8_CATEGORIES) {
    await upsertCategory({
      id: preset.id,
      name: preset.name,
      icon: preset.icon,
      color: preset.color,
    });
    await upsertCategoryBudget(preset.id, preset.limit);
  }
  const nextBudgets = await getCategoryBudgets();
  const nextTotal = nextBudgets.reduce((sum, item) => sum + item.limitAmount, 0);
  await setSetting('monthly_budget_limit', String(nextTotal));
  await setSetting('budget_presets_v2_seeded', '1');
}

async function refreshMonthlyBudgetLimit() {
  const nextBudgets = await getCategoryBudgets();
  const nextTotal = nextBudgets.reduce((sum, item) => sum + item.limitAmount, 0);
  await setSetting('monthly_budget_limit', String(nextTotal));
}

function getCategoryProjection(
  form: CategoryForm | null,
  items: CategoryBudget[],
  dashboard: DashboardSummary | null,
): CategoryProjection | null {
  if (!form) return null;
  const limit = parseAmount(form.limit || '0');
  if (Number.isNaN(limit) || limit < 0) return null;
  const weeklyLimit = form.weeklyLimit.trim() ? parseAmount(form.weeklyLimit) : null;
  const weeklyMonthlyEquivalent =
    weeklyLimit != null && !Number.isNaN(weeklyLimit) && weeklyLimit >= 0 ? weeklyLimit * WEEKS_PER_MONTH : null;

  const previousLimit = items.find((item) => item.categoryId === form.id)?.limitAmount ?? 0;
  const currentTotal = items.reduce((sum, item) => sum + item.limitAmount, 0);
  const projectedTotal = Math.max(0, currentTotal - previousLimit + limit);
  const monthlyIncome = dashboard?.monthlyIncome ?? 0;
  const remainingAfterLimits = monthlyIncome > 0 ? monthlyIncome - projectedTotal : null;
  const commitmentRatio = monthlyIncome > 0 ? projectedTotal / monthlyIncome : null;

  return {
    annualCost: limit * 12,
    budgetShare: projectedTotal > 0 ? limit / projectedTotal : 0,
    projectedTotal,
    weeklyMonthlyEquivalent,
    remainingAfterLimits,
    commitmentRatio,
    hint: getBudgetHint(commitmentRatio),
  };
}

function getBudgetHint(commitmentRatio: number | null) {
  if (commitmentRatio == null) {
    return 'Ajoute des revenus pour voir si cette limite laisse assez de marge.';
  }
  if (commitmentRatio >= 0.9) {
    return 'Attention: ces limites utilisent presque tout le revenu mensuel.';
  }
  if (commitmentRatio >= 0.75) {
    return 'Marge correcte, mais surveille les dépenses variables.';
  }
  return 'Cette limite garde une marge confortable dans le budget.';
}

function createLocalId() {
  return `cat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeAmount(value: string) {
  return value.replace(/[^0-9.,]/g, '').replace(',', '.');
}

function parseAmount(value: string) {
  return Number.parseFloat(value.replace(',', '.'));
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0 %';
  return `${Math.round(value * 100)} %`;
}

function normalizeColor(value?: string) {
  const color = value?.trim();
  return color?.startsWith('#') ? color : DEFAULT_COLOR;
}

function isIconName(value: string): value is IconName {
  return value in Ionicons.glyphMap;
}

function getColorOptions(options: readonly string[], selectedColor: string) {
  if (!options.some((color) => color.toLowerCase() === selectedColor.toLowerCase())) {
    return [selectedColor, ...options];
  }
  return [...options];
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    gap: PORTFOLIO_SECTION_GAP,
  },
});

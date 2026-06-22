import { memo, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  FlatList,
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
import { AppIcon } from '@/components/icons/AppIcon';
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
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { GlassContainer } from '@/components/GlassContainer';
import { ModifierButton } from '@/components/ModifierButton';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import type { FormFeedback } from '@/lib/formFeedback';
import { MdiIconPicker } from '@/components/MdiIconPicker';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import {
  BUDGET_PRESETS,
  CATEGORY_COLOR_OPTIONS,
  getCategoryIconName,
  type IconName,
} from '@/constants/categoryOptions';
import type { MdiIconName } from '@/lib/mdiIconCatalog';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  destructiveIconColor,
  destructiveTextActionStyle,
  FLOATING_NAV_CONTENT_PADDING,
  ICON_WELL_SIZE,
  jakartaBoldText,
  jakartaExtraBoldText,
  jakartaMediumText,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_STYLE,
  PORTFOLIO_SECTION_GAP,
  PROGRESS_BAR_TRACK_HEIGHT,
  SECTION_TITLE_STYLE,
  radius,
  spacing,
  subtleDeleteButtonStyle,
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
import { parseFormattedNumber, sanitizeNumericInput } from '@/lib/formatNumber';
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
  onDeleteCategory?: (category: CategoryBudget) => Promise<void>;
  feedback?: FormFeedback | null;
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
  const scrollRef = useRef<FlatList<CategoryRowModel>>(null);
  const lastLoadedAtRef = useRef(0);
  const loadInFlightRef = useRef(false);
  const [items, setItems] = useState<CategoryBudget[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryBudget | null>(null);
  const [highlightedCategoryId, setHighlightedCategoryId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formFeedback, setFormFeedback] = useState<FormFeedback | null>(null);
  const mutedTextColor = isLight ? colors.textMuted : '#909090';

  const showFormError = useCallback((title: string, message: string) => {
    setFormFeedback({ variant: 'error', title, message });
  }, []);

  const load = useCallback(async (force = false) => {
    if (loadInFlightRef.current) return;
    if (!force && Date.now() - lastLoadedAtRef.current < 2500) return;
    loadInFlightRef.current = true;
    try {
      await ensureBudgetPresets();
      const [budgets, nextDashboard] = await Promise.all([getCategoryBudgets(), getDashboard()]);
      setItems(budgets);
      setDashboard(nextDashboard);
      lastLoadedAtRef.current = Date.now();
    } finally {
      loadInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(() => {
    void load(true);
  }), [load]);

  useRefreshOnFocus(useCallback(() => {
    void load(false);
  }, [load]));
  useScrollToTopOnFocus(
    useCallback(() => {
      scrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, []),
  );

  const categoryModels = useMemo(() => buildCategoryModels(items), [items]);
  const { rows, chartSegments, limitTotal, spentTotal } = categoryModels;

  const handleSelectCategory = useCallback((category: CategoryBudget) => {
    tapHaptic();
    setHighlightedCategoryId(category.categoryId);
    setSelectedCategory(category);
  }, []);

  const handleSelectCategoryId = useCallback(
    (categoryId: string) => {
      const category = items.find((item) => item.categoryId === categoryId);
      if (!category) return;
      handleSelectCategory(category);
    },
    [handleSelectCategory, items],
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

  const renderCategoryRow = useCallback(
    ({ item: row }: { item: CategoryRowModel }) => (
      <BudgetCategoryRow
        row={row}
        highlighted={highlightedCategoryId === row.id}
        mutedTextColor={mutedTextColor}
        onPress={handleSelectCategoryId}
      />
    ),
    [handleSelectCategoryId, highlightedCategoryId, mutedTextColor],
  );

  const listHeader = useMemo(
    () => (
      <>
        <BudgetPageHeader onAdd={handleAddCategory} />
        {rows.length === 0 ? (
          <BudgetCategoriesEmpty mutedTextColor={mutedTextColor} onAddCategory={handleAddCategory} />
        ) : (
          <View style={allocStyles.section}>
            <BudgetAllocationChart
              segments={chartSegments}
              totalAllocated={limitTotal}
              totalSpent={spentTotal}
              selectedId={highlightedCategoryId}
              onSelectSegment={handleSelectCategoryId}
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
            </View>
          </View>
        )}
      </>
    ),
    [
      chartSegments,
      colors.surfaceElevated,
      colors.text,
      handleAddCategory,
      handleSelectCategoryId,
      highlightedCategoryId,
      limitTotal,
      mutedTextColor,
      rows.length,
      spentTotal,
    ],
  );

  const listFooter = useMemo(
    () => (rows.length > 0 ? <AddCategoryCta onPress={handleAddCategory} /> : null),
    [handleAddCategory, rows.length],
  );

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
    await load(true);
    setSaving(false);
    setFormFeedback(null);
    setForm(null);
    successHaptic();
  }, [form, load, saving, showFormError]);

  const handleDeleteCategory = useCallback(
    async (category: CategoryBudget) => {
      await deleteCategoryBudget(category.categoryId);
      await refreshMonthlyBudgetLimit();
      await load(true);
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
      <FlatList
        ref={scrollRef}
        style={[styles.screen, { backgroundColor: colors.background }]}
        data={rows}
        keyExtractor={(row) => row.id}
        extraData={highlightedCategoryId}
        renderItem={renderCategoryRow}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + SCREEN_TOP_GUTTER,
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl,
          },
        ]}
        ItemSeparatorComponent={CategoryRowSeparator}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load(true);
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
      />

      <BudgetCategoryDetailSheet
        category={selectedCategory}
        onClose={() => {
          setSelectedCategory(null);
          setHighlightedCategoryId(null);
        }}
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
        onClose={() => {
          setFormFeedback(null);
          setForm(null);
        }}
        onSave={handleSaveCategory}
        onDeleteCategory={handleDeleteCategory}
        feedback={formFeedback}
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

function CategoryRowSeparator() {
  return <View style={allocStyles.categoryRowSeparator} />;
}

const BudgetCategoryRow = memo(function BudgetCategoryRow({
  row,
  highlighted,
  mutedTextColor,
  onPress,
}: {
  row: CategoryRowModel;
  highlighted: boolean;
  mutedTextColor: string;
  onPress: (categoryId: string) => void;
}) {
  const { colors, isLight } = useAppTheme();
  const usage = getCategoryBudgetUsage(row.limit, row.spent);
  const usagePct = row.limit > 0 ? Math.round((row.spent / row.limit) * 100) : 0;
  const barColor = categoryBudgetBarColor(
    usage.usagePercent,
    usage.isZeroLimitOverspend,
    isLight,
    row.color,
    colors,
  );

  return (
    <Pressable android_ripple={null} onPress={() => onPress(row.id)}>
      <DashboardCard
        innerStyle={[
          allocStyles.categoryCardInner,
          highlighted && {
            backgroundColor: isLight ? 'rgba(0,168,84,0.05)' : 'rgba(0,230,100,0.06)',
          },
        ]}
        padding={0}
      >
        <View style={allocStyles.categoryRow}>
          <UserPickedIconBadge icon={row.icon as IconName} size={48} />
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
      </DashboardCard>
    </Pressable>
  );
});

function BudgetCategoriesEmpty({
  mutedTextColor,
  onAddCategory,
}: {
  mutedTextColor: string;
  onAddCategory: () => void;
}) {
  const { colors, isLight } = useAppTheme();

  return (
    <View style={allocStyles.section}>
      <View style={allocStyles.categoriesHeader}>
        <View style={allocStyles.listTitleGroup}>
          <DashboardSectionLabel>Catégories</DashboardSectionLabel>
          <Text style={[allocStyles.listTitle, { color: colors.text }]}>Mes catégories</Text>
        </View>
      </View>
      <DashboardCard innerStyle={allocStyles.emptyCardInner} padding={spacing.xl}>
        <AppIcon family="ionicons" name="pie-chart-outline" size={32} color={mutedTextColor} />
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
  onEditCategory,
  onOpenHistory,
}: {
  category: CategoryBudget | null;
  onClose: () => void;
  onEditCategory: (category: CategoryBudget) => void;
  onOpenHistory: (category: CategoryBudget) => void;
}) {
  const { colors, isLight } = useAppTheme();
  const mutedTextColor = isLight ? colors.textMuted : '#909090';
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

  return (
    <BottomSheet
      visible={Boolean(category)}
      onClose={onClose}
      sheetStyle={[allocStyles.detailSheet, { backgroundColor: colors.containerBackground }]}
      scrollContentContainerStyle={allocStyles.detailContent}
    >
      {category ? (
        <>
          <View style={allocStyles.detailHeader}>
            <Text style={[allocStyles.detailSheetTitle, { color: colors.text }]} {...rowTitleTextProps}>
              {category.categoryName}
            </Text>
            <ModifierButton
              accessibilityLabel={`Modifier la catégorie ${category.categoryName}`}
              onPress={() => onEditCategory(category)}
              hitSlop={10}
            />
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

          <View style={[allocStyles.detailHero, { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder, borderWidth: 1 }]}>
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

          <View style={[allocStyles.detailStatsGrid, { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder }]}>
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
              { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
              pressed && allocStyles.detailBtnPressed,
            ]}
            onPress={() => onOpenHistory(category)}
          >
            <Ionicons name="list-outline" size={18} color={colors.primary} />
            <Text style={[allocStyles.historyWideText, { color: colors.text }]}>Voir l'historique</Text>
          </Pressable>
        </>
      ) : null}
    </BottomSheet>
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
  onDeleteCategory,
  feedback,
}: BudgetCategoryFormModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, ghost, isLight } = useAppTheme();
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const projection = useMemo(() => getCategoryProjection(form, items, dashboard), [dashboard, form, items]);
  const editingCategory = useMemo(
    () => (form ? items.find((item) => item.categoryId === form.id) ?? null : null),
    [form, items],
  );

  return (
    <Modal visible={form != null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[allocStyles.modalBackdrop, { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0,0,0,0.62)' }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={allocStyles.modalKeyboard}>
          <View style={[allocStyles.modalCard, { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder }]}>
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
                key={form?.id ?? 'new-category'}
                selectedIcon={form?.icon ?? DEFAULT_ICON}
                selectedColor={normalizeColor(form?.color)}
                onSelect={(icon) => onChangeForm((cur) => (cur ? { ...cur, icon } : cur))}
              />
              <ColorPicker
                selectedColor={normalizeColor(form?.color)}
                onSelect={(color) => onChangeForm((cur) => (cur ? { ...cur, color } : cur))}
              />

              {projection ? <CategoryProjectionCard projection={projection} /> : null}

              {feedback ? (
                <ThemedFormMessage
                  variant={feedback.variant}
                  title={feedback.title}
                  message={feedback.message}
                />
              ) : null}

              <PrimarySaveButton
                label={saving ? 'Enregistrement...' : 'Enregistrer'}
                onPress={() => void onSave()}
                disabled={saving || deleting}
              />

              {editingCategory && onDeleteCategory ? (
                <>
                  <View style={[allocStyles.formDeleteDivider, { backgroundColor: colors.border }]} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Supprimer la catégorie ${editingCategory.categoryName}`}
                    disabled={saving || deleting}
                    style={({ pressed }) => [
                      subtleDeleteButtonStyle(isLight, { alignSelf: 'stretch' }),
                      pressed && { opacity: 0.72 },
                      (saving || deleting) && allocStyles.disabled,
                    ]}
                    onPress={() => setConfirmDeleteVisible(true)}
                  >
                    <Ionicons name="trash-outline" size={16} color={destructiveIconColor(isLight)} />
                    <Text style={destructiveTextActionStyle(isLight)}>
                      {deleting ? 'Suppression...' : 'Supprimer la catégorie'}
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>

      <ConfirmDeleteModal
        visible={confirmDeleteVisible}
        title="Supprimer cette catégorie ?"
        message={
          editingCategory
            ? `${editingCategory.categoryName} sera retirée de ton budget. Les transactions existantes restent conservées.`
            : undefined
        }
        onConfirm={() => {
          if (!editingCategory || !onDeleteCategory) return;
          setConfirmDeleteVisible(false);
          setDeleting(true);
          void onDeleteCategory(editingCategory)
            .then(() => {
              onClose();
            })
            .finally(() => setDeleting(false));
        }}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
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
  const InputComponent = keyboardType === 'decimal-pad' ? NumericAmountInput : TextInput;

  return (
    <View style={allocStyles.field}>
      <Text style={[allocStyles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <InputComponent
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
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={allocStyles.pickerSection}>
      <Text style={[allocStyles.fieldLabel, { color: colors.textMuted }]}>Icône</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Modifier l'icône de catégorie"
        onPress={() => {
          tapHaptic();
          setExpanded((value) => !value);
        }}
        style={({ pressed }) => [allocStyles.iconPreviewTap, pressed && { opacity: 0.78 }]}
      >
        <UserPickedIconBadge icon={selectedIcon} color={selectedColor} size={52} iconSize={24} />
      </Pressable>
      {expanded ? (
        <MdiIconPicker
          selectedIcon={selectedIcon}
          onSelect={(icon: MdiIconName) => {
            onSelect(icon);
            setExpanded(false);
          }}
        />
      ) : null}
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
  countBadgeLabel: { ...jakartaBoldText, fontSize: typography.micro },
  categoryCards: { gap: spacing.md },
  categoryRowSeparator: { height: spacing.md },
  categoryCardInner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    minHeight: UNIFORM_ROW_MIN_HEIGHT,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowBody: { flex: 1, minWidth: 0, gap: 7 },
  rowMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowName: { ...rowLabel, ...jakartaExtraBoldText },
  pctPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  rowPct: { ...rowValue, fontSize: typography.micro },
  rowAmt: { ...rowValue, flexShrink: 0 },
  rowAmtLeading: { flex: 1, minWidth: 0, flexShrink: 1 },
  emptyCardInner: { alignItems: 'center', gap: spacing.sm },
  emptyTitle: { ...jakartaExtraBoldText, fontSize: typography.body },
  emptyHint: { ...jakartaMediumText, fontSize: typography.caption, lineHeight: 20, textAlign: 'center' },
  emptyCta: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  emptyCtaText: { ...jakartaBoldText, fontSize: typography.caption },
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
    ...jakartaBoldText,
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
    ...jakartaBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  detailTitle: { ...jakartaExtraBoldText, fontSize: typography.title, letterSpacing: -0.4 },
  detailAmount: { ...jakartaExtraBoldText, fontSize: 32, letterSpacing: -0.6 },
  detailAmountOf: { ...jakartaBoldText, fontSize: 22 },
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
  detailUsage: { ...jakartaBoldText, fontSize: typography.meta, minWidth: 44, textAlign: 'right' },
  detailHeroMeta: { ...jakartaMediumText, fontSize: typography.caption, fontWeight: '700' },
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
  formDeleteDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
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
  iconPreviewTap: { alignSelf: 'flex-start' },
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
  return sanitizeNumericInput(value);
}

function parseAmount(value: string) {
  return parseFormattedNumber(value);
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

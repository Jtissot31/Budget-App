import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Alert,
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
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { GlassContainer } from '@/components/GlassContainer';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { SurfaceCard } from '@/components/SurfaceCard';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import {
  BUDGET_PRESETS,
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  getCategoryIconName,
  type IconName,
} from '@/constants/categoryOptions';
import {
  FLOATING_SCROLL_ICON_SIZE,
  FLOATING_SCROLL_SIZE,
  floatingGlassButtonPressed,
  floatingGlassScrollSurface,
} from '@/constants/floatingGlassButton';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { colors, FLOATING_NAV_CONTENT_PADDING, PAGE_TITLE_CONTENT_GAP, PROGRESS_BAR_TRACK_HEIGHT, radius, spacing, typography } from '@/constants/theme';
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
import { formatCompactMoneyMagnitude } from '@/lib/formatCompactGainDollars';
import { categoryBudgetBarColor, getCategoryBudgetUsage } from '@/lib/categoryBudgetUsage';
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

export default function BudgetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, ghostCardShadow, isLight } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const budgetCardYRef = useRef(0);
  const budgetChartYRef = useRef(0);
  const budgetChartHeightRef = useRef(0);
  const budgetScrollYRef = useRef(0);
  const [items, setItems] = useState<CategoryBudget[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryBudget | null>(null);
  const [form, setForm] = useState<CategoryForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showBudgetScrollUp, setShowBudgetScrollUp] = useState(false);
  const hasBudgetChart = useMemo(() => items.some((item) => item.limitAmount > 0 || item.spent > 0), [items]);

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

  useEffect(() => {
    if (hasBudgetChart) return;

    budgetChartHeightRef.current = 0;
    setShowBudgetScrollUp(false);
  }, [hasBudgetChart]);

  useRefreshOnFocus(load);
  useScrollToTopOnFocus(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  const updateBudgetScrollUpVisibility = useCallback((offsetY: number) => {
    const chartHeight = budgetChartHeightRef.current;
    if (chartHeight <= 0) {
      setShowBudgetScrollUp(false);
      return;
    }

    const chartTop = budgetCardYRef.current + budgetChartYRef.current;
    const chartBottom = chartTop + chartHeight;
    const shouldShow = offsetY > chartBottom - spacing.sm;
    setShowBudgetScrollUp((prev) => (prev === shouldShow ? prev : shouldShow));
  }, []);

  const handleBudgetCardLayout = useCallback(
    (event: LayoutChangeEvent) => {
      budgetCardYRef.current = event.nativeEvent.layout.y;
      updateBudgetScrollUpVisibility(budgetScrollYRef.current);
    },
    [updateBudgetScrollUpVisibility],
  );

  const handleBudgetChartLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height, y } = event.nativeEvent.layout;
      budgetChartYRef.current = y;
      budgetChartHeightRef.current = height;
      updateBudgetScrollUpVisibility(budgetScrollYRef.current);
    },
    [updateBudgetScrollUpVisibility],
  );

  const handleBudgetScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      budgetScrollYRef.current = offsetY;
      updateBudgetScrollUpVisibility(offsetY);
    },
    [updateBudgetScrollUpVisibility],
  );

  const scrollToBudgetChart = useCallback(() => {
    tapHaptic();
    const chartTop = budgetCardYRef.current + budgetChartYRef.current;
    scrollRef.current?.scrollTo({ y: Math.max(chartTop, 0), animated: true });
  }, []);

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
      Alert.alert('Nom requis', 'Ajoute un nom pour la catégorie.');
      return;
    }
    if (Number.isNaN(limit) || limit < 0) {
      Alert.alert('Limite invalide', 'Entre une limite mensuelle positive ou 0.');
      return;
    }
    if (weeklyLimit != null && (Number.isNaN(weeklyLimit) || weeklyLimit < 0)) {
      Alert.alert('Limite hebdomadaire invalide', 'Entre une limite hebdomadaire positive ou laisse le champ vide.');
      return;
    }
    if (weeklyLimit != null && weeklyLimit * WEEKS_PER_MONTH > limit) {
      Alert.alert(
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
  }, [form, load, saving]);

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
    <View style={[styles.screen, { backgroundColor: isLight ? '#FFFFFF' : '#000000' }]}>
      <ScrollView
        ref={scrollRef}
        style={[styles.screen, { backgroundColor: isLight ? '#FFFFFF' : '#000000' }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + SCREEN_TOP_GUTTER,
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleBudgetScroll}
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
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Budget</Text>
        </View>

        <View onLayout={handleBudgetCardLayout}>
          <BudgetAllocationCard
            items={items}
            onChartLayout={handleBudgetChartLayout}
            onAddCategory={handleAddCategory}
            onSelectCategory={setSelectedCategory}
          />
        </View>
      </ScrollView>

      <BudgetCategoryDetailSheet
        category={selectedCategory}
        onClose={() => setSelectedCategory(null)}
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

      {showBudgetScrollUp ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.floatingActions,
            {
              right: spacing.lg,
              bottom: Math.max(
                insets.bottom + FLOATING_NAV_CONTENT_PADDING + 88 + FLOATING_SCROLL_SIZE,
                132 + FLOATING_SCROLL_SIZE,
              ),
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remonter au graphique du budget"
            style={({ pressed }) => [
              floatingGlassScrollSurface(colors, isLight),
              ghostCardShadow,
              pressed && floatingGlassButtonPressed,
            ]}
            onPress={scrollToBudgetChart}
          >
            <Ionicons name="chevron-up" size={FLOATING_SCROLL_ICON_SIZE} color={colors.text} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const DONUT_SIZE = 216;
const DONUT_STROKE = 34;
const DONUT_RADIUS = (DONUT_SIZE - DONUT_STROKE) / 2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const DONUT_GAP = 2.6;
const DONUT_MIN_SWEEP_DEGREES = 6;

type AllocSeg = {
  id: string;
  name: string;
  color: string;
  icon: string;
  limit: number;
  spent: number;
  weeklyLimit?: number | null;
  frac: number;
};

function getDonutVisualFractions(segs: AllocSeg[]): number[] {
  const rawFractions = segs.map((seg) => Math.max(0, seg.frac));
  const positiveCount = rawFractions.filter((frac) => frac > 0).length;
  if (positiveCount === 0) {
    return rawFractions;
  }

  const minFrac = Math.min(DONUT_MIN_SWEEP_DEGREES / 360, 0.72 / positiveCount);
  const smallCount = rawFractions.filter((frac) => frac > 0 && frac < minFrac).length;
  const fixedTotal = smallCount * minFrac;
  const largeTotal = rawFractions.reduce((sum, frac) => (frac >= minFrac ? sum + frac : sum), 0);
  const scale = largeTotal > 0 ? Math.max(0, 1 - fixedTotal) / largeTotal : 0;

  return rawFractions.map((frac) => {
    if (frac <= 0) return 0;
    if (frac < minFrac) return minFrac;
    return frac * scale;
  });
}

function formatAllocMoney(v: number): string {
  const n = Math.max(0, v);
  if (n >= 10000) return formatCompactMoneyMagnitude(n);
  return `${Math.round(n).toLocaleString('fr-CA')} $`;
}

function getReadableIconColor(backgroundColor: string): '#000000' | '#FFFFFF' {
  const hex = backgroundColor.replace('#', '').trim();
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return '#FFFFFF';
  }

  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  const toLinear = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  const luminance = 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);

  return contrastWithBlack > contrastWithWhite ? '#000000' : '#FFFFFF';
}

function BudgetAllocationCard({
  items,
  onChartLayout,
  onAddCategory,
  onSelectCategory,
}: {
  items: CategoryBudget[];
  onChartLayout: (event: LayoutChangeEvent) => void;
  onAddCategory: () => void;
  onSelectCategory: (category: CategoryBudget) => void;
}) {
  const { colors, ghostCardShadow, isLight } = useAppTheme();

  const { segs, totalLimit, totalSpent } = useMemo(() => {
    const active = items
      .filter((item) => item.limitAmount > 0 || item.spent > 0)
      .sort((a, b) => b.limitAmount - a.limitAmount || b.spent - a.spent);
    const limitTotal = active.reduce((sum, item) => sum + Math.max(0, item.limitAmount), 0);
    const spentTotal = active.reduce((sum, item) => sum + Math.max(0, item.spent), 0);
    const portionTotal = limitTotal > 0 ? limitTotal : spentTotal;
    const nextSegs = active.map<AllocSeg>((item) => {
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
        weeklyLimit: item.weeklyLimitAmount ?? null,
        frac: portionTotal > 0 ? amountForPortion / portionTotal : 0,
      };
    });

    return { segs: nextSegs, totalLimit: limitTotal, totalSpent: spentTotal };
  }, [items]);

  const categoryById = useMemo(() => {
    const lookup = new Map<string, CategoryBudget>();
    items.forEach((item) => lookup.set(item.categoryId, item));
    return lookup;
  }, [items]);

  const handlePress = useCallback(
    (id: string) => {
      const category = categoryById.get(id);
      if (!category) return;
      tapHaptic();
      onSelectCategory(category);
    },
    [categoryById, onSelectCategory],
  );

  const donutFractions = getDonutVisualFractions(segs);
  const trackBg = isLight ? '#E5E7EB' : '#050505';
  const donutTrack = isLight ? '#ECEFF3' : '#060606';
  const centerSurface = isLight ? '#FFFFFF' : '#000000';

  if (segs.length === 0) {
    return (
      <View style={allocStyles.card}>
        <View style={allocStyles.cardHeader}>
          <View style={allocStyles.cardTitleGroup}>
            <Text style={[allocStyles.cardTitle, { color: colors.text }]}>Répartition du budget</Text>
            <Text style={[allocStyles.cardSubtitle, { color: colors.textMuted }]}>
              Aucune catégorie active ce mois-ci
            </Text>
          </View>
        </View>
        <Text style={[allocStyles.empty, { color: colors.textMuted }]}>
          Ajoute une limite par catégorie pour visualiser les portions du budget.
        </Text>
        <AddCategoryCta onPress={onAddCategory} />
      </View>
    );
  }

  return (
    <View style={allocStyles.card}>
      {/* Header */}
      <View style={allocStyles.cardHeader}>
        <View style={allocStyles.cardTitleGroup}>
          <Text style={[allocStyles.cardTitle, { color: colors.text }]}>Répartition du budget</Text>
          <Text style={[allocStyles.cardSubtitle, { color: colors.textMuted }]}>
            {`${formatAllocMoney(totalLimit)} alloué · ${formatAllocMoney(totalSpent)} dépensé`}
          </Text>
        </View>
      </View>

      <View
        onLayout={onChartLayout}
        style={allocStyles.chartShell}
      >
        <View style={allocStyles.donutWrap}>
          <Svg width={DONUT_SIZE} height={DONUT_SIZE} style={allocStyles.donutSvg}>
            <Circle
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={DONUT_RADIUS}
              stroke={donutTrack}
              strokeWidth={DONUT_STROKE + StyleSheet.hairlineWidth}
              fill="none"
            />
            {segs.map((seg, idx) => {
              const visualFrac = donutFractions[idx] ?? 0;
              const start = donutFractions.slice(0, idx).reduce((sum, frac) => sum + frac, 0) * DONUT_CIRCUMFERENCE;
              const dash = Math.max(0, visualFrac * DONUT_CIRCUMFERENCE - DONUT_GAP);

              return (
                <Circle
                  key={seg.id}
                  cx={DONUT_SIZE / 2}
                  cy={DONUT_SIZE / 2}
                  r={DONUT_RADIUS}
                  stroke={seg.color}
                  strokeWidth={DONUT_STROKE}
                  fill="none"
                  strokeLinecap="butt"
                  strokeDasharray={`${dash} ${DONUT_CIRCUMFERENCE - dash}`}
                  strokeDashoffset={-(start + DONUT_GAP / 2)}
                  rotation={-90}
                  origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}
                  onPress={() => handlePress(seg.id)}
                />
              );
            })}
          </Svg>
          <View
            pointerEvents="none"
            style={[
              allocStyles.donutCenter,
              {
                backgroundColor: centerSurface,
                borderColor: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)',
              },
            ]}
          >
            <Text style={[allocStyles.donutLabel, { color: colors.textMuted }]}>Budget mensuel</Text>
            <Text style={[allocStyles.donutAmount, { color: colors.text }]} numberOfLines={1}>
              {formatAllocMoney(totalLimit)}
            </Text>
            <Text style={[allocStyles.donutSpent, { color: colors.textSecondary }]} numberOfLines={1}>
              par mois
            </Text>
          </View>
        </View>
      </View>

      <View style={allocStyles.listSection}>
        <View style={allocStyles.listHeader}>
          <View style={allocStyles.listTitleGroup}>
            <Text style={[allocStyles.listTitle, { color: colors.text }]}>Catégories</Text>
            <Text style={[allocStyles.listDescription, { color: colors.textMuted }]}>
              Répartition de tes limites mensuelles.
            </Text>
          </View>
          <Text style={[allocStyles.listCount, { color: colors.textMuted }]}>{`${segs.length} actives`}</Text>
        </View>
        {segs.map((seg) => {
          const usage = getCategoryBudgetUsage(seg.limit, seg.spent);
          const spentProgress = usage.progress;
          const barColor = categoryBudgetBarColor(
            usage.usagePercent,
            usage.isZeroLimitOverspend,
            isLight,
            seg.color,
            colors,
          );
          return (
            <Pressable
              key={seg.id}
              android_ripple={null}
              style={[allocStyles.categoryCardPressable, ghostCardShadow]}
              onPress={() => handlePress(seg.id)}
            >
              <GlassContainer
                style={allocStyles.categoryCard}
                innerStyle={allocStyles.categoryRow}
                padding={14}
                borderRadius={radius.xxl}
              >
              <UserPickedIconBadge icon={seg.icon as IconName} color={seg.color} size={40} iconSize={20} />
              <View style={allocStyles.rowBody}>
                <View style={allocStyles.rowMain}>
                  <Text
                    style={[allocStyles.rowName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {seg.name}
                  </Text>
                  <Text style={[allocStyles.rowPct, { color: seg.color }]}>
                    {`${Math.round(seg.frac * 100)}%`}
                  </Text>
                </View>
                <View style={[allocStyles.miniTrack, { backgroundColor: trackBg }]}>
                  <View style={[allocStyles.miniFill, { width: `${spentProgress * 100}%`, backgroundColor: barColor }]} />
                </View>
                <View style={allocStyles.rowMain}>
                  {usage.isZeroLimitOverspend ? (
                    <Text style={[allocStyles.rowAmt, { color: barColor, fontWeight: '700' }]}>Budget dépassé</Text>
                  ) : (
                    <Text style={[allocStyles.rowAmt, { color: colors.textSecondary }]}>
                      {`${formatAllocMoney(seg.spent)} dépensé`}
                    </Text>
                  )}
                  <Text style={[allocStyles.rowAmt, { color: colors.textSecondary }]}>
                    {usage.isZeroLimitOverspend
                      ? '0 $ alloué'
                      : `${formatAllocMoney(seg.limit)} limite`}
                  </Text>
                </View>
              </View>
              <View style={allocStyles.rowRight}>
                <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
              </View>
              </GlassContainer>
            </Pressable>
          );
        })}
        <AddCategoryCta onPress={onAddCategory} />
      </View>
    </View>
  );
}

function AddCategoryCta({ onPress }: { onPress: () => void }) {
  const { colors, ghostCardShadow, isLight } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ajouter une catégorie"
      onPress={onPress}
      style={({ pressed }) => [
        allocStyles.addCategoryCta,
        ghostCardShadow,
        {
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 18, 18, 0.92)',
          borderColor: colors.borderStrong,
        },
        pressed && floatingGlassButtonPressed,
      ]}
    >
      <Ionicons name="add" size={18} color={colors.textSecondary} />
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
  const { colors, ghostCardShadow, isLight } = useAppTheme();
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
      sheetStyle={[allocStyles.detailSheet, { backgroundColor: colors.surfaceSolid }]}
      scrollContentContainerStyle={allocStyles.detailContent}
    >
      {category ? (
        <>
          <View style={allocStyles.detailHeader}>
            <Text style={[allocStyles.detailSheetTitle, { color: colors.text }]} numberOfLines={1}>
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

          <SurfaceCard
            style={[allocStyles.detailSummaryCardShell, ghostCardShadow]}
            innerStyle={allocStyles.detailSummaryCardInner}
            padding={spacing.lg}
            innerBackgroundColor={colors.surfaceSolid}
          >
            <View style={allocStyles.detailHeroTop}>
              <UserPickedIconBadge
                icon={iconName as IconName}
                color={category.categoryColor}
                size={52}
                iconSize={30}
              />
              <View style={allocStyles.detailHeroCopy}>
                <Text style={[allocStyles.detailEyebrow, { color: colors.textMuted }]}>Catégorie budget</Text>
                <Text style={[allocStyles.detailTitle, { color: colors.text }]} numberOfLines={2}>
                  {category.categoryName}
                </Text>
              </View>
            </View>
            <View style={allocStyles.detailAmountBlock}>
              <Text style={[allocStyles.detailLabel, { color: colors.textMuted }]}>Dépensé ce mois-ci</Text>
              <Text style={[allocStyles.detailAmount, { color: colors.text }]} adjustsFontSizeToFit numberOfLines={1}>
                {formatAllocMoney(spent)}
                <Text style={[allocStyles.detailAmountOf, { color: colors.textMuted }]}> / {formatAllocMoney(limit)}</Text>
              </Text>
            </View>
            <View style={allocStyles.detailProgressRow}>
              <View style={[allocStyles.detailTrack, { backgroundColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }]}>
                <View
                  style={[
                    allocStyles.detailFill,
                    { width: `${progress * 100}%`, backgroundColor: detailBarColor },
                  ]}
                />
              </View>
              <Text style={[allocStyles.detailUsage, { color: detailBarColor }]}>
                {usageState.isZeroLimitOverspend ? 'Budget dépassé' : `${usage}%`}
              </Text>
            </View>
            <View style={allocStyles.detailSummaryFooter}>
              <View style={[allocStyles.detailSummaryPill, { backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.07)' }]}>
                <Text style={[allocStyles.detailPillLabel, { color: colors.textMuted }]}>Restant</Text>
                <Text style={[allocStyles.detailPillValue, { color: colors.text }]} numberOfLines={1}>
                  {formatAllocMoney(remaining)}
                </Text>
              </View>
              <View style={[allocStyles.detailSummaryPill, { backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.07)' }]}>
                <Text style={[allocStyles.detailPillLabel, { color: colors.textMuted }]}>Usage</Text>
                <Text style={[allocStyles.detailPillValue, { color: category.categoryColor }]} numberOfLines={1}>
                  {usage}%
                </Text>
              </View>
            </View>
          </SurfaceCard>

          <View
            style={[
              allocStyles.detailStatsGrid,
              {
                backgroundColor: isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.04)',
                borderColor: colors.border,
              },
            ]}
          >
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
              {
                backgroundColor: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)',
                borderColor: colors.border,
              },
              pressed && allocStyles.detailBtnPressed,
            ]}
            onPress={() => onOpenHistory(category)}
          >
            <Ionicons name="list-outline" size={18} color={colors.primary} />
            <Text style={[allocStyles.historyWideText, { color: colors.text }]}>
              Voir historique de transaction
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Supprimer la catégorie ${category.categoryName}`}
            disabled={deleting}
            style={({ pressed }) => [
              allocStyles.deleteWide,
              { backgroundColor: colors.danger },
              pressed && allocStyles.detailBtnPressed,
              deleting && allocStyles.disabled,
            ]}
            onPress={confirmDelete}
          >
            <Ionicons name="trash-outline" size={18} color={colors.background} />
            <Text style={[allocStyles.deleteWideText, { color: colors.background }]}>
              {deleting ? 'Suppression...' : 'Supprimer cette catégorie'}
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
          <View style={[allocStyles.modalCard, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
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
        style={[allocStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
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
  const options = getIconOptions(CATEGORY_ICON_OPTIONS, selectedIcon);
  const defaultGlyph = resolveUserPickedIconGlyphColor(null, isLight, colors);

  return (
    <View style={allocStyles.pickerSection}>
      <Text style={[allocStyles.fieldLabel, { color: colors.textMuted }]}>Icône</Text>
      <View style={allocStyles.iconGrid}>
        {options.map((icon) => {
          const selected = selectedIcon === icon;
          const glyphColor = selected
            ? normalizeUserIconColor(selectedColor) ?? defaultGlyph
            : defaultGlyph;

          return (
            <Pressable
              key={icon}
              onPress={() => {
                tapHaptic();
                onSelect(icon);
              }}
              accessibilityRole="button"
              accessibilityLabel="Choisir cette icône"
              style={({ pressed }) => [
                allocStyles.iconChoice,
                { backgroundColor: resolveUserPickedIconWellBackground(isLight), borderColor: colors.border },
                selected && [allocStyles.iconChoiceSelected, { borderColor: selectedColor }],
                pressed && { opacity: 0.72 },
              ]}
            >
              <Ionicons name={icon} size={22} color={glyphColor} />
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
    <GlassContainer style={allocStyles.projectionCard} padding={spacing.lg} borderRadius={radius.xxl} innerBackgroundColor={colors.surfaceSolid}>
      <Text style={[allocStyles.projectionTitle, { color: colors.text }]}>Impact estimé</Text>
      <ProjectionRow label="Coût annuel" value={`${formatMoney(projection.annualCost)} $`} />
      <ProjectionRow label="Part du budget" value={formatPercent(projection.budgetShare)} />
      {projection.weeklyMonthlyEquivalent != null ? (
        <ProjectionRow label="Hebdo x 4,33" value={`${formatMoney(projection.weeklyMonthlyEquivalent)} $ / mois`} />
      ) : null}
      <ProjectionRow label="Budget mensuel total" value={`${formatMoney(projection.projectedTotal)} $`} />
      {projection.remainingAfterLimits != null ? (
        <ProjectionRow label="Reste après limites" value={`${formatMoney(projection.remainingAfterLimits)} $`} />
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

const allocStyles = StyleSheet.create({
  card: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  cardTitleGroup: { flex: 1, gap: spacing.xs },
  cardTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.35 },
  cardSubtitle: { fontSize: 12, fontWeight: '600' },
  empty: { fontSize: 13, fontWeight: '600', lineHeight: 20, marginTop: spacing.sm },
  chartShell: {
    paddingVertical: spacing.lg,
  },
  donutWrap: {
    alignSelf: 'center',
    width: DONUT_SIZE,
    height: DONUT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutSvg: { position: 'absolute' },
  donutCenter: {
    width: DONUT_SIZE - DONUT_STROKE * 2 - 8,
    height: DONUT_SIZE - DONUT_STROKE * 2 - 8,
    borderRadius: (DONUT_SIZE - DONUT_STROKE * 2 - 8) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  donutLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textAlign: 'center', textTransform: 'uppercase' },
  donutAmount: { fontSize: 28, fontWeight: '900', letterSpacing: -0.9, marginTop: 3, textAlign: 'center' },
  donutSpent: { fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  listSection: { gap: spacing.md, marginTop: spacing.xl },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  listTitleGroup: { flex: 1, gap: spacing.xs },
  listTitle: { fontSize: typography.dashboardGreeting, fontWeight: '800', letterSpacing: -0.35, lineHeight: 22 },
  listDescription: { fontSize: typography.caption, fontWeight: '600', lineHeight: 20 },
  listCount: { fontSize: 11, fontWeight: '700' },
  categoryCardPressable: {
    alignSelf: 'stretch',
    width: '100%',
  },
  categoryCard: {
    alignSelf: 'stretch',
    width: '100%',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBody: { flex: 1, minWidth: 0, gap: 7 },
  rowMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowName: { flex: 1, fontSize: 14, fontWeight: '800', letterSpacing: -0.18 },
  rowRight: { alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 },
  rowPct: { fontSize: 14, fontWeight: '800', letterSpacing: -0.22 },
  rowAmt: { fontSize: 12, fontWeight: '600' },
  miniTrack: { height: PROGRESS_BAR_TRACK_HEIGHT, borderRadius: radius.pill, overflow: 'hidden' },
  miniFill: { height: PROGRESS_BAR_TRACK_HEIGHT, borderRadius: radius.pill },
  addCategoryCta: {
    marginTop: spacing.md,
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
    fontSize: typography.meta,
    fontWeight: '700',
    letterSpacing: 0.15,
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
  detailSummaryCardShell: {
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  detailSummaryCardInner: {
    gap: spacing.md,
  },
  detailHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeroCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  detailEyebrow: { fontSize: typography.micro, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  detailTitle: { fontSize: typography.screenTitle, fontWeight: '900', letterSpacing: -0.6 },
  detailAmountBlock: { gap: 2 },
  detailLabel: { fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.58, textTransform: 'uppercase' },
  detailAmount: { fontSize: 32, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 },
  detailAmountOf: { fontSize: 22, fontWeight: '700' },
  detailProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailUsage: { fontSize: typography.meta, fontWeight: '800', minWidth: 44, textAlign: 'right' },
  detailTrack: { flex: 1, height: PROGRESS_BAR_TRACK_HEIGHT, borderRadius: radius.pill, overflow: 'hidden' },
  detailFill: { height: PROGRESS_BAR_TRACK_HEIGHT, borderRadius: radius.pill },
  detailSummaryFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  detailSummaryPill: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailPillLabel: { fontSize: typography.micro, fontWeight: '800', letterSpacing: 0.35, textTransform: 'uppercase' },
  detailPillValue: { marginTop: 3, fontSize: typography.caption, fontWeight: '900' },
  historyWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius.xl,
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
    minHeight: 52,
    borderRadius: radius.xl,
  },
  deleteWideText: { fontSize: typography.body, fontWeight: '900' },
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
    backgroundColor: colors.surfaceSolid,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '88%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: colors.text, fontSize: typography.title, fontWeight: '800' },
  modalContent: { gap: spacing.md, paddingTop: spacing.md },
  field: { flex: 1, gap: spacing.sm },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: typography.body,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  fieldHint: { color: colors.textMuted, fontSize: typography.micro, lineHeight: 17 },
  pickerSection: { gap: spacing.sm },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconChoice: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  projectionTitle: { color: colors.text, fontSize: typography.body, fontWeight: '800' },
  projectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  projectionLabel: { flex: 1, color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  projectionValue: { color: colors.text, fontSize: typography.caption, fontWeight: '800' },
  projectionHint: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 20 },
  saveButton: {
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    paddingVertical: 16,
  },
  saveButtonText: { color: '#000000', fontSize: typography.body, fontWeight: '800' },
});

async function ensureBudgetPresets() {
  const hasSeededPresets = await getSetting('budget_presets_seeded', '0');
  const existingBudgets = await getCategoryBudgets();
  if (hasSeededPresets === '1') {
    return;
  }
  if (existingBudgets.length > 0) {
    await setSetting('budget_presets_seeded', '1');
    return;
  }

  for (const preset of BUDGET_PRESETS) {
    await upsertCategory({
      id: preset.id,
      name: preset.name,
      icon: preset.icon,
      color: preset.color,
    });
    await upsertCategoryBudget(preset.id, preset.defaultLimit);
  }
  const nextBudgets = await getCategoryBudgets();
  const nextTotal = nextBudgets.reduce((sum, item) => sum + item.limitAmount, 0);
  await setSetting('monthly_budget_limit', String(nextTotal));
  await setSetting('budget_presets_seeded', '1');
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

function formatMoney(value: number) {
  return value.toFixed(0);
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

function getIconOptions(options: IconName[], selectedIcon: string) {
  if (isIconName(selectedIcon) && !options.includes(selectedIcon)) {
    return [selectedIcon, ...options];
  }
  return options;
}

function getColorOptions(options: readonly string[], selectedColor: string) {
  if (!options.some((color) => color.toLowerCase() === selectedColor.toLowerCase())) {
    return [selectedColor, ...options];
  }
  return [...options];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: PAGE_TITLE_CONTENT_GAP },
  header: { gap: spacing.xs, marginBottom: spacing.xs },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  floatingActions: {
    position: 'absolute',
    alignItems: 'center',
    gap: spacing.sm,
  },
});

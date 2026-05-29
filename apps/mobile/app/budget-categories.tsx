import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar } from '@/components/ProgressBar';
import { GlassContainer } from '@/components/GlassContainer';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { PageTransition } from '@/components/PageTransition';
import { categoryBudgetBarColor, getCategoryBudgetUsage } from '@/lib/categoryBudgetUsage';
import {
  normalizeUserIconColor,
  resolveUserPickedIconGlyphColor,
  resolveUserPickedIconWellBackground,
} from '@/lib/userPickedIcon';
import { CATEGORY_COLOR_OPTIONS, CATEGORY_ICON_OPTIONS, getCategoryIconName, type IconName } from '@/constants/categoryOptions';
import { SCREEN_TOP_GUTTER, ghost, ghostCardShadow } from '@/constants/ghostUi';
import { FLOATING_NAV_CONTENT_PADDING, PAGE_TITLE_CONTENT_GAP, colors, radius, spacing, typography } from '@/constants/theme';
import {
  deleteCategoryBudget,
  getCategoryBudgets,
  getDashboard,
  setSetting,
  upsertCategory,
  upsertCategoryBudget,
} from '@/lib/db';
import { successHaptic, tapHaptic } from '@/lib/haptics';
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
const WEEKS_PER_MONTH = 4.33;

export default function BudgetCategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors, ghost: themeGhost, ghostCardShadow: themedGhostCardShadow, isLight } = useAppTheme();
  const [items, setItems] = useState<CategoryBudget[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [form, setForm] = useState<CategoryForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [nextItems, nextDashboard] = await Promise.all([getCategoryBudgets(), getDashboard()]);
    setItems(nextItems);
    setDashboard(nextDashboard);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalLimit = useMemo(
    () => items.reduce((sum, item) => sum + item.limitAmount, 0),
    [items],
  );
  const projection = useMemo(
    () => getCategoryProjection(form, items, dashboard),
    [dashboard, form, items],
  );
  const editingItem = form ? items.find((item) => item.categoryId === form.id) : undefined;

  const openNew = () => {
    tapHaptic();
    setForm({
      id: createLocalId(),
      name: '',
      icon: DEFAULT_ICON,
      color: DEFAULT_COLOR,
      limit: '',
      weeklyLimit: '',
    });
  };

  const openEdit = (item: CategoryBudget) => {
    tapHaptic();
    setForm({
      id: item.categoryId,
      name: item.categoryName,
      icon: item.categoryIcon || DEFAULT_ICON,
      color: item.categoryColor || DEFAULT_COLOR,
      limit: String(item.limitAmount || ''),
      weeklyLimit: item.weeklyLimitAmount != null ? String(item.weeklyLimitAmount) : '',
    });
  };

  const save = async () => {
    if (!form) return;
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
  };

  const remove = async () => {
    if (!editingItem || saving) return;

    const confirmDelete = async () => {
      setSaving(true);
      await deleteCategoryBudget(editingItem.categoryId);
      await refreshMonthlyBudgetLimit();
      await load();
      setSaving(false);
      setForm(null);
      successHaptic();
    };

    Alert.alert(
      'Supprimer la catégorie?',
      `${editingItem.categoryName} sera retirée de ton budget. Les anciennes transactions restent conservées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => void confirmDelete() },
      ],
    );
  };

  return (
    <PageTransition>
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
        <Pressable
          onPress={() => {
            tapHaptic();
            router.back();
          }}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={26} color={themeColors.textSecondary} />
        </Pressable>
        <Text style={[styles.topTitle, { color: themeColors.textMuted }]}>Catégories</Text>
        <Pressable
          onPress={openNew}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={26} color={themeColors.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroller}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: FLOATING_NAV_CONTENT_PADDING + Math.max(insets.bottom, 16) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <GlassContainer style={themedGhostCardShadow} borderRadius={radius.xxl} padding={spacing.lg} innerStyle={styles.summaryCardInner}>
          <Text style={[styles.eyebrow, { color: themeColors.textMuted }]}>Budget mensuel total</Text>
          <Text style={[styles.total, { color: themeColors.text }]}>{totalLimit.toFixed(0)} $</Text>
          <Text style={[styles.helper, { color: themeColors.textMuted }]}>
            Crée ou ajuste les postes qui composent ton budget mensuel.
          </Text>
        </GlassContainer>

        <View style={styles.list}>
          {items.map((item) => {
            const usage = getCategoryBudgetUsage(item.limitAmount, item.spent);
            const remaining = usage.isZeroLimitOverspend ? 0 : Math.max(0, usage.limit - usage.spent);
            const tint = normalizeUserIconColor(item.categoryColor) ?? '';
            const barColor = categoryBudgetBarColor(
              usage.usagePercent,
              usage.isZeroLimitOverspend,
              isLight,
              tint,
              themeColors,
            );

            return (
              <Pressable
                key={item.categoryId}
                onPress={() => openEdit(item)}
                style={({ pressed }) => [pressed && styles.pressedCard]}
              >
                <GlassContainer style={themedGhostCardShadow} borderRadius={radius.xxl} padding={spacing.md} innerStyle={styles.cardInner}>
                <UserPickedIconBadge
                  icon={getCategoryIconName(item)}
                  color={tint || null}
                  size={46}
                  iconSize={21}
                />
                <View style={styles.cardBody}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.cardTitle, { color: themeColors.text }]}>{item.categoryName}</Text>
                    <Text style={[styles.limit, { color: themeColors.primary }]}>{item.limitAmount.toFixed(0)} $</Text>
                  </View>
                  {item.weeklyLimitAmount != null ? (
                    <Text style={[styles.weeklyMeta, { color: themeColors.textMuted }]}>
                      {item.weeklyLimitAmount.toFixed(0)} $ / semaine, réinitialisé chaque semaine
                    </Text>
                  ) : null}
                  <ProgressBar progress={usage.progress} color={barColor} />
                  <View style={styles.rowBetween}>
                    {usage.statusLabel ? (
                      <Text style={[styles.meta, { color: barColor, fontWeight: '700' }]}>{usage.statusLabel}</Text>
                    ) : (
                      <Text style={[styles.meta, { color: themeColors.textMuted }]}>{item.spent.toFixed(0)} $ dépensé</Text>
                    )}
                    <Text style={[styles.meta, { color: themeColors.textMuted }]}>
                      {usage.isZeroLimitOverspend ? '0 $ alloué' : `${remaining.toFixed(0)} $ restant`}
                    </Text>
                  </View>
                </View>
                </GlassContainer>
              </Pressable>
            );
          })}

          {items.length === 0 ? (
            <GlassContainer style={themedGhostCardShadow} borderRadius={radius.xxl} padding={spacing.lg} innerStyle={styles.emptyCardInner}>
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Aucune catégorie</Text>
              <Text style={[styles.helper, { color: themeColors.textMuted }]}>Ajoute une première limite pour démarrer ton budget.</Text>
            </GlassContainer>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={form != null} animationType="slide" transparent onRequestClose={() => setForm(null)}>
        <View style={[styles.modalBackdrop, { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0,0,0,0.62)' }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <View style={[styles.modalCard, { backgroundColor: themeColors.surfaceSolid, borderColor: themeColors.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: themeColors.text }]}>{form?.name ? 'Modifier' : 'Nouvelle catégorie'}</Text>
                <Pressable onPress={() => setForm(null)} hitSlop={12}>
                  <Ionicons name="close" size={24} color={themeColors.textMuted} />
                </Pressable>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.modalContent,
                  { paddingBottom: Math.max(insets.bottom, 20) },
                ]}
              >
              <FormField
                  label="Nom"
                  value={form?.name ?? ''}
                  placeholder="Ex. Épicerie"
                  onChangeText={(value) => setForm((cur) => (cur ? { ...cur, name: value } : cur))}
                />
                <FormField
                  label="Limite mensuelle"
                  value={form?.limit ?? ''}
                  placeholder="400"
                  keyboardType="decimal-pad"
                  onChangeText={(value) =>
                    setForm((cur) => (cur ? { ...cur, limit: sanitizeAmount(value) } : cur))
                  }
                />
                <FormField
                  label="Limite hebdomadaire"
                  value={form?.weeklyLimit ?? ''}
                  placeholder="Ex. 90"
                  keyboardType="decimal-pad"
                  helper="Optionnelle. Se réinitialise chaque semaine et doit rester dans la limite mensuelle."
                  onChangeText={(value) =>
                    setForm((cur) => (cur ? { ...cur, weeklyLimit: sanitizeAmount(value) } : cur))
                  }
                />
                <IconPicker
                  selectedIcon={form?.icon ?? DEFAULT_ICON}
                  selectedColor={normalizeColor(form?.color)}
                  onSelect={(icon) => setForm((cur) => (cur ? { ...cur, icon } : cur))}
                />
                <ColorPicker
                  selectedColor={normalizeColor(form?.color)}
                  onSelect={(color) => setForm((cur) => (cur ? { ...cur, color } : cur))}
                />

                {projection ? <CategoryProjectionCard projection={projection} /> : null}

                <PrimarySaveButton
                  label={saving ? 'Enregistrement...' : 'Enregistrer'}
                  onPress={() => void save()}
                  disabled={saving}
                />

                {editingItem ? (
                  <Pressable
                    onPress={() => void remove()}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.deleteBtn,
                      { borderColor: themeColors.danger },
                      pressed && styles.pressed,
                      saving && styles.disabled,
                    ]}
                  >
                    <Ionicons name="trash-outline" size={17} color={themeColors.danger} />
                    <Text style={[styles.deleteText, { color: themeColors.danger }]}>Supprimer la catégorie</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
          </View>
      </Modal>
    </View>
    </PageTransition>
  );
}

function FormField({
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
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
      />
      {helper ? <Text style={[styles.fieldHint, { color: colors.textMuted }]}>{helper}</Text> : null}
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
    <View style={styles.pickerSection}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Icône</Text>
      <View style={styles.iconGrid}>
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
                styles.iconChoice,
                { backgroundColor: resolveUserPickedIconWellBackground(isLight), borderColor: colors.border },
                selected && [styles.iconChoiceSelected, { borderColor: selectedColor }],
                pressed && styles.pressed,
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
    <View style={styles.pickerSection}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Couleur</Text>
      <View style={styles.colorGrid}>
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
                styles.colorChoice,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selected && [styles.colorChoiceSelected, { borderColor: color }],
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.colorSwatch, { backgroundColor: color }]}>
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
    <View style={[styles.projectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.projectionTitle, { color: colors.text }]}>Impact estimé</Text>
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
      <Text style={[styles.projectionHint, { color: colors.textMuted }]}>{projection.hint}</Text>
    </View>
  );
}

function ProjectionRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.projectionRow}>
      <Text style={[styles.projectionLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.projectionValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
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
  screen: { flex: 1, backgroundColor: 'transparent' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: PAGE_TITLE_CONTENT_GAP,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
  topTitle: {
    color: ghost.muted,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 2.7,
    textTransform: 'uppercase',
  },
  scroller: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  summaryCardInner: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: typography.meta,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  total: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  helper: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 20 },
  list: { gap: spacing.md },
  cardInner: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pressedCard: { opacity: 0.82 },
  iconWell: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, minWidth: 0, gap: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cardTitle: { flex: 1, color: colors.text, fontSize: typography.body, fontWeight: '800' },
  limit: { color: colors.primary, fontSize: typography.body, fontWeight: '800' },
  weeklyMeta: { color: colors.textMuted, fontSize: typography.micro, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: typography.micro, fontWeight: '600' },
  emptyCardInner: {
    gap: spacing.sm,
  },
  emptyTitle: { color: colors.text, fontSize: typography.body, fontWeight: '800' },
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
    backgroundColor: ghost.obsidian,
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
    backgroundColor: ghost.obsidianSoft,
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: typography.body,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  fieldHint: { color: colors.textMuted, fontSize: typography.micro, lineHeight: 17 },
  twoCols: { flexDirection: 'row', gap: spacing.md },
  pickerSection: { gap: spacing.sm },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconChoice: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ghost.obsidianSoft,
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
    backgroundColor: ghost.obsidianSoft,
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
    backgroundColor: ghost.obsidianSoft,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  projectionTitle: { color: colors.text, fontSize: typography.body, fontWeight: '800' },
  projectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  projectionLabel: { flex: 1, color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  projectionValue: { color: colors.text, fontSize: typography.caption, fontWeight: '800' },
  projectionHint: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 20 },
  saveBtn: {
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    paddingVertical: 16,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 15,
  },
  disabled: { opacity: 0.45 },
  saveText: { color: '#000000', fontSize: typography.body, fontWeight: '800' },
  deleteText: { fontSize: typography.body, fontWeight: '800' },
});

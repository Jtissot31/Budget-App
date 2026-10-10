import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';

import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';


import { BottomSheet } from '@/components/BottomSheet';

import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';

import { DetailSingleLineRow, type DetailSectionRow } from '@/components/DetailSectionRows';

import { TransactionInsightCard } from '@/components/TransactionInsightCard';

import { EditableField, type EditableFieldHandle } from '@/components/EditableField';

import { OverflowMenuButton } from '@/components/OverflowMenuButton';

import { ProgressBar } from '@/components/ProgressBar';

import { SurfaceCard } from '@/components/SurfaceCard';


import { BudgetCashflowImpactCard } from '@/components/budget/BudgetCashflowImpactCard';

import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { BudgetCategoryInsights } from '@/components/budget/BudgetCategoryInsights';
import { ListCard, RingGauge, SummaryCard } from '@/components/kit';

import { SPACING } from '@/constants/design-tokens';
import {
  accountDetailHeroBlockStyle,
  detailSectionLabelStyle,
  detailSingleLineRowStyle,
  jakartaExtraBoldText,
  jakartaMediumText,
  radius,
  spacing,
  typography,
  typographyKit,
} from '@/constants/theme';

import { deleteCategory, getCategories, updateCategoryLimit, updateCategoryName } from '@/lib/budgetCategories';

import type { BudgetCategoryUiModel } from '@/lib/budgetCategoryModel';

import { getCategoryBudgetInsight } from '@/lib/categoryBudgetInsight';
import {
  categoryBudgetBarTrackColor,
  getBudgetStatus,
  getCategoryBudgetUsage,
  shouldShowCategoryStatusTag,
} from '@/lib/categoryBudgetUsage';

import {
  deleteCategoryBudget,
  upsertCategory,
  upsertCategoryBudget,
} from '@/lib/db';

import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';

import { parseFormattedNumber } from '@/lib/formatNumber';

import { successHaptic, tapHaptic } from '@/lib/haptics';
import {
  getPayEstimationSettings,
  toMonthlyAveragePayAmount,
} from '@/lib/payEstimationSettings';

import {
  detailHeroAmount,
  detailHeroSecondaryAmount,
  detailRowLabelSlot,
  detailRowLabelText,
  detailRowValueMoney,
  nativeTextColumnFlex,
} from '@/lib/textLayout';

import { useAppTheme } from '@/lib/themeContext';


type Props = {
  category: BudgetCategoryUiModel | null;
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
  displayMonth: Date;
  isCurrentMonth?: boolean;
};

const DETAIL_SHEET_TOP_RADIUS = 22;
const TRANSACTIONS_LIST_MAX_HEIGHT = 280;

function pillBackground(barColor: string): string {
  return `${barColor}1F`;
}

function buildBudgetDetailRows(
  limit: number,
  spent: number,
  usage: BudgetCategoryUiModel['usage'],
): DetailSectionRow[] {
  const budgetStatus = getBudgetStatus(spent, limit);
  const barColor = budgetStatus.color;

  const rows: DetailSectionRow[] = [
    {
      label: 'Dépensé',
      value: formatDisplayMoneyAbsolute(spent),
      icon: 'cash-outline',
      valueLayout: 'amount',
    },
  ];

  if (usage.isOverBudget) {
    rows.push({
      label: 'Dépassement',
      value: `Dépassé de ${formatDisplayMoneyAbsolute(Math.max(0, spent - limit))}`,
      icon: 'trending-up-outline',
      valueColor: barColor,
      valueLayout: 'amount',
    });
  }

  if (limit > 0 || usage.isZeroLimitOverspend) {
    rows.push({
      label: 'Utilisation',
      value: `${budgetStatus.percentage} %`,
      icon: 'pie-chart-outline',
      valueColor: barColor,
    });
  }

  return rows;
}

export function BudgetCategoryDetailSheet({
  category,
  visible,
  onClose,
  onSaved,
  displayMonth,
  isCurrentMonth = true,
}: Props) {
  const { colors } = useAppTheme();
  const limitEditRef = useRef<EditableFieldHandle>(null);
  const [localName, setLocalName] = useState('');
  const [localLimit, setLocalLimit] = useState(0);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [otherCategoriesAllocatedTotal, setOtherCategoriesAllocatedTotal] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState<number | null>(null);

  useEffect(() => {
    if (!category) return;
    setLocalName(category.name);
    setLocalLimit(Math.max(0, category.limit));
  }, [category?.id, category?.name, category?.limit, visible]);

  useEffect(() => {
    setConfirmDeleteVisible(false);
    setDeleting(false);
  }, [category?.id, visible, displayMonth]);

  useEffect(() => {
    if (!visible || !category) return;

    let cancelled = false;
    void (async () => {
      try {
        const [categories, paySettings] = await Promise.all([
          getCategories(),
          getPayEstimationSettings(),
        ]);
        if (cancelled) return;
        setOtherCategoriesAllocatedTotal(
          categories.reduce((sum, entry) => {
            if (entry.id === category.id) return sum;
            return sum + Math.max(0, entry.limit);
          }, 0),
        );
        setMonthlyIncome(
          paySettings.averageAmount != null
            ? toMonthlyAveragePayAmount(paySettings.averageAmount, paySettings.frequency)
            : null,
        );
      } catch {
        if (!cancelled) {
          setOtherCategoriesAllocatedTotal(0);
          setMonthlyIncome(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, category?.id]);

  const usage = useMemo(() => {
    if (!category) return null;
    return getCategoryBudgetUsage(localLimit, category.spent);
  }, [category, localLimit]);

  const budgetStatus = useMemo(
    () => (category ? getBudgetStatus(category.spent, localLimit) : null),
    [category, localLimit],
  );

  const budgetDetailRows = useMemo(
    () => (category && usage ? buildBudgetDetailRows(localLimit, category.spent, usage) : []),
    [category, localLimit, usage],
  );

  const insight = useMemo(() => {
    if (!category || !usage) return null;
    return getCategoryBudgetInsight(localName, category.spent, localLimit, usage);
  }, [category, localName, localLimit, usage]);

  const impactCategoryLimit = localLimit > 0 ? localLimit : null;

  const barColor = budgetStatus?.color ?? colors.accentGreen;
  const barTrackColor = category
    ? categoryBudgetBarTrackColor(category.spent, localLimit)
    : undefined;
  const showStatusTag = usage ? shouldShowCategoryStatusTag(usage) : false;
  const statusText = budgetStatus?.label ?? '';
  const handleSaveName = useCallback(
    async (newName: string) => {
      if (!category) return;
      const trimmed = newName.trim();
      const previous = localName;
      setLocalName(trimmed);
      try {
        await Promise.all([
          upsertCategory({
            id: category.id,
            name: trimmed,
            icon: category.icon,
            color: category.color,
          }),
          updateCategoryName(category.id, trimmed),
        ]);
        successHaptic();
        onSaved?.();
      } catch {
        setLocalName(previous);
        throw new Error('save failed');
      }
    },
    [category, localName, onSaved],
  );

  const handleSaveLimit = useCallback(
    async (raw: string) => {
      if (!category) return;
      const parsed = parseFormattedNumber(raw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error('invalid');
      }
      const previous = localLimit;
      setLocalLimit(parsed);
      try {
        await Promise.all([
          upsertCategoryBudget(category.id, parsed),
          updateCategoryLimit(category.id, parsed),
        ]);
        successHaptic();
        onSaved?.();
      } catch {
        setLocalLimit(previous);
        throw new Error('save failed');
      }
    },
    [category, localLimit, onSaved],
  );

  const handlePressEdit = useCallback(() => {
    tapHaptic();
    limitEditRef.current?.startEditing();
  }, []);

  const handlePressDelete = useCallback(() => {
    tapHaptic();
    setConfirmDeleteVisible(true);
  }, []);

  /**
   * Removes this category from the monthly budget list (AsyncStorage + category_budgets).
   * Does not delete transactions — spend history stays tagged; taxonomy row is kept if still referenced.
   */
  const handleConfirmDelete = useCallback(async () => {
    if (!category || deleting) return;
    setConfirmDeleteVisible(false);
    setDeleting(true);
    try {
      await Promise.all([deleteCategoryBudget(category.id), deleteCategory(category.id)]);
      successHaptic();
      onSaved?.();
      onClose();
    } catch {
      setDeleting(false);
    }
  }, [category, deleting, onClose, onSaved]);

  if (!category) return null;

  return (
    <>
    <BottomSheet
      visible={visible}
      onClose={onClose}
      sheetStyle={[styles.sheet, { backgroundColor: colors.background }]}
      scrollContentContainerStyle={styles.scrollContent}
      header={
        <View style={styles.header}>
          <BudgetCategoryIcon icon={category.icon} name={localName} id={category.id} />

          <View style={styles.headerText}>
            <EditableField
              type="text"
              value={localName}
              onSave={handleSaveName}
              accessibilityLabel="Modifier le nom de la catégorie"
              textStyle={styles.heroLabel}
              containerStyle={styles.heroLabelField}
              placeholder="Nom de catégorie"
            />
          </View>

          <View style={styles.headerActions}>
            <OverflowMenuButton
              accessibilityLabel="Options de la catégorie"
              items={[
                {
                  key: 'edit',
                  label: 'Modifier',
                  onPress: handlePressEdit,
                },
                {
                  key: 'delete',
                  label: 'Supprimer',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: handlePressDelete,
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer les détails"
              hitSlop={10}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                {
                  backgroundColor: colors.surfaceSolid,
                  borderColor: colors.borderStrong,
                },
                pressed && styles.pressed,
              ]}
            >
              <AppIcon family="ionicons" name="close" size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>
      }
    >
      {(() => {
        const left = localLimit - category.spent;
        const over = left < 0;
        const ratio = localLimit > 0 ? category.spent / localLimit : over ? 1 : 0;
        const now = new Date();
        const daysLeft = isCurrentMonth
          ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1
          : 0;
        return (
          <SummaryCard
            label={over ? 'Au-dessus du budget' : 'Il te reste'}
            amount={`${over ? '−' : ''}${formatDisplayMoneyAbsolute(Math.abs(left))}`}
            amountValue={left}
            formatAmount={(value) => `${value < 0 ? '−' : ''}${formatDisplayMoneyAbsolute(Math.abs(value))}`}
            amountColor={over ? colors.danger : colors.text}
            badge={showStatusTag && statusText ? { label: statusText, color: over ? colors.danger : colors.textMuted } : undefined}
            aside={
              <RingGauge progress={ratio} color={over ? colors.danger : colors.text} size={72} stroke={7}>
                <Text style={[styles.ringPct, { color: colors.text }]}>{Math.round(ratio * 100)}%</Text>
              </RingGauge>
            }
            stats={[
              { label: 'Dépensé', value: formatDisplayMoneyAbsolute(category.spent) },
              isCurrentMonth && !over && daysLeft > 0
                ? { label: 'Par jour', value: formatDisplayMoneyAbsolute(left / daysLeft) }
                : { label: 'Jours', value: isCurrentMonth ? String(daysLeft) : '—' },
            ]}
          >
            <View style={styles.limitInline}>
              <Text style={[styles.limitLabel, { color: colors.textMuted }]} numberOfLines={1}>Limite mensuelle</Text>
              <EditableField
                editHandleRef={limitEditRef}
                type="money"
                value={String(localLimit)}
                onSave={handleSaveLimit}
                accessibilityLabel="Modifier la limite mensuelle"
                textStyle={[styles.rowValue, detailRowValueMoney]}
                containerStyle={styles.limitValueField}
                align="right"
              />
            </View>
          </SummaryCard>
        );
      })()}

      {insight ? <TransactionInsightCard insight={insight} /> : null}


      <BudgetCashflowImpactCard
        mode="edit"
        categoryLimit={impactCategoryLimit}
        otherCategoriesAllocatedTotal={otherCategoriesAllocatedTotal}
        monthlyIncome={monthlyIncome}
      />

      <BudgetCategoryInsights
        categoryId={category.id}
        categoryName={localName || category.name}
        displayMonth={displayMonth}
        isCurrentMonth={isCurrentMonth}
        limit={localLimit}
        spent={category.spent}
      />
    </BottomSheet>

    <ConfirmDeleteModal
      visible={confirmDeleteVisible}
      title="Supprimer cette catégorie ?"
      message={`Retirer « ${localName || category.name} » du budget ? Les transactions existantes restent dans l'historique.`}
      onConfirm={() => void handleConfirmDelete()}
      onCancel={() => setConfirmDeleteVisible(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  ringPct: { ...jakartaMediumText, fontSize: 15, fontWeight: "normal" },
  // Fixed height + clip: some EditableField internals stretch vertically on Android.
  limitInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    height: 44,
    overflow: 'hidden',
  },
  limitLabel: { ...jakartaMediumText, fontSize: 14, flexShrink: 1 },
  sheet: {
    borderTopLeftRadius: DETAIL_SHEET_TOP_RADIUS,
    borderTopRightRadius: DETAIL_SHEET_TOP_RADIUS,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerText: Platform.OS === 'web' ? { flex: 1, minWidth: 0 } : nativeTextColumnFlex,
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  heroLabelField: {
    alignSelf: 'stretch',
  },
  heroLabel: {
    ...jakartaExtraBoldText,
    fontSize: typography.dashboardGreeting,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  heroBlock: {
    alignItems: 'center',
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 2, // keep — amount row density
  },
  heroSpent: {
    textAlign: 'center',
  },
  statusPill: {
    alignSelf: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: 10, // keep — no 10px SPACING token
    paddingVertical: SPACING.xs,
  },
  statusPillText: {
    fontSize: 11, // keep — between tag(10) and micro(12)
    lineHeight: 14,
  },
  budgetCard: {
    gap: spacing.sm,
  },
  budgetEyebrow: {
    marginBottom: spacing.xs,
  },
  budgetRows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.xs,
  },
  rowIcon: {
    width: 18,
    marginTop: 1,
  },
  rowLabel: {
    marginRight: spacing.sm,
  },
  rowValue: {
    flexShrink: 0,
    textAlign: 'right',
  },
  limitValueField: {
    flexShrink: 0,
    maxWidth: '50%',
    alignItems: 'flex-end',
  },
  transactionsSection: {
    gap: 0,
  },
  ctaRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaRowInner: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    width: '100%',
    gap: spacing.md,
  },
  ctaRowExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  ctaIconWell: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    ...(Platform.OS === 'web' ? { flex: 1 } : nativeTextColumnFlex),
    ...typographyKit.caption,
  },
  ctaChevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  transactionsPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    overflow: 'hidden',
  },
  transactionsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  transactionsLoadingText: {
    ...typographyKit.caption,
  },
  transactionsEmpty: {
    ...typographyKit.caption,
    textAlign: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  transactionsScroll: {
    maxHeight: TRANSACTIONS_LIST_MAX_HEIGHT,
  },
  transactionsList: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  pressed: {
    opacity: 0.78,
  },
});

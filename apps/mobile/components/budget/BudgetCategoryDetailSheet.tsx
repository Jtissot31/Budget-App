import { useCallback, useEffect, useMemo, useState } from 'react';

import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { BottomSheet } from '@/components/BottomSheet';

import { DetailSingleLineRow, type DetailSectionRow } from '@/components/DetailSectionRows';

import { TransactionInsightCard } from '@/components/TransactionInsightCard';

import { EditableField } from '@/components/EditableField';

import { ProgressBar } from '@/components/ProgressBar';

import { SurfaceCard } from '@/components/SurfaceCard';

import { TransactionRow } from '@/components/TransactionRow';

import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';

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

import { updateCategoryLimit, updateCategoryName } from '@/lib/budgetCategories';

import type { BudgetCategoryUiModel } from '@/lib/budgetCategoryModel';

import { formatBudgetMonthLabel } from '@/lib/budgetMonth';

import { getCategoryBudgetInsight } from '@/lib/categoryBudgetInsight';
import {
  categoryBudgetBarTrackColor,
  getBudgetStatus,
  getCategoryBudgetUsage,
  shouldShowCategoryStatusTag,
} from '@/lib/categoryBudgetUsage';

import {
  getTransactionsForBudgetCategoryInMonth,
  sortTransactionsNewestFirst,
  upsertCategory,
  upsertCategoryBudget,
} from '@/lib/db';

import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';

import { parseFormattedNumber } from '@/lib/formatNumber';

import { successHaptic, tapHaptic } from '@/lib/haptics';
import { openTransactionDetail } from '@/lib/openTransactionDetail';

import {
  detailHeroAmount,
  detailHeroSecondaryAmount,
  detailRowLabelSlot,
  detailRowLabelText,
  detailRowValueMoney,
} from '@/lib/textLayout';

import { useAppTheme } from '@/lib/themeContext';

import type { Transaction } from '@/types';

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
  const { colors, isLight } = useAppTheme();
  const [localName, setLocalName] = useState('');
  const [localLimit, setLocalLimit] = useState(0);
  const [transactionsExpanded, setTransactionsExpanded] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  useEffect(() => {
    if (!category) return;
    setLocalName(category.name);
    setLocalLimit(Math.max(0, category.limit));
  }, [category?.id, category?.name, category?.limit, visible]);

  useEffect(() => {
    setTransactionsExpanded(false);
    setTransactions([]);
    setTransactionsLoading(false);
  }, [category?.id, visible, displayMonth]);

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

  const openTransactions = useCallback(() => {
    tapHaptic();
    setTransactionsExpanded((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!transactionsExpanded || !category) return;

    let cancelled = false;
    setTransactionsLoading(true);

    void getTransactionsForBudgetCategoryInMonth(category.id, displayMonth)
      .then((rows) => {
        if (!cancelled) {
          setTransactions(sortTransactionsNewestFirst(rows));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTransactionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [transactionsExpanded, category?.id, displayMonth]);

  const emptyTransactionsLabel = useMemo(
    () =>
      isCurrentMonth
        ? 'Aucune transaction ce mois-ci'
        : `Aucune transaction en ${formatBudgetMonthLabel(displayMonth).toLowerCase()}`,
    [displayMonth, isCurrentMonth],
  );

  const handlePressTransaction = useCallback(
    (transactionId: string) => {
      tapHaptic();
      openTransactionDetail(transactionId);
    },
    [],
  );

  if (!category) return null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      sheetStyle={styles.sheet}
      scrollContentContainerStyle={styles.scrollContent}
    >
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
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={[accountDetailHeroBlockStyle(), styles.heroBlock]}>
        <View style={styles.heroAmountRow}>
          <Text style={[detailHeroAmount, styles.heroSpent, { color: colors.text }]}>
            {formatDisplayMoneyAbsolute(category.spent)}
          </Text>
          <Text style={[detailHeroSecondaryAmount, { color: colors.textMuted }]}>
            {' / '}
            {formatDisplayMoneyAbsolute(localLimit)}
          </Text>
        </View>

        {showStatusTag ? (
          <View style={[styles.statusPill, { backgroundColor: pillBackground(barColor) }]}>
            <Text style={[styles.statusPillText, jakartaMediumText, { color: barColor }]} numberOfLines={1}>
              {statusText}
            </Text>
          </View>
        ) : null}
      </View>

      {insight ? <TransactionInsightCard insight={insight} /> : null}

      {usage ? (
        <SurfaceCard style={styles.budgetCard} padding={spacing.lg}>
          <Text style={[detailSectionLabelStyle(), styles.budgetEyebrow, { color: colors.textMuted }]}>
            BUDGET
          </Text>
          <ProgressBar
            progress={usage.progress}
            color={barColor}
            height={6}
            trackColor={barTrackColor}
          />
          <View style={[styles.budgetRows, { borderTopColor: colors.border }]}>
            <View
              style={[
                detailSingleLineRowStyle(),
                budgetDetailRows.length > 0 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Ionicons name="wallet-outline" size={17} color={colors.textMuted} style={styles.rowIcon} />
              <View style={detailRowLabelSlot}>
                <Text style={[styles.rowLabel, detailRowLabelText, { color: colors.textMuted }]}>
                  Limite mensuelle
                </Text>
              </View>
              <EditableField
                type="money"
                value={String(localLimit)}
                onSave={handleSaveLimit}
                accessibilityLabel="Modifier la limite mensuelle"
                textStyle={[styles.rowValue, detailRowValueMoney]}
                containerStyle={styles.limitValueField}
                align="right"
              />
            </View>

            {budgetDetailRows.map((row, rowIndex) => (
              <DetailSingleLineRow
                key={row.label}
                row={row}
                colors={colors}
                isLast={rowIndex === budgetDetailRows.length - 1}
              />
            ))}
          </View>
        </SurfaceCard>
      ) : null}

      <View style={styles.transactionsSection}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: transactionsExpanded }}
          accessibilityLabel="Voir les transactions"
          onPress={openTransactions}
          style={({ pressed }) => [
            styles.ctaRow,
            transactionsExpanded && styles.ctaRowExpanded,
            {
              backgroundColor: isLight ? colors.surfaceElevated : colors.input,
              borderColor: colors.border,
            },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.ctaIconWell, { backgroundColor: colors.surfaceSolid }]}>
            <Ionicons name="list-outline" size={18} color={colors.text} />
          </View>
          <Text style={[styles.ctaLabel, { color: colors.text }]}>Voir les transactions</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textMuted}
            style={transactionsExpanded ? styles.ctaChevronExpanded : undefined}
          />
        </Pressable>

        {transactionsExpanded ? (
          <View
            style={[
              styles.transactionsPanel,
              {
                backgroundColor: isLight ? colors.surfaceElevated : colors.input,
                borderColor: colors.border,
              },
            ]}
          >
            {transactionsLoading ? (
              <View style={styles.transactionsLoading}>
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text style={[styles.transactionsLoadingText, { color: colors.textMuted }]}>
                  Chargement...
                </Text>
              </View>
            ) : transactions.length === 0 ? (
              <Text style={[styles.transactionsEmpty, { color: colors.textMuted }]}>
                {emptyTransactionsLabel}
              </Text>
            ) : (
              <ScrollView
                style={styles.transactionsScroll}
                contentContainerStyle={styles.transactionsList}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {transactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    transaction={tx}
                    embedded
                    onPressId={handlePressTransaction}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: spacing.xs,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
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
    gap: 2,
  },
  heroSpent: {
    textAlign: 'center',
  },
  statusPill: {
    alignSelf: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 11,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
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
    flex: 1,
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

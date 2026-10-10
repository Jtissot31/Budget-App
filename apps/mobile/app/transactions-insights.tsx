import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardCard } from '@/components/DashboardCard';
import {
  FixedScreenHeader,
  fixedHeaderScrollStyle,
  fixedHeaderScreenStyle,
} from '@/components/FixedScreenHeader';
import { MonthSelector } from '@/components/MonthSelector';
import { PageTransition } from '@/components/PageTransition';
import { EmptyRow, IconWell, ListCard, ListRow, SectionLabel } from '@/components/kit';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TransactionRow } from '@/components/TransactionRow';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { CumulativeSpendStepChart } from '@/components/transactions/CumulativeSpendStepChart';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { ONYX_CONTAINER } from '@/constants/planFinanceKit';
import {
  FLOATING_NAV_CONTENT_PADDING,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_STYLE,
  PORTFOLIO_SECTION_GAP,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { useContactPhotoMap } from '@/hooks/useContactPhotoMap';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
import { useTransactionReviewQueue } from '@/hooks/useTransactionReviewQueue';
import {
  buildSpendTrendBundle,
  isSpendTrendAnchorAfter,
  isSpendTrendAnchorBefore,
  shiftSpendTrendAnchor,
  snapSpendTrendAnchor,
  spendTrendNavigatorLabels,
  spendTrendPriorPeriodLabel,
  spendTrendScrubLabel,
  type SpendTrendGranularity,
} from '@/lib/buildMonthSpendSeries';
import {
  getDashboard,
  getEarliestExpenseMonthStart,
  getSimulatedAccounts,
  getTransactions,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { openTransactionDetail } from '@/lib/openTransactionDetail';
import { ensureDbReady } from '@/lib/init';
import {
  getTransactionValidationIssues,
  REVIEW_TRANSACTION_WINDOW,
  validationIssueLabel,
} from '@/lib/transactionInsights';
import { useAppTheme } from '@/lib/themeContext';
import type { SimulatedAccount, Transaction } from '@/types';

const SPEND_TREND_TABS: { id: SpendTrendGranularity; label: string }[] = [
  { id: 'week', label: '1S' },
  { id: 'month', label: '1M' },
  { id: 'year', label: '1A' },
];

function currentPeriodAnchor(granularity: SpendTrendGranularity): Date {
  return snapSpendTrendAnchor(new Date(), granularity);
}

function shouldOpenValidation(validate?: string | string[]) {
  const value = Array.isArray(validate) ? validate[0] : validate;
  return value === '1' || value === 'true';
}

function formatReviewScopeLine(count: number): string {
  const noun = count > 1 ? 'transactions' : 'transaction';
  return `${count} ${noun} · ${REVIEW_TRANSACTION_WINDOW} dernières dépenses`;
}

function periodNavA11y(granularity: SpendTrendGranularity, direction: 'prev' | 'next'): string {
  if (granularity === 'week') {
    return direction === 'prev' ? 'Semaine précédente' : 'Semaine suivante';
  }
  if (granularity === 'year') {
    return direction === 'prev' ? 'Année précédente' : 'Année suivante';
  }
  return direction === 'prev' ? 'Mois précédent' : 'Mois suivant';
}

export default function TransactionsInsightsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ validate?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const savingsGoals = useSavingsGoals();
  const contactPhotoByKey = useContactPhotoMap();
  const openValidationOnFocus = shouldOpenValidation(params.validate);
  const isReviewMode = openValidationOnFocus;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);
  const [monthlyBudgetLimit, setMonthlyBudgetLimit] = useState(0);
  const [granularity, setGranularity] = useState<SpendTrendGranularity>('month');
  const [displayAnchor, setDisplayAnchor] = useState(() => currentPeriodAnchor('month'));
  const [pendingAnchor, setPendingAnchor] = useState(() => currentPeriodAnchor('month'));
  const [earliestMonth, setEarliestMonth] = useState(() => currentPeriodAnchor('month'));
  const reviewSeenMarkedRef = useRef(false);

  const latestAnchor = currentPeriodAnchor(granularity);
  const earliestAnchor = snapSpendTrendAnchor(earliestMonth, granularity);

  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const needsReloadRef = useRef(false);

  const load = useCallback(async () => {
    if (loadInFlightRef.current) {
      needsReloadRef.current = true;
      return loadInFlightRef.current;
    }

    const run = (async () => {
      do {
        needsReloadRef.current = false;
        await ensureDbReady();
        const [txs, simulatedAccounts, dashboard] = await Promise.all([
          getTransactions(),
          getSimulatedAccounts(),
          getDashboard(),
        ]);
        setTransactions(txs);
        setAccounts(simulatedAccounts);
        setMonthlyBudgetLimit(dashboard.monthlyBudgetLimit ?? 0);
      } while (needsReloadRef.current);
    })();

    loadInFlightRef.current = run;
    try {
      await run;
    } finally {
      if (loadInFlightRef.current === run) {
        loadInFlightRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const earliest = await getEarliestExpenseMonthStart();
      setEarliestMonth(earliest);
    })();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRefreshOnFocus(load, { skipInitial: true });
  useEffect(() => dataEvents.subscribe(load), [load]);

  const { summary: spendSummary, comparisonSeries: priorSpendSeries } = useMemo(
    () => buildSpendTrendBundle(transactions, granularity, displayAnchor),
    [displayAnchor, granularity, transactions],
  );

  const {
    series: spendSeries,
    activeIndex: spendActiveIndex,
    total: spendPeriodTotal,
  } = spendSummary;

  const navLabels = useMemo(
    () => spendTrendNavigatorLabels(granularity, displayAnchor),
    [displayAnchor, granularity],
  );

  const getScrubLabel = useCallback(
    (index: number) => spendTrendScrubLabel(granularity, index, displayAnchor),
    [displayAnchor, granularity],
  );

  const {
    pendingReview,
    markAllPendingSeen,
    markSeen,
    ignoreTransaction,
  } = useTransactionReviewQueue(transactions);

  const pendingValidation = isReviewMode ? pendingReview : [];

  useFocusEffect(
    useCallback(() => {
      reviewSeenMarkedRef.current = false;
      const anchor = currentPeriodAnchor(granularity);
      setDisplayAnchor(anchor);
      setPendingAnchor(anchor);
      return () => {
        reviewSeenMarkedRef.current = false;
      };
    }, [granularity]),
  );

  useEffect(() => {
    if (!openValidationOnFocus || pendingReview.length === 0 || reviewSeenMarkedRef.current) return;
    reviewSeenMarkedRef.current = true;
    void markAllPendingSeen();
  }, [markAllPendingSeen, openValidationOnFocus, pendingReview.length]);

  const showValidationList = isReviewMode;

  const budgetAnchor = snapSpendTrendAnchor(pendingAnchor, granularity);
  const canGoPrevious = isSpendTrendAnchorAfter(budgetAnchor, earliestAnchor, granularity);
  const canGoNext = isSpendTrendAnchorBefore(budgetAnchor, latestAnchor, granularity);

  const navigateToAnchor = useCallback(
    (next: Date) => {
      const snapped = snapSpendTrendAnchor(next, granularity);
      setPendingAnchor(snapped);
      setDisplayAnchor(snapped);
    },
    [granularity],
  );

  const goPrevious = useCallback(() => {
    navigateToAnchor(shiftSpendTrendAnchor(budgetAnchor, granularity, -1));
  }, [budgetAnchor, granularity, navigateToAnchor]);

  const goNext = useCallback(() => {
    navigateToAnchor(shiftSpendTrendAnchor(budgetAnchor, granularity, 1));
  }, [budgetAnchor, granularity, navigateToAnchor]);

  const handleGranularityChange = useCallback(
    (next: SpendTrendGranularity) => {
      if (next === granularity) return;
      tapHaptic();
      setGranularity(next);
      const anchor = currentPeriodAnchor(next);
      setPendingAnchor(anchor);
      setDisplayAnchor(anchor);
    },
    [granularity],
  );

  const handleEnterInfo = useCallback(
    (transactionId: string) => {
      tapHaptic();
      void markSeen([transactionId]);
      openTransactionDetail(transactionId);
    },
    [markSeen],
  );

  const handleIgnore = useCallback(
    (transactionId: string) => {
      tapHaptic();
      void ignoreTransaction(transactionId);
    },
    [ignoreTransaction],
  );

  const actionTiles = useMemo(
    () =>
      [
        {
          key: 'analyze-subscriptions',
          label: 'Abonnements',
          subtitle: 'Ce que tu paies chaque mois',
          icon: 'repeat-outline',
          accessibilityLabel: 'Analyser mes abonnements',
          onPress: () => router.push('/subscriptions-insights'),
        },
        {
          key: 'categories',
          label: 'Budget par catégorie',
          subtitle: 'Limites et dépassements du mois',
          icon: 'pie-chart-outline',
          accessibilityLabel: 'Voir le budget par catégorie',
          onPress: () => router.push('/budgets'),
        },
      ] as const,
    [router],
  );

  /** Expense totals per category for the displayed period (week / month / year). */
  const categoryBreakdown = useMemo(() => {
    const start = snapSpendTrendAnchor(displayAnchor, granularity);
    const end = shiftSpendTrendAnchor(start, granularity, 1);
    const byKey = new Map<
      string,
      { key: string; name: string; icon: string; color?: string; total: number; count: number }
    >();
    let grand = 0;
    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;
      const when = new Date(tx.date);
      if (when < start || when >= end) continue;
      const amount = Math.abs(tx.amount);
      const key = tx.categoryId || tx.categoryName || 'autre';
      const entry = byKey.get(key) ?? {
        key,
        name: tx.categoryName?.trim() || 'Autre',
        icon: tx.categoryIcon || 'pricetag-outline',
        color: tx.categoryColor,
        total: 0,
        count: 0,
      };
      entry.total += amount;
      entry.count += 1;
      byKey.set(key, entry);
      grand += amount;
    }
    const rows = [...byKey.values()]
      .sort((a, b) => b.total - a.total)
      .map((row) => ({ ...row, share: grand > 0 ? row.total / grand : 0 }));
    return { rows, grand };
  }, [displayAnchor, granularity, transactions]);

  const fixedPageHeader = isReviewMode ? (
    <View
      style={[
        styles.reviewPageHeader,
        { paddingTop: insets.top + SCREEN_TOP_GUTTER },
      ]}
    >
      <View style={styles.reviewTitleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={12}
          onPress={() => {
            tapHaptic();
            router.back();
          }}
          style={({ pressed }) => [styles.reviewBackHit, pressed && styles.pressed]}
        >
          <AppIcon family="ionicons" name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.reviewPageTitle, { color: colors.text }]} numberOfLines={1}>
          À compléter
        </Text>
      </View>
      <Text style={[typographyKit.caption, styles.reviewScope, { color: colors.textMuted }]}>
        {pendingValidation.length > 0
          ? formatReviewScopeLine(pendingValidation.length)
          : 'Toutes vos dépenses récentes sont complètes.'}
      </Text>
    </View>
  ) : (
    <FixedScreenHeader title="Analyse des dépenses" onBack={() => router.back()} />
  );

  const listHeader = isReviewMode ? null : (
    <View>
      <View style={styles.monthSection}>
        <MonthSelector
          appearance="compact"
          month={budgetAnchor}
          onPrevious={goPrevious}
          onNext={goNext}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          primaryLabel={navLabels.primary}
          secondaryLabel={navLabels.secondary}
          periodAccessibilityLabel={navLabels.a11y}
          previousAccessibilityLabel={periodNavA11y(granularity, 'prev')}
          nextAccessibilityLabel={periodNavA11y(granularity, 'next')}
        />
      </View>
      <View style={styles.chartCardSection}>
        <ListCard style={styles.chartCard}>
          <CumulativeSpendStepChart
            series={spendSeries}
            comparisonSeries={priorSpendSeries}
            periodTotal={spendPeriodTotal}
            activeIndex={spendActiveIndex}
            budgetLimit={
              granularity === 'month' && monthlyBudgetLimit > 0
                ? monthlyBudgetLimit
                : undefined
            }
            granularity={granularity}
            getScrubLabel={getScrubLabel}
            priorPeriodPhrase={spendTrendPriorPeriodLabel(granularity)}
          />
          <SegmentedTabs
            tabs={SPEND_TREND_TABS}
            active={granularity}
            onChange={handleGranularityChange}
            size="section"
            variant="bare"
            showDivider={false}
          />
        </ListCard>
      </View>
      <View style={styles.actionSection}>
        <SectionLabel
          title={`Par catégorie · ${navLabels.primary}`}
          actionLabel="Budget"
          onAction={() => router.push('/budgets')}
        />
        <ListCard>
          {categoryBreakdown.rows.length === 0 ? (
            <EmptyRow label="Aucune dépense sur cette période" />
          ) : (
            categoryBreakdown.rows.map((row, index) => (
              <ListRow
                key={row.key}
                leading={
                  <UserPickedIconWell
                    icon={row.icon}
                    color={row.color}
                    size={40}
                  />
                }
                title={row.name}
                subtitle={`${row.count} transaction${row.count > 1 ? 's' : ''}`}
                value={`−${formatDisplayMoneyAbsolute(row.total)}`}
                valueSub={`${Math.round(row.share * 100)} %`}
                progress={row.share}
                progressColor={colors.primary}
                isLast={index === categoryBreakdown.rows.length - 1}
              />
            ))
          )}
        </ListCard>
      </View>
      <View style={styles.actionSection}>
        <SectionLabel title="Aller plus loin" />
        <ListCard>
          {actionTiles.map((tile, index) => (
            <ListRow
              key={tile.key}
              leading={<IconWell icon={tile.icon} />}
              title={tile.label}
              subtitle={tile.subtitle}
              chevron
              isLast={index === actionTiles.length - 1}
              accessibilityLabel={tile.accessibilityLabel}
              onPress={tile.onPress}
            />
          ))}
        </ListCard>
      </View>
    </View>
  );

  const listEmpty = showValidationList ? (
    <DashboardCard
      padding={spacing.lg}
      innerStyle={[styles.emptyCard, styles.emptyCardReview]}
    >
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
        <AppIcon family="ionicons"
          name="checkmark-done-outline"
          size={22}
          color={colors.accentGreen}
        />
      </View>
      <Text style={[styles.emptyTitle, typographyKit.bodyBold, { color: colors.text }]}>
        Tout est à jour
      </Text>
      <Text style={[styles.emptyHint, typographyKit.caption, { color: colors.textMuted }]}>
        {`Les ${REVIEW_TRANSACTION_WINDOW} dernières dépenses ont une catégorie et une description.`}
      </Text>
    </DashboardCard>
  ) : null;

  return (
    <PageTransition>
      <View style={[fixedHeaderScreenStyle, styles.screen, { backgroundColor: colors.background }]}>
        {!isReviewMode ? (
          <LinearGradient
            colors={
              isLight
                ? ['rgba(0,168,84,0.06)', 'transparent']
                : ['rgba(0,230,100,0.055)', 'transparent']
            }
            style={styles.ambientGlow}
            pointerEvents="none"
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        ) : null}

        {fixedPageHeader}

        <FlatList
          style={fixedHeaderScrollStyle}
          data={showValidationList ? pendingValidation : []}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={{
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl,
            ...(isReviewMode && showValidationList
              ? { paddingHorizontal: PAGE_PADDING_HORIZONTAL, paddingTop: spacing.md }
              : null),
          }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View style={isReviewMode ? styles.reviewRowGap : styles.rowGap} />
          )}
          renderItem={({ item }) => {
            const issues = getTransactionValidationIssues(item).filter(
              (issue) => issue !== 'article_category',
            );

            return (
              <View style={styles.validationRowWrap}>
                <TransactionRow
                  transaction={item}
                  accounts={accounts}
                  savingsGoals={savingsGoals}
                  contactPhotoByKey={contactPhotoByKey}
                  onPressId={handleEnterInfo}
                />
                {issues.length > 0 ? (
                  <View style={styles.issueChips}>
                    {issues.map((issue) => (
                      <View
                        key={issue}
                        style={[
                          styles.issueChip,
                          {
                            backgroundColor: colors.surfaceElevated,
                            borderColor: colors.containerBorder,
                          },
                        ]}
                      >
                        <Text style={[typographyKit.caption, { color: colors.textMuted }]}>
                          {validationIssueLabel(issue, item)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={styles.reviewActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ignorer cette transaction"
                    onPress={() => handleIgnore(item.id)}
                    style={({ pressed }) => [styles.reviewActionHit, pressed && styles.pressed]}
                  >
                    <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>
                      Ignorer
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Entrer les infos manquantes"
                    onPress={() => handleEnterInfo(item.id)}
                    style={({ pressed }) => [styles.reviewActionHit, pressed && styles.pressed]}
                  >
                    <Text style={[typographyKit.captionSemibold, { color: colors.text }]}>
                      Entrer les infos
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  ambientGlow: {
    position: 'absolute',
    top: -100,
    alignSelf: 'center',
    width: 420,
    height: 260,
    zIndex: 0,
  },
  reviewPageHeader: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginBottom: spacing.lg,
  },
  reviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  reviewBackHit: {
    padding: 4,
    marginLeft: -4,
  },
  reviewPageTitle: {
    ...PAGE_TITLE_STYLE,
    flex: 1,
    minWidth: 0,
  },
  reviewScope: {
    lineHeight: 18,
  },
  monthSection: {
    marginTop: spacing.sm,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    zIndex: 1,
  },
  chartCardSection: {
    marginTop: spacing.md,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  chartCard: {
    padding: ONYX_CONTAINER.padding.card,
    gap: spacing.md,
  },
  actionSection: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginTop: PORTFOLIO_SECTION_GAP,
    marginBottom: PORTFOLIO_SECTION_GAP,
  },
  rowGap: {
    height: spacing.md,
  },
  reviewRowGap: {
    height: spacing.lg,
  },
  validationRowWrap: {
    gap: spacing.xs,
  },
  validationRowInset: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  issueChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  issueChip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  reviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    paddingTop: spacing.xs,
    paddingRight: spacing.xs,
  },
  reviewActionHit: {
    paddingVertical: spacing.xs,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: PAGE_PADDING_HORIZONTAL,
    marginTop: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  emptyCardReview: {
    marginHorizontal: 0,
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
  pressed: {
    opacity: 0.78,
  },
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { ExpenseCategoryDonut } from '@/components/ExpenseCategoryDonut';
import { MonthSelector } from '@/components/MonthSelector';
import { PageTransition } from '@/components/PageTransition';
import { TransactionRow } from '@/components/TransactionRow';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  FLOATING_NAV_CONTENT_PADDING,
  jakartaExtraBoldText,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_STYLE,
  PORTFOLIO_SECTION_GAP,
  radius,
  spacing,
  typography,
  typographyKit,
} from '@/constants/theme';
import { UNIFORM_ACTION_BUTTON_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import { useContactPhotoMap } from '@/hooks/useContactPhotoMap';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
import { useTransactionReviewQueue } from '@/hooks/useTransactionReviewQueue';
import {
  formatBudgetMonthEyebrow,
  isCurrentMonth,
  isMonthAfter,
  isMonthBefore,
  startOfMonth,
} from '@/lib/budgetMonth';
import {
  getEarliestExpenseMonthStart,
  getSimulatedAccounts,
  getTransactions,
  sortTransactionsNewestFirst,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { openTransactionDetail } from '@/lib/openTransactionDetail';
import { ensureDbReady } from '@/lib/init';
import {
  aggregateExpenseCategories,
  getTransactionValidationIssues,
  listTransactionsNeedingValidation,
  REVIEW_TRANSACTION_WINDOW,
  validationIssueLabel,
} from '@/lib/transactionInsights';
import { useAppTheme } from '@/lib/themeContext';
import type { SimulatedAccount, Transaction } from '@/types';

function currentMonthStart(): Date {
  return startOfMonth(new Date());
}

function shouldOpenValidation(validate?: string | string[]) {
  const value = Array.isArray(validate) ? validate[0] : validate;
  return value === '1' || value === 'true';
}

function formatReviewScopeLine(count: number): string {
  const noun = count > 1 ? 'transactions' : 'transaction';
  return `${count} ${noun} · ${REVIEW_TRANSACTION_WINDOW} dernières dépenses`;
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
  const [displayMonth, setDisplayMonth] = useState(currentMonthStart);
  const [pendingMonth, setPendingMonth] = useState(currentMonthStart);
  const [earliestMonth, setEarliestMonth] = useState(currentMonthStart);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [validationVisible, setValidationVisible] = useState(openValidationOnFocus);
  const reviewSeenMarkedRef = useRef(false);

  const latestMonth = currentMonthStart();

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
        const [txs, simulatedAccounts] = await Promise.all([
          getTransactions(),
          getSimulatedAccounts(),
        ]);
        setTransactions(txs);
        setAccounts(simulatedAccounts);
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

  const { categories, totalSpent } = useMemo(
    () => aggregateExpenseCategories(transactions, displayMonth),
    [displayMonth, transactions],
  );

  const {
    pendingReview,
    markAllPendingSeen,
    markSeen,
    ignoreTransaction,
  } = useTransactionReviewQueue(transactions);

  const pendingValidation = useMemo(
    () =>
      isReviewMode
        ? pendingReview
        : sortTransactionsNewestFirst(listTransactionsNeedingValidation(transactions, displayMonth)),
    [displayMonth, isReviewMode, pendingReview, transactions],
  );

  useFocusEffect(
    useCallback(() => {
      reviewSeenMarkedRef.current = false;
      const month = currentMonthStart();
      setDisplayMonth(month);
      setPendingMonth(month);
      setSelectedCategoryId(null);
      setValidationVisible(openValidationOnFocus);
      return () => {
        reviewSeenMarkedRef.current = false;
      };
    }, [openValidationOnFocus]),
  );

  useEffect(() => {
    if (!openValidationOnFocus || pendingReview.length === 0 || reviewSeenMarkedRef.current) return;
    reviewSeenMarkedRef.current = true;
    void markAllPendingSeen();
  }, [markAllPendingSeen, openValidationOnFocus, pendingReview.length]);

  const showValidationList = isReviewMode || validationVisible;

  const hubEyebrow = useMemo(
    () =>
      isCurrentMonth(displayMonth)
        ? 'CE MOIS-CI'
        : formatBudgetMonthEyebrow(displayMonth),
    [displayMonth],
  );

  const budgetMonth = startOfMonth(pendingMonth);
  const budgetEarliest = startOfMonth(earliestMonth);
  const budgetLatest = startOfMonth(latestMonth);
  const canGoPrevious = isMonthAfter(budgetMonth, budgetEarliest);
  const canGoNext = isMonthBefore(budgetMonth, budgetLatest);

  const navigateToMonth = useCallback(
    (month: Date) => {
      const next = startOfMonth(month);
      setPendingMonth(next);
      setDisplayMonth(next);
      setSelectedCategoryId(null);
      if (!isReviewMode) {
        setValidationVisible(false);
      }
    },
    [isReviewMode],
  );

  const goPrevious = useCallback(() => {
    navigateToMonth(new Date(budgetMonth.getFullYear(), budgetMonth.getMonth() - 1, 1));
  }, [budgetMonth, navigateToMonth]);

  const goNext = useCallback(() => {
    navigateToMonth(new Date(budgetMonth.getFullYear(), budgetMonth.getMonth() + 1, 1));
  }, [budgetMonth, navigateToMonth]);

  const handlePressTransaction = useCallback(
    (transactionId: string) => {
      tapHaptic();
      void markSeen([transactionId]);
      openTransactionDetail(transactionId);
    },
    [markSeen],
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

  const listHeader = (
    <View>
      {isReviewMode ? (
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
              <Ionicons name="chevron-back" size={24} color={colors.text} />
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
        <>
          <View
            style={[
              styles.stackTopBar,
              { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.lg + spacing.md },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retour"
              hitSlop={12}
              onPress={() => {
                tapHaptic();
                router.back();
              }}
              style={({ pressed }) => [
                styles.stackBackButton,
                {
                  backgroundColor: colors.containerBackground,
                  borderColor: colors.containerBorder,
                },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Text style={[styles.stackTitle, { color: colors.text }]} numberOfLines={1}>
              Analyse dépenses
            </Text>
            <View style={styles.stackTopBarSpacer} />
          </View>

          <View style={styles.donutSection}>
            <DashboardCard padding={spacing.lg} innerStyle={styles.distributionCard}>
              <MonthSelector
                month={budgetMonth}
                onPrevious={goPrevious}
                onNext={goNext}
                canGoPrevious={canGoPrevious}
                canGoNext={canGoNext}
              />
              <ExpenseCategoryDonut
                categories={categories}
                totalSpent={totalSpent}
                selectedId={selectedCategoryId}
                onSelectCategory={setSelectedCategoryId}
                hubEyebrow={hubEyebrow}
              />
            </DashboardCard>
          </View>

          <View style={styles.validateSection}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                validationVisible
                  ? 'Masquer les transactions à compléter'
                  : 'Afficher les transactions à compléter'
              }
              accessibilityState={{ expanded: validationVisible }}
              onPress={() => {
                tapHaptic();
                setValidationVisible((visible) => !visible);
              }}
              style={({ pressed }) => [
                styles.validateButton,
                {
                  backgroundColor: colors.text,
                  borderColor: colors.text,
                },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.background} />
              <Text style={[typographyKit.bodyBold, { color: colors.background }]}>
                Valider
              </Text>
              {pendingValidation.length > 0 ? (
                <View style={[styles.validateBadge, { backgroundColor: colors.accentGreen }]}>
                  <Text style={[typographyKit.caption, { color: '#0a0a0a' }]}>
                    {pendingValidation.length}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Text style={[styles.validateHint, typographyKit.caption, { color: colors.textMuted }]}>
              {pendingValidation.length > 0
                ? 'Transactions sans catégorie ou articles à compléter ce mois-ci.'
                : 'Toutes les dépenses de ce mois sont complètes.'}
            </Text>
          </View>
        </>
      )}

      {!isReviewMode && validationVisible ? (
        <View style={styles.listHeader}>
          <DashboardSectionLabel>À compléter</DashboardSectionLabel>
        </View>
      ) : null}
    </View>
  );

  const listEmpty = showValidationList ? (
    <DashboardCard
      padding={spacing.lg}
      innerStyle={[styles.emptyCard, isReviewMode && styles.emptyCardReview]}
    >
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons
          name="checkmark-done-outline"
          size={22}
          color={isReviewMode ? colors.accentGreen : colors.textMuted}
        />
      </View>
      <Text style={[styles.emptyTitle, typographyKit.bodyBold, { color: colors.text }]}>
        {isReviewMode ? 'Tout est à jour' : 'Rien à valider'}
      </Text>
      <Text style={[styles.emptyHint, typographyKit.caption, { color: colors.textMuted }]}>
        {isReviewMode
          ? `Les ${REVIEW_TRANSACTION_WINDOW} dernières dépenses ont une catégorie et une description.`
          : 'Les dépenses de ce mois ont une catégorie et des articles complets.'}
      </Text>
    </DashboardCard>
  ) : null;

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
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

        <FlatList
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
            const issues = getTransactionValidationIssues(item).filter((issue) =>
              isReviewMode ? issue !== 'article_category' : true,
            );

            if (isReviewMode) {
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
            }

            return (
              <View style={[styles.validationRowWrap, styles.validationRowInset]}>
                <TransactionRow
                  transaction={item}
                  accounts={accounts}
                  savingsGoals={savingsGoals}
                  contactPhotoByKey={contactPhotoByKey}
                  onPressId={handlePressTransaction}
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
  stackTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingBottom: spacing.md,
  },
  stackBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
    ...jakartaExtraBoldText,
    fontSize: typography.body,
    letterSpacing: -0.2,
  },
  stackTopBarSpacer: { width: 38 },
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
  donutSection: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  distributionCard: {
    gap: spacing.md,
  },
  validateSection: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginTop: PORTFOLIO_SECTION_GAP,
    gap: spacing.sm,
  },
  validateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: UNIFORM_ACTION_BUTTON_MIN_HEIGHT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  validateBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: spacing.xs,
  },
  validateHint: {
    textAlign: 'center',
    lineHeight: 18,
  },
  listHeader: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
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

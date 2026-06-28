import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
  PAGE_PADDING_HORIZONTAL,
  PORTFOLIO_SECTION_GAP,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { useContactPhotoMap } from '@/hooks/useContactPhotoMap';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
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
import { ensureDbReady } from '@/lib/init';
import {
  aggregateExpenseCategories,
  getTransactionValidationIssues,
  listTransactionsNeedingArticleReview,
  listTransactionsNeedingValidation,
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

  const latestMonth = currentMonthStart();

  const load = useCallback(async () => {
    await ensureDbReady();
    const [txs, simulatedAccounts] = await Promise.all([
      getTransactions(),
      getSimulatedAccounts(),
    ]);
    setTransactions(txs);
    setAccounts(simulatedAccounts);
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

  useRefreshOnFocus(load);
  useEffect(() => dataEvents.subscribe(load), [load]);

  useFocusEffect(
    useCallback(() => {
      const month = currentMonthStart();
      setDisplayMonth(month);
      setPendingMonth(month);
      setSelectedCategoryId(null);
      setValidationVisible(openValidationOnFocus);
    }, [openValidationOnFocus]),
  );

  const { categories, totalSpent } = useMemo(
    () => aggregateExpenseCategories(transactions, displayMonth),
    [displayMonth, transactions],
  );

  const pendingValidation = useMemo(
    () =>
      sortTransactionsNewestFirst(
        isReviewMode
          ? listTransactionsNeedingArticleReview(transactions)
          : listTransactionsNeedingValidation(transactions, displayMonth),
      ),
    [displayMonth, isReviewMode, transactions],
  );

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
      router.push({ pathname: '/transaction-detail', params: { transactionId } });
    },
    [router],
  );

  const listHeader = (
    <View>
      <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.md }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={12}
          onPress={() => {
            tapHaptic();
            router.back();
          }}
          style={({ pressed }) => [styles.backHit, pressed && styles.pressed]}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, typographyKit.pageTitle, { color: colors.text }]}>
          {isReviewMode ? 'À compléter' : 'Analyse dépenses'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {isReviewMode ? (
        <View style={styles.reviewHintSection}>
          <Text style={[styles.reviewHint, typographyKit.caption, { color: colors.textMuted }]}>
            {pendingValidation.length > 0
              ? 'Dépenses scannées sans articles détaillés.'
              : 'Toutes les dépenses scannées ont leurs articles.'}
          </Text>
        </View>
      ) : (
        <>
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
              <Text style={[styles.validateButtonText, typographyKit.bodyBold, { color: colors.background }]}>
                Valider
              </Text>
              {pendingValidation.length > 0 ? (
                <View style={[styles.validateBadge, { backgroundColor: colors.accentGreen }]}>
                  <Text style={[styles.validateBadgeText, typographyKit.caption, { color: '#0a0a0a' }]}>
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
    <DashboardCard padding={spacing.lg} innerStyle={styles.emptyCard}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons name="checkmark-done-outline" size={22} color={colors.accentGreen} />
      </View>
      <Text style={[styles.emptyTitle, typographyKit.bodyBold, { color: colors.text }]}>
        {isReviewMode ? 'Rien à compléter' : 'Rien à valider'}
      </Text>
      <Text style={[styles.emptyHint, typographyKit.caption, { color: colors.textMuted }]}>
        {isReviewMode
          ? 'Toutes les dépenses scannées ont leurs articles.'
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
          }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.rowGap} />}
          renderItem={({ item }) => {
            const issues = getTransactionValidationIssues(item).filter((issue) =>
              isReviewMode ? issue === 'articles' : true,
            );
            return (
              <View style={styles.validationRowWrap}>
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
                        <Text style={[styles.issueChipText, typographyKit.caption, { color: colors.textMuted }]}>
                          {validationIssueLabel(issue)}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginBottom: PORTFOLIO_SECTION_GAP,
  },
  backHit: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  donutSection: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  reviewHintSection: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginBottom: spacing.sm,
  },
  reviewHint: {
    textAlign: 'center',
    lineHeight: 18,
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
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  validateButtonText: {},
  validateBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: spacing.xs,
  },
  validateBadgeText: {
    fontWeight: '800',
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
  validationRowWrap: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    gap: spacing.xs,
  },
  issueChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingLeft: spacing.xs,
  },
  issueChip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  issueChipText: {},
  emptyCard: {
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: PAGE_PADDING_HORIZONTAL,
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
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
    opacity: 0.82,
  },
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChildSupportBreakdownChart } from '@/components/ChildSupportBreakdownChart';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { DetailSectionsList } from '@/components/DetailSectionRows';
import {
  FixedScreenHeader,
  fixedHeaderScrollStyle,
  fixedHeaderScreenStyle,
} from '@/components/FixedScreenHeader';
import { LineOfCreditCharts } from '@/components/LineOfCreditCharts';
import { LineOfCreditUtilizationChart } from '@/components/LineOfCreditUtilizationChart';
import { LoanPaymentDonutChart, MortgageDetailCharts } from '@/components/MortgageCharts';
import { OnyxContainer } from '@/components/OnyxContainer';
import { OverflowMenuButton } from '@/components/OverflowMenuButton';
import { GlassContainer } from '@/components/GlassContainer';
import { LoanProgressChart } from '@/components/LoanProgressChart';
import { PageTransition } from '@/components/PageTransition';
import { ONYX_CONTAINER } from '@/constants/planFinanceKit';
import {
  detailProgressBarStyle,
  FLOATING_NAV_CONTENT_PADDING,
  jakartaBoldText,
  jakartaMediumText,
  moneyAmountTypography,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { nativeTextColumnFlex } from '@/lib/textLayout';
import {
  deleteLoan,
  getLoanById,
  getRecurringPayments,
  getSimulatedAccounts,
  getTransactions,
  getWealthAssetById,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { buildLineOfCreditBalanceHistory } from '@/lib/buildLineOfCreditBalanceHistory';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import {
  buildLoanDetailSections,
  computeLineOfCreditUtilization,
  loanDetailFootnote,
} from '@/lib/loanDetailSections';
import {
  computeLoanRepaymentProgress,
  formatLoanDisplayTitle,
  loanProgressHeaderLabel,
} from '@/lib/loanPresentation';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import type { Loan, RecurringPayment, SimulatedAccount, Transaction, WealthAsset } from '@/types';
import { Image } from 'expo-image';

export default function LoanDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ loanId?: string }>();
  const loanId = typeof params.loanId === 'string' ? params.loanId.trim() : '';
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { colors, isLight } = useAppTheme();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [linkedAsset, setLinkedAsset] = useState<WealthAsset | null>(null);
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  const load = useCallback(async () => {
    if (!loanId) {
      setLoan(null);
      setLinkedAsset(null);
      setAccounts([]);
      setTransactions([]);
      setRecurringPayments([]);
      return;
    }
    const [nextLoan, nextAccounts, nextRecurringPayments, nextTransactions] = await Promise.all([
      getLoanById(loanId),
      getSimulatedAccounts(),
      getRecurringPayments(),
      getTransactions(),
    ]);
    setLoan(nextLoan);
    setAccounts(nextAccounts);
    setRecurringPayments(nextRecurringPayments);
    setTransactions(nextTransactions);
    if (nextLoan?.wealthAssetId) {
      const asset = await getWealthAssetById(nextLoan.wealthAssetId);
      setLinkedAsset(asset);
    } else {
      setLinkedAsset(null);
    }
  }, [loanId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    void load();
  }, [loanId, load]);

  useRefreshOnFocus(load);
  useEffect(() => dataEvents.subscribe(load), [load]);

  const paymentAccount = useMemo(
    () => accounts.find((account) => account.id === loan?.paymentAccountId) ?? null,
    [accounts, loan?.paymentAccountId],
  );

  const recurringPayment = useMemo(() => {
    if (!loan?.recurringPaymentId) return null;
    return recurringPayments.find((payment) => payment.id === loan.recurringPaymentId) ?? null;
  }, [loan?.recurringPaymentId, recurringPayments]);

  const detailSections = useMemo(
    () => (loan ? buildLoanDetailSections(loan, paymentAccount, recurringPayment) : []),
    [loan, paymentAccount, recurringPayment],
  );

  const detailFootnote = useMemo(() => (loan ? loanDetailFootnote(loan) : null), [loan]);

  const visibleDetailSections = useMemo(
    () => detailSections.filter((section) => section.rows.length > 0),
    [detailSections],
  );

  const loanType = loan?.type ?? 'personal_loan';
  const isMortgage = loanType === 'mortgage';
  const isPersonalLoan = loanType === 'personal_loan';
  const isLineOfCredit = loanType === 'line_of_credit';
  const isFriendDebt = loanType === 'friend_debt';
  const isChildSupport = loanType === 'child_support';

  const repaymentProgress = loan
    ? computeLoanRepaymentProgress(loan)
    : { paidAmount: 0, progressPct: 0 };
  const utilizationProgress = loan
    ? computeLineOfCreditUtilization(loan)
    : { usedAmount: 0, utilPct: 0 };

  const displayTitle = loan ? formatLoanDisplayTitle(loan) : '';
  const lineOfCreditBalanceHistory = useMemo(() => {
    if (!loan || !isLineOfCredit) return null;
    return buildLineOfCreditBalanceHistory({
      currentBalance: loan.balanceRemaining,
      creditLimit: loan.principal,
      loanId: loan.id,
      transactions,
      paymentAccountId: paymentAccount?.id ?? '',
      paymentAccountName: paymentAccount?.name ?? '',
      loanTitle: displayTitle,
      recurringPaymentName: recurringPayment?.name ?? null,
    });
  }, [displayTitle, isLineOfCredit, loan, paymentAccount, recurringPayment?.name, transactions]);
  const trackColor = isLight ? '#E8EDF3' : '#08090B';

  const navigateToEdit = () => {
    if (!loan) return;
    tapHaptic();
    router.replace({ pathname: '/loan-detail', params: { loanId: loan.id } });
  };

  const confirmDelete = () => {
    tapHaptic();
    setConfirmDeleteVisible(true);
  };

  const showLocUtilizationChart =
    loan != null && loan.principal > 0 && isLineOfCredit && !isChildSupport;
  const showRepaymentProgressCard =
    loan != null && loan.principal > 0 && !isChildSupport && !isLineOfCredit;
  const progressPct = repaymentProgress.progressPct;
  const progressFillColor = colors.primary;
  const progressBar = detailProgressBarStyle();

  const locUtilizationChartBlock = showLocUtilizationChart ? (
    <View style={styles.utilizationChartSection}>
      <LineOfCreditUtilizationChart
        currentUsed={utilizationProgress.usedAmount}
        balanceHistory={lineOfCreditBalanceHistory}
      />
    </View>
  ) : null;

  const progressCard = showRepaymentProgressCard ? (
    <GlassContainer
      style={styles.progressCardShell}
      innerStyle={styles.progressCardInner}
      padding={spacing.md}
      borderRadius={radius.lg}
    >
      <View style={styles.progressHeader}>
        <Text
          style={[styles.progressLabel, { color: colors.textMuted }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {loanProgressHeaderLabel(false)}
        </Text>
        <Text
          style={[styles.progressPct, { color: progressFillColor }]}
          numberOfLines={1}
        >
          {progressPct.toFixed(0)} %
        </Text>
      </View>
      <View style={[progressBar.track, { backgroundColor: trackColor }]}>
        <View
          style={[
            progressBar.fill,
            {
              width: `${Math.max(progressPct, 3)}%`,
              backgroundColor: progressFillColor,
            },
          ]}
        />
      </View>
      <View style={styles.progressFooter}>
        <Text style={[styles.progressFootnote, { color: colors.textMuted }]}>
          {`${isMortgage || isPersonalLoan || isChildSupport ? 'Remboursé' : 'Payé'} · ${formatDisplayMoneyAbsolute(repaymentProgress.paidAmount)}`}
        </Text>
        <Text style={[styles.progressFootnote, { color: colors.textMuted }]}>
          Total · {formatDisplayMoneyAbsolute(loan!.principal)}
        </Text>
      </View>
      {loan ? (
        <View style={styles.progressChartSection}>
          <LoanProgressChart
            loan={loan}
            loanTitle={displayTitle}
            transactions={transactions}
            paymentAccount={paymentAccount}
            recurringPaymentName={recurringPayment?.name ?? null}
          />
        </View>
      ) : null}
    </GlassContainer>
  ) : isFriendDebt && loan && loan.balanceRemaining > 0 ? (
    <GlassContainer
      style={styles.progressCardShell}
      innerStyle={styles.progressCardInner}
      padding={spacing.md}
      borderRadius={radius.lg}
    >
      <View style={styles.progressHeader}>
        <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Solde</Text>
        <Text style={[styles.progressPctMoney, { color: colors.danger }]}>
          {formatDisplayMoneyAbsolute(loan.balanceRemaining)}
        </Text>
      </View>
    </GlassContainer>
  ) : null;

  return (
    <PageTransition>
      <View style={[fixedHeaderScreenStyle, styles.screen, { backgroundColor: colors.background }]}>
        <FixedScreenHeader
          title={displayTitle || 'Dette'}
          onBack={() => router.back()}
          trailing={
            loan ? (
              <OverflowMenuButton
                accessibilityLabel="Options de la dette"
                items={[
                  {
                    key: 'edit',
                    label: 'Modifier',
                    onPress: navigateToEdit,
                  },
                  {
                    key: 'delete',
                    label: 'Supprimer',
                    icon: 'trash-outline',
                    destructive: true,
                    onPress: confirmDelete,
                  },
                ]}
              />
            ) : undefined
          }
        />

        <ScrollView
          ref={scrollRef}
          style={fixedHeaderScrollStyle}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING },
          ]}
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
          {loan ? (
            <>
              {isMortgage ? <MortgageDetailCharts loan={loan} /> : null}
              {isPersonalLoan ? <LoanPaymentDonutChart loan={loan} /> : null}
              {isLineOfCredit && loan.principal > 0 ? (
                <LineOfCreditCharts
                  balance={loan.balanceRemaining}
                  creditLimit={loan.principal}
                  balanceHistory={lineOfCreditBalanceHistory}
                />
              ) : null}
              {isChildSupport ? <ChildSupportBreakdownChart loan={loan} /> : null}

              {locUtilizationChartBlock}
              {progressCard}

              {visibleDetailSections.length > 0 || detailFootnote ? (
                <OnyxContainer style={[styles.detailsCard, { padding: ONYX_CONTAINER.padding.card }]}>
                  <DetailSectionsList
                    sections={visibleDetailSections}
                    colors={colors}
                    footnote={detailFootnote}
                  />
                </OnyxContainer>
              ) : null}

              {linkedAsset?.photoUri?.trim() ? (
                <View style={styles.bannerWrap}>
                  <Image
                    source={{ uri: linkedAsset.photoUri.trim() }}
                    style={styles.bannerImage}
                    contentFit="cover"
                    accessibilityLabel="Photo de la propriété"
                  />
                </View>
              ) : null}
            </>
          ) : (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {loanId ? 'Dette introuvable.' : 'Aucune dette sélectionnée.'}
            </Text>
          )}
        </ScrollView>

        <ConfirmDeleteModal
          visible={confirmDeleteVisible}
          title="Supprimer cette dette ?"
          message={loan ? `Supprimer ${displayTitle} ? Les paiements récurrents liés seront aussi retirés.` : undefined}
          onConfirm={async () => {
            if (!loan) return;
            setConfirmDeleteVisible(false);
            await deleteLoan(loan.id);
            successHaptic();
            router.back();
          }}
          onCancel={() => setConfirmDeleteVisible(false)}
        />
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  bannerWrap: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    height: 168,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  progressCardShell: {
    borderRadius: radius.lg,
  },
  progressCardInner: {
    gap: spacing.sm,
  },
  utilizationChartSection: {
    width: '100%',
  },
  progressChartSection: {
    marginTop: spacing.sm,
    width: '100%',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  progressLabel: {
    ...jakartaBoldText,
    ...(Platform.OS === 'web'
      ? { flex: 1, flexShrink: 1, minWidth: 0 }
      : nativeTextColumnFlex),
    fontSize: typography.micro,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  progressPct: {
    ...jakartaBoldText,
    flexShrink: 0,
    minWidth: 44,
    textAlign: 'right',
    fontSize: typography.meta,
  },
  progressPctMoney: {
    ...moneyAmountTypography({ tier: 'row' }),
    flexShrink: 0,
    minWidth: 44,
    textAlign: 'right',
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  progressFootnote: {
    ...jakartaMediumText,
    fontSize: typography.meta,
  },
  detailsCard: {
    gap: spacing.sm,
  },
  empty: {
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  pressed: { opacity: 0.78 },
});

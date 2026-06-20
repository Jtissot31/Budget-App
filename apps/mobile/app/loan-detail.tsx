import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChildSupportBreakdownChart } from '@/components/ChildSupportBreakdownChart';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { DetailSingleLineRow } from '@/components/DetailSectionRows';
import { SurfaceCard } from '@/components/SurfaceCard';
import { LineOfCreditCharts } from '@/components/LineOfCreditCharts';
import { LoanPaymentDonutChart, MortgageDetailCharts } from '@/components/MortgageCharts';
import { OverflowMenuButton } from '@/components/OverflowMenuButton';
import { GlassContainer } from '@/components/GlassContainer';
import { PageTransition } from '@/components/PageTransition';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  detailProgressBarStyle,
  detailSectionFootnoteStyle,
  detailSectionLabelStyle,
  detailSectionsCardStyle,
  interBoldText,
  interExtraBoldText,
  interMediumText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
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
    if (!loan || !isLineOfCredit || !paymentAccount) return null;
    return buildLineOfCreditBalanceHistory({
      currentBalance: loan.balanceRemaining,
      creditLimit: loan.principal,
      loanId: loan.id,
      transactions,
      paymentAccountId: paymentAccount.id,
      paymentAccountName: paymentAccount.name,
      loanTitle: displayTitle,
      recurringPaymentName: recurringPayment?.name ?? null,
    });
  }, [displayTitle, isLineOfCredit, loan, paymentAccount, recurringPayment?.name, transactions]);
  const trackColor = isLight ? '#E8EDF3' : '#08090B';

  const navigateToEdit = () => {
    if (!loan) return;
    tapHaptic();
    router.replace({ pathname: '/accounts', params: { editLoanId: loan.id } });
  };

  const confirmDelete = () => {
    tapHaptic();
    setConfirmDeleteVisible(true);
  };

  const showProgressCard = loan != null && loan.principal > 0 && !isChildSupport;
  const progressPct = isLineOfCredit ? utilizationProgress.utilPct : repaymentProgress.progressPct;
  const progressHeader = isLineOfCredit ? 'Utilisation' : loanProgressHeaderLabel(false);
  const progressFillColor = isLineOfCredit && progressPct > 80 ? colors.danger : colors.primary;
  const progressBar = detailProgressBarStyle();

  const progressCard = showProgressCard ? (
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
          {progressHeader}
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
          {isLineOfCredit
            ? `Utilisé · ${formatDisplayMoneyAbsolute(utilizationProgress.usedAmount)}`
            : `${isMortgage || isPersonalLoan || isChildSupport ? 'Remboursé' : 'Payé'} · ${formatDisplayMoneyAbsolute(repaymentProgress.paidAmount)}`}
        </Text>
        <Text style={[styles.progressFootnote, { color: colors.textMuted }]}>
          {isLineOfCredit ? 'Limite' : 'Total'} · {formatDisplayMoneyAbsolute(loan!.principal)}
        </Text>
      </View>
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
        <Text style={[styles.progressPct, { color: colors.danger }]}>
          {formatDisplayMoneyAbsolute(loan.balanceRemaining)}
        </Text>
      </View>
    </GlassContainer>
  ) : null;

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: 'transparent' }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.lg + spacing.md }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
              pressed && styles.pressed,
            ]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {displayTitle || 'Dette'}
          </Text>
          {loan ? (
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
          ) : (
            <View style={styles.topBarSpacer} />
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + spacing.xl, 56) }]}
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

              {progressCard}

              {visibleDetailSections.length > 0 || detailFootnote ? (
                <View style={styles.detailsSectionsStack}>
                  {visibleDetailSections.map((section, sectionIndex) => (
                    <SurfaceCard
                      key={section.title}
                      style={detailSectionsCardStyle()}
                      padding={spacing.xl}
                    >
                      <Text style={[detailSectionLabelStyle(), { color: colors.text }]}>
                        {section.title}
                      </Text>
                      <View style={[styles.detailSectionRows, { borderTopColor: colors.border }]}>
                        {section.rows.map((row, rowIndex) => (
                          <DetailSingleLineRow
                            key={row.label}
                            row={row}
                            colors={colors}
                            isLast={rowIndex === section.rows.length - 1}
                            rowPaddingVertical={spacing.md}
                          />
                        ))}
                      </View>
                      {sectionIndex === visibleDetailSections.length - 1 && detailFootnote ? (
                        <Text style={[detailSectionFootnoteStyle(), { color: colors.textMuted }]}>
                          {detailFootnote}
                        </Text>
                      ) : null}
                    </SurfaceCard>
                  ))}
                </View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
    ...interExtraBoldText,
    fontSize: typography.body,
    letterSpacing: -0.2,
  },
  topBarSpacer: { width: 38 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  detailsSectionsStack: {
    gap: spacing.lg,
  },
  detailSectionRows: {
    borderTopWidth: StyleSheet.hairlineWidth,
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
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  progressLabel: {
    ...interBoldText,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: typography.micro,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  progressPct: {
    ...interBoldText,
    flexShrink: 0,
    minWidth: 44,
    textAlign: 'right',
    fontSize: typography.meta,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  progressFootnote: {
    ...interMediumText,
    fontSize: typography.meta,
  },
  empty: {
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  pressed: { opacity: 0.78 },
});

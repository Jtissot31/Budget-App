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
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { GlassContainer } from '@/components/GlassContainer';
import { PageTransition } from '@/components/PageTransition';
import { PaymentDetailSheet, type PaymentDetailPayload } from '@/components/PaymentDetailSheet';
import { SurfaceCard } from '@/components/SurfaceCard';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  destructiveIconColor,
  destructiveTextActionStyle,
  interBoldText,
  interMediumText,
  radius,
  spacing,
  subtleDeleteButtonStyle,
  typography,
  type AppColors,
} from '@/constants/theme';
import {
  deleteLoan,
  getLoanById,
  getRecurringPayments,
  getSimulatedAccounts,
  getWealthAssetById,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import { resolveLoanIcon } from '@/lib/loanIcons';
import {
  computeLoanRepaymentProgress,
  formatLoanDate,
  formatLoanDebtAmount,
  formatLoanDisplayTitle,
  formatLoanDuration,
  formatLoanPaymentObligation,
  loanBalanceLabel,
  loanLenderLabel,
  loanPaymentFrequencyLabel,
  loanPaymentFrequencyShort,
  loanPrincipalLabel,
  loanProgressHeaderLabel,
  loanProgressLabel,
  loanTypeLabel,
  resolveLoanReason,
} from '@/lib/loanPresentation';
import { frequencyLabel } from '@/lib/recurringPaymentsForm';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import { computeMortgageEquity } from '@/lib/mortgageWealthSync';
import type { Loan, RecurringPayment, SimulatedAccount, WealthAsset } from '@/types';
import { Image } from 'expo-image';

type DetailRow = {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

function buildDetailRows(
  loan: Loan,
  paymentAccount: SimulatedAccount | null,
  recurringPayment: RecurringPayment | null,
): DetailRow[] {
  const rows: DetailRow[] = [];
  const type = loan.type ?? 'personal_loan';
  const isMortgage = type === 'mortgage';
  const isFriendDebt = type === 'friend_debt';
  const isLineOfCredit = type === 'line_of_credit';

  rows.push({ label: 'Type', value: loanTypeLabel(type), icon: 'pricetag-outline' });

  const reason = resolveLoanReason(loan);
  if (reason) {
    rows.push({ label: 'Raison', value: reason, icon: 'document-text-outline' });
  }

  if (loan.lender.trim()) {
    rows.push({
      label: loanLenderLabel(type),
      value: loan.lender.trim(),
      icon: isFriendDebt ? 'person-outline' : 'business-outline',
    });
  }

  if (isMortgage && loan.address?.trim()) {
    rows.push({
      label: 'Adresse',
      value: loan.address.trim(),
      icon: 'location-outline',
    });
  }

  if (!isFriendDebt) {
    rows.push({
      label: loanPrincipalLabel(type),
      value: formatDisplayMoneyAbsolute(loan.principal),
      icon: isMortgage ? 'home-outline' : 'cash-outline',
    });
  }

  rows.push({
    label: loanBalanceLabel(type),
    value: formatLoanDebtAmount(loan.balanceRemaining),
    icon: 'wallet-outline',
  });

  if (isMortgage) {
    if (typeof loan.downPayment === 'number' && loan.downPayment > 0) {
      rows.push({
        label: 'Mise de fonds',
        value: formatDisplayMoneyAbsolute(loan.downPayment),
        icon: 'cash-outline',
      });
    }
    if (typeof loan.purchasePrice === 'number' && loan.purchasePrice > 0) {
      rows.push({
        label: 'Valeur à l’achat',
        value: formatDisplayMoneyAbsolute(loan.purchasePrice),
        icon: 'pricetag-outline',
      });
    }
    if (typeof loan.currentPropertyValue === 'number' && loan.currentPropertyValue > 0) {
      rows.push({
        label: 'Valeur actuelle',
        value: formatDisplayMoneyAbsolute(loan.currentPropertyValue),
        icon: 'trending-up-outline',
      });
      const { equity } = computeMortgageEquity(loan);
      rows.push({
        label: 'Équité',
        value: formatDisplayMoneyAbsolute(equity),
        icon: 'shield-checkmark-outline',
      });
    }
  }

  if (!isFriendDebt && loan.interestRate > 0) {
    rows.push({
      label: 'Taux d’intérêt',
      value: `${loan.interestRate} %`,
      icon: 'trending-up-outline',
    });
  }

  if (!isFriendDebt && loan.monthlyPayment > 0) {
    rows.push({
      label: isMortgage ? 'Paiement mensuel' : 'Paiement',
      value: `${formatDisplayMoneyAbsolute(loan.monthlyPayment)} / ${loanPaymentFrequencyShort(loan.paymentFrequency)}`,
      icon: 'calendar-outline',
    });
  }

  if (!isFriendDebt && loan.durationAmount > 0) {
    rows.push({
      label: isMortgage ? 'Amortissement' : 'Durée',
      value: formatLoanDuration(loan.durationAmount, loan.durationUnit, type),
      icon: 'time-outline',
    });
  }

  if (loan.startDate.trim()) {
    rows.push({
      label: 'Date de début',
      value: formatLoanDate(loan.startDate),
      icon: 'play-outline',
    });
  }

  if (loan.endDate.trim()) {
    rows.push({
      label: 'Date de fin',
      value: formatLoanDate(loan.endDate),
      icon: 'flag-outline',
    });
  }

  if (loan.nextPaymentDate.trim() && !isFriendDebt) {
    rows.push({
      label: 'Prochain paiement',
      value: formatLoanDate(loan.nextPaymentDate),
      icon: 'alarm-outline',
    });
  }

  if (paymentAccount) {
    rows.push({
      label: 'Compte de paiement',
      value: paymentAccount.last4
        ? `${paymentAccount.name} · ${paymentAccount.last4}`
        : paymentAccount.name,
      icon: 'card-outline',
    });
  }

  if (recurringPayment) {
    rows.push({
      label: 'Paiement récurrent',
      value: `${frequencyLabel(recurringPayment.frequency)}${recurringPayment.active ? '' : ' · inactif'}`,
      icon: 'repeat-outline',
    });
  }

  return rows;
}

export default function LoanDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ loanId?: string }>();
  const loanId = typeof params.loanId === 'string' ? params.loanId.trim() : '';
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { colors, ghostCardShadow: themeGhostShadow, isLight } = useAppTheme();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [linkedAsset, setLinkedAsset] = useState<WealthAsset | null>(null);
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDetailPayload | null>(null);

  const load = useCallback(async () => {
    if (!loanId) {
      setLoan(null);
      setLinkedAsset(null);
      setAccounts([]);
      setRecurringPayments([]);
      return;
    }
    const [nextLoan, nextAccounts, nextRecurringPayments] = await Promise.all([
      getLoanById(loanId),
      getSimulatedAccounts(),
      getRecurringPayments(),
    ]);
    setLoan(nextLoan);
    setAccounts(nextAccounts);
    setRecurringPayments(nextRecurringPayments);
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

  const detailRows = useMemo(
    () => (loan ? buildDetailRows(loan, paymentAccount, recurringPayment) : []),
    [loan, paymentAccount, recurringPayment],
  );

  const loanType = loan?.type ?? 'personal_loan';
  const isMortgage = loanType === 'mortgage';
  const mortgageEquity = loan && isMortgage ? computeMortgageEquity(loan) : null;
  const { paidAmount, progressPct } = loan
    ? isMortgage && mortgageEquity && mortgageEquity.propertyValue > 0
      ? { paidAmount: mortgageEquity.equity, progressPct: mortgageEquity.equityPct }
      : computeLoanRepaymentProgress(loan)
    : { paidAmount: 0, progressPct: 0 };
  const paymentObligation = loan
    ? formatLoanPaymentObligation(loan.monthlyPayment, loan.paymentFrequency)
    : null;
  const displayTitle = loan ? formatLoanDisplayTitle(loan) : '';
  const trackColor = isLight ? '#E8EDF3' : '#08090B';

  const navigateToEdit = () => {
    if (!loan) return;
    tapHaptic();
    router.replace({ pathname: '/accounts', params: { editLoanId: loan.id } });
  };

  const openRecurringPayment = () => {
    if (!recurringPayment || !loan) return;
    tapHaptic();
    setSelectedPayment({
      name: recurringPayment.name,
      amount: recurringPayment.amount,
      sourceId: recurringPayment.id,
      recurring: true,
      kind: 'payment',
      account: recurringPayment.accountLabel ?? paymentAccount?.name ?? null,
      logoUrl: recurringPayment.logoUrl ?? null,
      icon: recurringPayment.icon ?? null,
      color: recurringPayment.color ?? null,
      frequencyLabel: frequencyLabel(recurringPayment.frequency),
      frequency: recurringPayment.frequency,
      active: recurringPayment.active,
      categoryName: recurringPayment.categoryName ?? null,
      categoryId: recurringPayment.categoryId ?? null,
      dateLabel: loan.nextPaymentDate ? formatLoanDate(loan.nextPaymentDate) : null,
    });
  };

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: 'transparent' }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
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
          <Text style={[styles.title, { color: colors.text }]}>Dettes & Prêts</Text>
          {loan ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Modifier cette dette"
              hitSlop={12}
              style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
              onPress={navigateToEdit}
            >
              <Ionicons name="create-outline" size={18} color={colors.text} />
              <Text style={[styles.headerActionText, { color: colors.text }]}>Modifier</Text>
            </Pressable>
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

              <GlassContainer
                style={themeGhostShadow}
                innerStyle={styles.identityCardInner}
                padding={spacing.md}
                borderRadius={radius.xl}
              >
                <UserPickedIconWell icon={resolveLoanIcon(loan)} size={52} wellGlyphWhite />
                <View style={styles.identityCopy}>
                  <Text style={[styles.loanName, { color: colors.text }]} numberOfLines={2}>
                    {displayTitle}
                  </Text>
                  <Text style={[styles.loanMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {loanTypeLabel(loan.type ?? 'personal_loan')}
                  </Text>
                </View>
              </GlassContainer>

              <GlassContainer
                style={styles.summaryCardShell}
                innerStyle={styles.summaryCardInner}
                padding={spacing.md}
                borderRadius={radius.lg}
              >
                <View>
                  <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                    {loanBalanceLabel(loan.type ?? 'personal_loan')}
                  </Text>
                  <Text style={[styles.summaryAmount, { color: colors.danger }]}>
                    {formatLoanDebtAmount(loan.balanceRemaining)}
                  </Text>
                </View>
                <Text style={[styles.summaryMeta, { color: colors.textMuted }]}>
                  {progressPct.toFixed(0)} % {loanProgressLabel(loanType).toLowerCase()}
                </Text>
              </GlassContainer>

              {isMortgage && mortgageEquity && mortgageEquity.propertyValue > 0 ? (
                <GlassContainer
                  style={styles.progressCardShell}
                  innerStyle={styles.progressCardInner}
                  padding={spacing.md}
                  borderRadius={radius.lg}
                >
                  <View style={styles.progressHeader}>
                    <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Équité</Text>
                    <Text style={[styles.progressPct, { color: colors.primary }]}>
                      {progressPct.toFixed(0)} %
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.max(progressPct, 3)}%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.progressFooter}>
                    <Text style={[styles.progressFootnote, { color: colors.textMuted }]}>
                      Équité · {formatDisplayMoneyAbsolute(paidAmount)}
                    </Text>
                    <Text style={[styles.progressFootnote, { color: colors.textMuted }]}>
                      Valeur · {formatDisplayMoneyAbsolute(mortgageEquity.propertyValue)}
                    </Text>
                  </View>
                </GlassContainer>
              ) : loan.principal > 0 ? (
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
                    <Text style={[styles.progressPct, { color: colors.primary }]} numberOfLines={1}>
                      {progressPct.toFixed(0)} %
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.max(progressPct, 3)}%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.progressFooter}>
                    <Text style={[styles.progressFootnote, { color: colors.textMuted }]}>
                      {isMortgage ? 'Remboursé' : 'Payé'} · {formatDisplayMoneyAbsolute(paidAmount)}
                    </Text>
                    <Text style={[styles.progressFootnote, { color: colors.textMuted }]}>
                      {isMortgage ? 'Valeur' : 'Total'} · {formatDisplayMoneyAbsolute(loan.principal)}
                    </Text>
                  </View>
                </GlassContainer>
              ) : null}

              <SurfaceCard style={styles.infoCard}>
                <Text style={[styles.infoSectionLabel, { color: colors.textMuted }]}>DÉTAILS</Text>
                <View style={[styles.infoRows, { borderColor: colors.border }]}>
                  {detailRows.map((row, index) => (
                    <DetailInfoRow
                      key={`${row.label}-${index}`}
                      row={row}
                      colors={colors}
                      isLast={index === detailRows.length - 1}
                    />
                  ))}
                </View>
              </SurfaceCard>

              {recurringPayment ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Voir le paiement récurrent lié"
                  android_ripple={null}
                  onPress={openRecurringPayment}
                >
                  <GlassContainer
                    borderRadius={radius.lg}
                    padding={spacing.md}
                    innerStyle={styles.recurringCardInner}
                  >
                    <View style={styles.recurringCopy}>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>Paiement programmé</Text>
                      <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>
                        {formatDisplayMoneyAbsolute(recurringPayment.amount)} ·{' '}
                        {loanPaymentFrequencyLabel(loan.paymentFrequency)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </GlassContainer>
                </Pressable>
              ) : paymentObligation ? (
                <GlassContainer
                  borderRadius={radius.lg}
                  padding={spacing.md}
                  innerStyle={styles.recurringCardInner}
                >
                  <View style={styles.recurringCopy}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Obligation de paiement</Text>
                    <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>
                      {paymentObligation}
                      {loan.nextPaymentDate.trim()
                        ? ` · prochain ${formatLoanDate(loan.nextPaymentDate)}`
                        : ''}
                    </Text>
                  </View>
                </GlassContainer>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Supprimer cette dette"
                style={({ pressed }) => [
                  subtleDeleteButtonStyle(isLight, { alignSelf: 'stretch' }),
                  pressed && { opacity: 0.72 },
                ]}
                onPress={() => {
                  tapHaptic();
                  setConfirmDeleteVisible(true);
                }}
              >
                <Ionicons name="trash-outline" size={16} color={destructiveIconColor(isLight)} />
                <Text style={destructiveTextActionStyle(isLight)}>Supprimer</Text>
              </Pressable>
            </>
          ) : (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {loanId ? 'Dette introuvable.' : 'Aucune dette sélectionnée.'}
            </Text>
          )}
        </ScrollView>

        <PaymentDetailSheet
          detail={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          onDeleted={() => { void load(); }}
        />

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

function DetailInfoRow({
  row,
  colors,
  isLast,
}: {
  row: DetailRow;
  colors: Pick<AppColors, 'text' | 'textMuted' | 'border'>;
  isLast: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      {row.icon ? (
        <Ionicons name={row.icon} size={18} color={colors.textMuted} style={styles.infoRowIcon} />
      ) : (
        <View style={styles.infoRowIconSpacer} />
      )}
      <View style={styles.infoRowCopy}>
        <Text style={[styles.infoRowLabel, { color: colors.textMuted }]}>{row.label}</Text>
        <Text style={[styles.infoRowValue, { color: colors.text }]}>{row.value}</Text>
      </View>
    </View>
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
    fontSize: typography.screenTitle,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  topBarSpacer: { width: 78 },
  headerAction: {
    minWidth: 78,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
  },
  headerActionText: {
    fontSize: typography.meta,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
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
  identityCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  loanName: {
    ...interBoldText,
    fontSize: typography.dashboardGreeting,
    letterSpacing: -0.3,
  },
  loanMeta: {
    fontSize: typography.meta,
    fontWeight: '700',
  },
  summaryCardShell: {
    borderRadius: radius.lg,
  },
  summaryCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryLabel: {
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  summaryAmount: {
    fontSize: typography.heroStat,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  summaryMeta: {
    fontSize: typography.micro,
    fontWeight: '800',
    paddingBottom: 4,
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
  progressTrack: {
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: 10,
    borderRadius: radius.pill,
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
  infoCard: {
    gap: spacing.sm,
  },
  infoSectionLabel: {
    ...interBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  infoRows: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  infoRowIcon: {
    marginTop: 2,
    width: 20,
  },
  infoRowIconSpacer: {
    width: 20,
  },
  infoRowCopy: {
    flex: 1,
    gap: 4,
  },
  infoRowLabel: {
    ...interBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
  infoRowValue: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  recurringCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  recurringCopy: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontSize: typography.caption,
    fontWeight: '800',
  },
  sectionMeta: {
    fontSize: typography.micro,
    fontWeight: '700',
  },
  empty: {
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  pressed: { opacity: 0.78 },
});

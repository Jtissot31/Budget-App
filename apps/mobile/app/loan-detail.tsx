import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import type { EditableFieldHandle } from '@/components/EditableField';
import {
  FixedScreenHeader,
  fixedHeaderScrollStyle,
  fixedHeaderScreenStyle,
} from '@/components/FixedScreenHeader';
import { LoanDetailBody } from '@/components/loans/LoanDetailBody';
import { OverflowMenuButton } from '@/components/OverflowMenuButton';
import { PageTransition } from '@/components/PageTransition';
import { FLOATING_NAV_CONTENT_PADDING, spacing, typography } from '@/constants/theme';
import {
  deleteLoan,
  getLoanById,
  getRecurringPayments,
  getSimulatedAccounts,
  getTransactions,
  getWealthAssetById,
  upsertLoan,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { parseFormattedNumber } from '@/lib/formatNumber';
import { buildLineOfCreditBalanceHistory } from '@/lib/buildLineOfCreditBalanceHistory';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import { buildLoanDetailSections, loanDetailFootnote } from '@/lib/loanDetailSections';
import { formatLoanDisplayTitle } from '@/lib/loanPresentation';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import type { Loan, RecurringPayment, SimulatedAccount, Transaction, WealthAsset } from '@/types';

export default function LoanDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ loanId?: string }>();
  const loanId = typeof params.loanId === 'string' ? params.loanId.trim() : '';
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const balanceEditRef = useRef<EditableFieldHandle>(null);
  const { colors } = useAppTheme();
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
    () =>
      loan
        ? buildLoanDetailSections(loan, paymentAccount, recurringPayment).filter((section) => section.rows.length > 0)
        : [],
    [loan, paymentAccount, recurringPayment],
  );
  const detailFootnote = useMemo(() => (loan ? loanDetailFootnote(loan) : null), [loan]);
  const displayTitle = loan ? formatLoanDisplayTitle(loan) : '';
  const isLineOfCredit = loan?.type === 'line_of_credit';

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

  /** Inline edits from « Mettre à jour » — persisted immediately. */
  const saveField = useCallback(
    async (field: 'balanceRemaining' | 'monthlyPayment' | 'interestRate', raw: string) => {
      if (!loan) return;
      const parsed = parseFormattedNumber(raw.replace('%', '').trim());
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error('invalid');
      const next = { ...loan, [field]: parsed };
      setLoan(next);
      await upsertLoan(next);
      successHaptic();
      dataEvents.emit();
    },
    [loan],
  );

  const startBalanceUpdate = () => {
    tapHaptic();
    scrollRef.current?.scrollToEnd({ animated: true });
    setTimeout(() => balanceEditRef.current?.startEditing(), 350);
  };

  const confirmDelete = () => {
    tapHaptic();
    setConfirmDeleteVisible(true);
  };

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
                    label: 'Mettre à jour le solde',
                    onPress: startBalanceUpdate,
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
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING }]}
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
            <LoanDetailBody
              loan={loan}
              displayTitle={displayTitle}
              transactions={transactions}
              paymentAccount={paymentAccount}
              recurringPaymentName={recurringPayment?.name ?? null}
              detailSections={detailSections}
              detailFootnote={detailFootnote}
              lineOfCreditBalanceHistory={lineOfCreditBalanceHistory}
              photoUri={linkedAsset?.photoUri?.trim() || null}
              balanceEditRef={balanceEditRef}
              onSaveField={saveField}
            />
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
  content: { paddingHorizontal: spacing.lg },
  empty: {
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});

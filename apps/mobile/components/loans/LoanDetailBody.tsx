/**
 * Vue détaillée d'une dette — l'essentiel d'abord :
 * 1. Résumé : reste à rembourser (anneau % remboursé), paiement, taux, fin.
 * 2. Prochain paiement.
 * 3. Où va ton paiement : capital vs intérêts.
 * 4. Évolution (graphiques existants selon le type).
 * 5. Mettre à jour (solde, paiement, taux — modifiables en place) + fiche complète.
 */
import type { RefObject } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChildSupportBreakdownChart } from '@/components/ChildSupportBreakdownChart';
import { DetailSectionsList, type DetailSection } from '@/components/DetailSectionRows';
import { EditableField, type EditableFieldHandle } from '@/components/EditableField';
import {
  DateWell,
  IconWell,
  ListCard,
  ListRow,
  RingGauge,
  SECTION_GAP,
  SectionLabel,
  SplitBar,
  SummaryCard,
} from '@/components/kit';
import { LineOfCreditCharts } from '@/components/LineOfCreditCharts';
import { LoanProgressChart } from '@/components/LoanProgressChart';
import { MortgageDetailCharts } from '@/components/MortgageCharts';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { calendarBoxParts } from '@/components/DashboardDateBadge';
import { jakartaMediumText, jakartaSemiboldText, radius, spacing } from '@/constants/theme';
import { detailRowValueMoney } from '@/lib/textLayout';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { resolveLoanIcon } from '@/lib/loanIcons';
import { loanPaymentFrequencyLabel } from '@/lib/loanPresentation';
import { useAppTheme } from '@/lib/themeContext';
import type { Loan, SimulatedAccount, Transaction } from '@/types';
import { FitText } from '@/components/kit/FitText';

const INTEREST_TONE = '#D9B77E';

type BalanceHistory = Parameters<typeof LineOfCreditCharts>[0]['balanceHistory'];

type Props = {
  loan: Loan;
  displayTitle: string;
  transactions: Transaction[];
  paymentAccount: SimulatedAccount | null;
  recurringPaymentName: string | null;
  detailSections: DetailSection[];
  detailFootnote: string | null;
  lineOfCreditBalanceHistory: BalanceHistory;
  photoUri: string | null;
  balanceEditRef: RefObject<EditableFieldHandle | null>;
  onSaveField: (field: 'balanceRemaining' | 'monthlyPayment' | 'interestRate', raw: string) => Promise<void>;
};

function periodsPerYear(loan: Loan): number {
  if (loan.paymentFrequency === 'weekly') return 52;
  if (loan.paymentFrequency === 'biweekly') return 26;
  return 12;
}

function shortDate(dateKey: string | null | undefined): string | null {
  const trimmed = dateKey?.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-CA', { month: 'short', year: 'numeric' });
}

function daysUntil(dateKey: string): number {
  const due = new Date(`${dateKey.slice(0, 10)}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function LoanDetailBody({
  loan,
  displayTitle,
  transactions,
  paymentAccount,
  recurringPaymentName,
  detailSections,
  detailFootnote,
  lineOfCreditBalanceHistory,
  photoUri,
  balanceEditRef,
  onSaveField,
}: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const isLineOfCredit = loan.type === 'line_of_credit';
  const isChildSupport = loan.type === 'child_support';
  const isMortgage = loan.type === 'mortgage';

  const balance = Math.max(0, loan.balanceRemaining);
  const principal = Math.max(0, loan.principal);
  const ratio = principal > 0 ? Math.min(1, isLineOfCredit ? balance / principal : (principal - balance) / principal) : 0;
  const pct = Math.round(ratio * 100);
  const frequency = loanPaymentFrequencyLabel(loan.paymentFrequency).toLowerCase();

  // Interest share of the next payment (simple periodic rate on the remaining balance).
  const periodicInterest = loan.interestRate > 0 ? (balance * loan.interestRate) / 100 / periodsPerYear(loan) : 0;
  const interest = Math.min(loan.monthlyPayment, periodicInterest);
  const capital = Math.max(0, loan.monthlyPayment - interest);

  const nextDue = loan.nextPaymentDate?.trim() ? loan.nextPaymentDate.trim() : null;
  const nextDays = nextDue ? daysUntil(nextDue) : null;

  return (
    <View>
      <View style={styles.section}>
        <SummaryCard
          label={isLineOfCredit ? 'Solde utilisé' : isChildSupport ? 'Paiement' : 'Reste à rembourser'}
          amount={formatDisplayMoneyAbsolute(isChildSupport ? loan.monthlyPayment : balance)}
          amountValue={isChildSupport ? loan.monthlyPayment : balance}
          formatAmount={formatDisplayMoneyAbsolute}
          badge={
            principal > 0 && !isChildSupport
              ? {
                  label: isLineOfCredit ? `${pct} % utilisé` : `${pct} % remboursé`,
                  color: isLineOfCredit ? (pct > 70 ? colors.danger : colors.textMuted) : colors.accentGreen,
                }
              : undefined
          }
          aside={
            <RingGauge
              progress={isChildSupport ? 0 : ratio}
              color={isLineOfCredit ? (pct > 70 ? colors.danger : colors.text) : colors.accentGreen}
              size={76}
              stroke={7}
            >
              <UserPickedIconWell icon={resolveLoanIcon(loan)} size={40} />
            </RingGauge>
          }
          stats={[
            {
              label: 'Paiement',
              value: loan.monthlyPayment > 0 ? formatDisplayMoneyAbsolute(loan.monthlyPayment) : '—',
            },
            { label: 'Taux', value: loan.interestRate > 0 ? `${loan.interestRate.toLocaleString('fr-CA')} %` : '—' },
            isLineOfCredit
              ? { label: 'Limite', value: formatDisplayMoneyAbsolute(principal) }
              : { label: 'Fin', value: shortDate(loan.endDate) ?? '—' },
          ]}
        >
          {principal > 0 && !isLineOfCredit && !isChildSupport ? (
            <View style={styles.repaidBlock}>
              <View style={[styles.track, { backgroundColor: colors.borderSubtle }]}>
                <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: colors.accentGreen }]} />
              </View>
              <View style={styles.repaidLegend}>
                <Text style={[styles.legendText, jakartaMediumText, { color: colors.textMuted }]}>
                  Remboursé {formatDisplayMoneyAbsolute(principal - balance)}
                </Text>
                <Text style={[styles.legendText, jakartaMediumText, { color: colors.textMuted }]}>
                  Emprunté {formatDisplayMoneyAbsolute(principal)}
                </Text>
              </View>
            </View>
          ) : null}
        </SummaryCard>
      </View>

      {nextDue && loan.monthlyPayment > 0 ? (
        <View style={styles.section}>
          <SectionLabel title="Prochain paiement" />
          <ListCard>
            <ListRow
              leading={<DateWell {...calendarBoxParts(nextDue)} />}
              title={recurringPaymentName ?? displayTitle}
              subtitle={[
                nextDays == null ? null : nextDays <= 0 ? "Aujourd'hui" : nextDays === 1 ? 'Demain' : `Dans ${nextDays} jours`,
                paymentAccount?.name,
              ]
                .filter(Boolean)
                .join(' · ')}
              subtitleColor={nextDays != null && nextDays <= 2 ? '#F59E0B' : undefined}
              value={`−${formatDisplayMoneyAbsolute(loan.monthlyPayment)}`}
              valueSub={frequency}
              isLast
              onPress={
                loan.recurringPaymentId
                  ? () =>
                      router.push({
                        pathname: '/payment-detail',
                        params: { id: loan.recurringPaymentId!, date: nextDue.slice(0, 10) },
                      })
                  : undefined
              }
            />
          </ListCard>
        </View>
      ) : null}

      {interest > 0 && capital > 0 ? (
        <View style={styles.section}>
          <SectionLabel title="Où va ton paiement" />
          <ListCard padding={16}>
            <SplitBar
              segments={[
                { key: 'capital', label: `Capital · ${formatDisplayMoneyAbsolute(capital)}`, value: capital, color: colors.accentGreen },
                { key: 'interest', label: `Intérêts · ${formatDisplayMoneyAbsolute(interest)}`, value: interest, color: INTEREST_TONE },
              ]}
            />
            <Text style={[styles.note, jakartaMediumText, { color: colors.textMuted }]}>
              {`${Math.round((capital / loan.monthlyPayment) * 100)} % de chaque paiement réduit ta dette. Plus le solde baisse, plus cette part augmente.`}
            </Text>
          </ListCard>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionLabel title="Évolution" />
        {isLineOfCredit && principal > 0 ? (
          <LineOfCreditCharts balance={balance} creditLimit={principal} balanceHistory={lineOfCreditBalanceHistory} />
        ) : isChildSupport ? (
          <ChildSupportBreakdownChart loan={loan} />
        ) : (
          <ListCard padding={12}>
            <LoanProgressChart
              loan={loan}
              loanTitle={displayTitle}
              transactions={transactions}
              paymentAccount={paymentAccount}
              recurringPaymentName={recurringPaymentName}
            />
          </ListCard>
        )}
        {isMortgage ? (
          <View style={styles.mortgageCharts}>
            <MortgageDetailCharts loan={loan} />
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionLabel title="Mettre à jour" />
        <ListCard>
          {(
            [
              { field: 'balanceRemaining', icon: 'wallet-outline', label: isLineOfCredit ? 'Solde utilisé' : 'Solde restant', value: String(balance), type: 'money' },
              { field: 'monthlyPayment', icon: 'repeat', label: 'Paiement', value: String(loan.monthlyPayment), type: 'money' },
              { field: 'interestRate', icon: 'trending-up-outline', label: "Taux d'intérêt (%)", value: String(loan.interestRate), type: 'text' },
            ] as const
          ).map((row, index, rows) => (
            <View
              key={row.field}
              style={[
                styles.editRow,
                index < rows.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.containerBorder,
                },
              ]}
            >
              <IconWell icon={row.icon} size={32} />
              <FitText style={[styles.editLabel, jakartaSemiboldText, { color: colors.text }]}>
                {row.label}
              </FitText>
              <EditableField
                editHandleRef={row.field === 'balanceRemaining' ? balanceEditRef : undefined}
                type={row.type}
                value={row.value}
                onSave={(raw) => onSaveField(row.field, raw)}
                accessibilityLabel={`Modifier ${row.label}`}
                textStyle={row.type === 'money' ? detailRowValueMoney : styles.rateValue}
                containerStyle={styles.editField}
                align="right"
              />
            </View>
          ))}
        </ListCard>
      </View>

      {detailSections.length > 0 || detailFootnote ? (
        <View style={styles.section}>
          <SectionLabel title="Fiche du prêt" />
          <ListCard padding={14}>
            <DetailSectionsList sections={detailSections} colors={colors} footnote={detailFootnote} />
          </ListCard>
        </View>
      ) : null}

      {photoUri ? (
        <View style={styles.bannerWrap}>
          <Image source={{ uri: photoUri }} style={styles.bannerImage} contentFit="cover" accessibilityLabel="Photo du bien" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: SECTION_GAP + spacing.sm },
  repaidBlock: { marginTop: 4, gap: 6 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  repaidLegend: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  legendText: { fontSize: 11.5 },
  note: { fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  mortgageCharts: { marginTop: spacing.md },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, height: 56 },
  editLabel: { fontSize: 14, flexShrink: 1 },
  editField: { flexGrow: 1, flexShrink: 0, alignItems: 'flex-end' },
  rateValue: { fontSize: 15 },
  bannerWrap: { borderRadius: radius.xl, overflow: 'hidden', height: 168, marginBottom: SECTION_GAP },
  bannerImage: { width: '100%', height: '100%' },
});

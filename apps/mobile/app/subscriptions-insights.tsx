import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FixedScreenHeader,
  fixedHeaderScrollStyle,
  fixedHeaderScreenStyle,
} from '@/components/FixedScreenHeader';
import { EmptyRow, IconWell, ListCard, ListRow, SECTION_GAP, SectionLabel, SummaryCard } from '@/components/kit';
import { PageTransition } from '@/components/PageTransition';
import {
  PaymentDetailSheet,
  type PaymentDetailPayload,
} from '@/components/PaymentDetailSheet';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import {
  FLOATING_NAV_CONTENT_PADDING,
  PAGE_PADDING_HORIZONTAL,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { getLoans, getRecurringPayments } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { getMerchantLogoUrl } from '@/lib/merchantLogo';
import { ensureDbReady } from '@/lib/init';
import { frequencyLabel } from '@/lib/recurringPaymentsForm';
import {
  buildLoanByRecurringPaymentId,
  resolveRecurringPaymentDisplayIconById,
} from '@/lib/recurringPaymentPresentation';
import { analyzeSubscriptions } from '@/lib/subscriptionAnalysis';
import { useAppTheme } from '@/lib/themeContext';
import type { Loan, RecurringPayment } from '@/types';

function formatNextDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
}

export default function SubscriptionsInsightsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentDetail, setPaymentDetail] = useState<PaymentDetailPayload | null>(null);

  const load = useCallback(async () => {
    await ensureDbReady();
    const [nextPayments, nextLoans] = await Promise.all([getRecurringPayments(), getLoans()]);
    setPayments(nextPayments);
    setLoans(nextLoans);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRefreshOnFocus(load, { skipInitial: true });
  useEffect(() => dataEvents.subscribe(() => void load()), [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const loanByRecurringPaymentId = useMemo(
    () => buildLoanByRecurringPaymentId(loans),
    [loans],
  );

  const loanRecurringIds = useMemo(
    () => new Set(loanByRecurringPaymentId.keys()),
    [loanByRecurringPaymentId],
  );

  const analysis = useMemo(
    () => analyzeSubscriptions(payments, loanRecurringIds),
    [loanRecurringIds, payments],
  );

  const openPayment = useCallback(
    (payment: RecurringPayment) => {
      tapHaptic();
      setPaymentDetail({
        name: payment.name,
        amount: payment.amount,
        account: payment.accountLabel,
        recurring: true,
        sourceId: payment.id,
        kind: payment.kind ?? 'payment',
        dateLabel: formatNextDate(payment.nextDate),
        logoUrl: payment.logoUrl,
        icon: payment.icon,
        color: payment.color,
        frequencyLabel: frequencyLabel(payment.frequency),
        frequency: payment.frequency,
        active: payment.active,
        categoryName: payment.categoryName ?? null,
        categoryId: payment.categoryId ?? null,
      });
    },
    [],
  );

  return (
    <PageTransition>
      <View style={[fixedHeaderScreenStyle, styles.screen, { backgroundColor: colors.background }]}>
        <FixedScreenHeader title="Abonnements" onBack={() => router.back()} />
        <ScrollView
          style={fixedHeaderScrollStyle}
          contentContainerStyle={{
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl,
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.section}>
            <SummaryCard
              label="Coût mensuel estimé"
              amount={formatDisplayMoneyAbsolute(analysis.monthlyTotal)}
              stats={[
                { label: 'Abonnements', value: String(analysis.count) },
                { label: 'Par année', value: formatDisplayMoneyAbsolute(analysis.yearlyTotal) },
              ]}
            />
          </View>

          <View style={styles.section}>
            <SectionLabel title="Abonnements" />
            <ListCard>
              {analysis.items.length === 0 ? (
                <EmptyRow label="Aucun abonnement détecté — ajoute-en depuis l’Agenda" />
              ) : (
                analysis.items.map(({ payment, monthlyEquivalent }, index) => {
                  const nextLabel = formatNextDate(payment.nextDate);
                  const metaParts = [
                    frequencyLabel(payment.frequency),
                    nextLabel,
                  ].filter(Boolean);
                  return (
                    <ListRow
                      key={payment.id}
                      leading={
                        <UserPickedIconWell
                          icon={resolveRecurringPaymentDisplayIconById(payment, loanByRecurringPaymentId)}
                          color={payment.color}
                          size={40}
                          wellGlyphWhite
                          logoUrl={payment.logoUrl?.trim() || getMerchantLogoUrl(payment.name) || null}
                          merchantLabel={payment.name}
                        />
                      }
                      title={payment.name}
                      subtitle={metaParts.join(' · ')}
                      value={`−${formatDisplayMoneyAbsolute(monthlyEquivalent)}`}
                      valueSub="/ mois"
                      isLast={index === analysis.items.length - 1}
                      accessibilityLabel={`Détail ${payment.name}`}
                      onPress={() => openPayment(payment)}
                    />
                  );
                })
              )}
            </ListCard>
          </View>

          {analysis.topCategories.length > 0 ? (
            <View style={styles.section}>
              <SectionLabel title="Par catégorie" />
              <ListCard>
                {analysis.topCategories.map((category, index) => (
                  <ListRow
                    key={category.categoryId ?? category.categoryName}
                    title={category.categoryName}
                    subtitle={`${category.count} service${category.count > 1 ? 's' : ''}`}
                    value={formatDisplayMoneyAbsolute(category.monthlyTotal)}
                    valueSub="/ mois"
                    progress={analysis.monthlyTotal > 0 ? category.monthlyTotal / analysis.monthlyTotal : 0}
                    progressColor={colors.primary}
                    isLast={index === analysis.topCategories.length - 1}
                  />
                ))}
              </ListCard>
            </View>
          ) : null}

          {analysis.insights.length > 0 ? (
            <View style={styles.section}>
              <SectionLabel title="À retenir" />
              <ListCard>
                {analysis.insights.map((insight, index) => (
                  <View
                    key={insight}
                    style={[
                      styles.insightRow,
                      index < analysis.insights.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.containerBorder,
                      },
                    ]}
                  >
                    <IconWell icon="bulb-outline" size={32} />
                    <Text style={[styles.insightText, { color: colors.textSecondary }]}>{insight}</Text>
                  </View>
                ))}
              </ListCard>
            </View>
          ) : null}
        </ScrollView>

        <PaymentDetailSheet
          detail={paymentDetail}
          onClose={() => setPaymentDetail(null)}
          onDeleted={() => {
            setPaymentDetail(null);
            void load();
          }}
        />
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  section: { marginBottom: SECTION_GAP + spacing.sm },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  insightText: { ...typographyKit.metaMedium, flexShrink: 1, lineHeight: 19 },
});

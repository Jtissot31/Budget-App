import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FixedScreenHeader } from '@/components/FixedScreenHeader';
import { OnyxContainer } from '@/components/OnyxContainer';
import { PageTransition } from '@/components/PageTransition';
import {
  PaymentDetailSheet,
  type PaymentDetailPayload,
} from '@/components/PaymentDetailSheet';
import { TransactionAmountLabel } from '@/components/TransactionAmountLabel';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import {
  FLOATING_NAV_CONTENT_PADDING,
  moneyAmountTypography,
  PAGE_PADDING_HORIZONTAL,
  PORTFOLIO_SECTION_GAP,
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

const ROW_ICON_SIZE = 40;

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
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <FixedScreenHeader title="Analyse abonnements" onBack={() => router.back()} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl,
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
            gap: PORTFOLIO_SECTION_GAP,
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
          <OnyxContainer style={styles.summaryCard}>
            <Text style={[typographyKit.eyebrow, { color: colors.textMuted }]}>
              Coût mensuel estimé
            </Text>
            <Text style={[styles.summaryAmount, { color: colors.text }]}>
              {formatDisplayMoneyAbsolute(analysis.monthlyTotal)}
            </Text>
            <View style={styles.summaryMetaRow}>
              <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>
                {analysis.count} abonnement{analysis.count > 1 ? 's' : ''}
              </Text>
              <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>
                {formatDisplayMoneyAbsolute(analysis.yearlyTotal)} / an
              </Text>
            </View>
          </OnyxContainer>

          {analysis.topCategories.length > 0 ? (
            <View style={styles.section}>
              <Text style={[typographyKit.sectionTitle, { color: colors.text }]}>
                Catégories
              </Text>
              <View style={styles.categoryList}>
                {analysis.topCategories.map((category) => (
                  <OnyxContainer
                    key={category.categoryId ?? category.categoryName}
                    style={styles.categoryCard}
                  >
                    <View style={styles.categoryCopy}>
                      <Text
                        style={[typographyKit.listPrimary, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {category.categoryName}
                      </Text>
                      <Text style={[typographyKit.microMedium, { color: colors.textMuted }]}>
                        {category.count} service{category.count > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={[moneyAmountTypography({ tier: 'row' }), { color: colors.text }]}>
                      {formatDisplayMoneyAbsolute(category.monthlyTotal)}
                    </Text>
                  </OnyxContainer>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[typographyKit.sectionTitle, { color: colors.text }]}>
              Insights
            </Text>
            <View style={styles.insightList}>
              {analysis.insights.map((insight) => (
                <OnyxContainer key={insight} style={styles.insightCard}>
                  <AppIcon
                    family="ionicons"
                    name="bulb-outline"
                    size={18}
                    color={colors.textMuted}
                  />
                  <Text style={[styles.insightText, { color: colors.textSecondary }]}>
                    {insight}
                  </Text>
                </OnyxContainer>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[typographyKit.sectionTitle, { color: colors.text }]}>
              Abonnements
            </Text>
            {analysis.items.length === 0 ? (
              <OnyxContainer style={styles.emptyCard}>
                <Text style={[typographyKit.body, { color: colors.textMuted }]}>
                  Aucun abonnement récurrent détecté. Tu peux en ajouter depuis l’Agenda.
                </Text>
              </OnyxContainer>
            ) : (
              <View style={styles.subscriptionList}>
                {analysis.items.map(({ payment, monthlyEquivalent }) => {
                  const nextLabel = formatNextDate(payment.nextDate);
                  const metaParts = [
                    frequencyLabel(payment.frequency),
                    payment.categoryName?.trim() || null,
                    nextLabel ? `prochain ${nextLabel}` : null,
                  ].filter(Boolean);

                  return (
                    <Pressable
                      key={payment.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Détail ${payment.name}`}
                      onPress={() => openPayment(payment)}
                      style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
                    >
                      <OnyxContainer style={onyxContainerRowLayoutStyle()}>
                        <UserPickedIconWell
                          icon={resolveRecurringPaymentDisplayIconById(
                            payment,
                            loanByRecurringPaymentId,
                          )}
                          color={payment.color}
                          size={ROW_ICON_SIZE}
                          wellGlyphWhite
                          logoUrl={
                            payment.logoUrl?.trim() || getMerchantLogoUrl(payment.name) || null
                          }
                          merchantLabel={payment.name}
                        />
                        <View style={styles.rowCopy}>
                          <Text
                            style={[typographyKit.listPrimary, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {payment.name}
                          </Text>
                          <Text
                            style={[typographyKit.microMedium, { color: colors.textMuted }]}
                            numberOfLines={1}
                          >
                            {metaParts.join(' · ')}
                          </Text>
                        </View>
                        <TransactionAmountLabel
                          amount={formatDisplayMoneyAbsolute(monthlyEquivalent)}
                          direction="expense"
                          color={colors.text}
                          textStyle={moneyAmountTypography({ tier: 'row' })}
                        />
                      </OnyxContainer>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
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
  scroll: { flex: 1 },
  pressed: { opacity: 0.82 },
  summaryCard: {
    padding: ONYX_CONTAINER.padding.card,
    gap: spacing.sm,
  },
  summaryAmount: {
    ...moneyAmountTypography({ tier: 'stat' }),
  },
  summaryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  categoryList: {
    gap: ONYX_CONTAINER.listGap,
  },
  categoryCard: {
    ...onyxContainerRowLayoutStyle(),
    justifyContent: 'space-between',
  },
  categoryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  insightList: {
    gap: ONYX_CONTAINER.listGap,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: ONYX_CONTAINER.padding.row,
  },
  insightText: {
    ...typographyKit.body,
    flex: 1,
    lineHeight: 20,
  },
  subscriptionList: {
    gap: ONYX_CONTAINER.listGap,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  emptyCard: {
    padding: ONYX_CONTAINER.padding.card,
  },
});

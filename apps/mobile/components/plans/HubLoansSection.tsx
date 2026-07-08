import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { HubSectionHeader } from '@/components/plans/HubSectionHeader';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { floatingGlassButtonPressed } from '@/constants/floatingGlassButton';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { getLoans } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { resolveLoanIcon } from '@/lib/loanIcons';
import {
  formatLoanDebtAmount,
  formatLoanDisplayTitle,
  loanTypeBadgeLabel,
} from '@/lib/loanPresentation';
import { computeLineOfCreditUtilization } from '@/lib/loanDetailSections';
import { moneyAmountTypography, radius, spacing, typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import type { Loan } from '@/types';

const PREVIEW_LIMIT = 3;

export function HubLoansSection() {
  const router = useRouter();
  const { colors, isLight } = useAppTheme();
  const [loans, setLoans] = useState<Loan[]>([]);

  const load = useCallback(async () => {
    setLoans(await getLoans());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);

  const totalDebt = loans.reduce((sum, loan) => sum + Math.max(loan.balanceRemaining, 0), 0);
  const previewLoans = loans.slice(0, PREVIEW_LIMIT);
  const hasMore = loans.length > PREVIEW_LIMIT;

  const openLoan = useCallback(
    (loan: Loan) => {
      tapHaptic();
      router.push({ pathname: '/loan-detail', params: { loanId: loan.id } });
    },
    [router],
  );

  const openPortfolioDebts = useCallback(() => {
    tapHaptic();
    router.push('/(tabs)/accounts');
  }, [router]);

  return (
    <View style={styles.section}>
      <HubSectionHeader
        eyebrow="Obligations"
        title="Mes prêts et obligations"
        trailing={
          loans.length > 0 ? (
            <View
              style={[
                styles.totalBadge,
                {
                  backgroundColor: colors.containerBackground,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <Text
                style={[
                  moneyAmountTypography({ tier: 'row', fontSize: 12 }),
                  { color: colors.text },
                ]}
              >
                {formatDisplayMoneyAbsolute(totalDebt)}
              </Text>
            </View>
          ) : null
        }
      />

      {loans.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Aucun prêt enregistré. Ajoutes-en un pour le suivre ici.
        </Text>
      ) : (
        <View style={styles.cardList}>
          {previewLoans.map((loan) => {
            const loanType = loan.type ?? 'personal_loan';
            const displayTitle = formatLoanDisplayTitle(loan);
            const isLineOfCredit = loanType === 'line_of_credit';
            const utilization = isLineOfCredit ? computeLineOfCreditUtilization(loan) : null;

            return (
              <Pressable
                key={loan.id}
                accessibilityRole="button"
                accessibilityLabel={`Voir le détail de ${displayTitle}`}
                onPress={() => openLoan(loan)}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <PlanFinanceContainer style={styles.loanRow}>
                  <UserPickedIconWell icon={resolveLoanIcon(loan)} size={44} wellGlyphWhite />
                  <View style={styles.loanCopy}>
                    <Text style={[styles.loanType, { color: colors.textMuted }]} numberOfLines={1}>
                      {loanTypeBadgeLabel(loanType)}
                    </Text>
                    <Text style={[styles.loanName, { color: colors.text }]} numberOfLines={2}>
                      {displayTitle}
                    </Text>
                  </View>
                  <View style={styles.loanAmountCol}>
                    <Text style={[styles.loanAmount, moneyAmountTypography({ tier: 'row' }), { color: colors.text }]}>
                      {formatLoanDebtAmount(loan.balanceRemaining)}
                    </Text>
                    {utilization && loan.principal > 0 ? (
                      <Text
                        style={[
                          styles.utilCaption,
                          { color: utilization.utilPct > 80 ? colors.danger : colors.textMuted },
                        ]}
                      >
                        {Math.round(utilization.utilPct)} %
                      </Text>
                    ) : null}
                  </View>
                </PlanFinanceContainer>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.actions}>
        {hasMore ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voir tous les prêts"
            onPress={openPortfolioDebts}
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          >
            <Text style={[styles.linkLabel, { color: colors.textSecondary }]}>Voir tout dans Portefeuille</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajouter un prêt ou une obligation"
          onPress={openPortfolioDebts}
          style={({ pressed }) => [
            styles.addCta,
            {
              backgroundColor: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 18, 18, 0.92)',
              borderColor: colors.borderStrong,
            },
            pressed && floatingGlassButtonPressed,
          ]}
        >
          <Ionicons name="add" size={18} color={colors.textSecondary} />
          <Text style={[styles.addCtaLabel, { color: colors.text }]}>Ajouter</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  totalBadge: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  cardList: {
    gap: spacing.sm,
  },
  loanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.md,
    padding: spacing.md,
  },
  loanCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  loanType: {
    ...typographyKit.caption,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  loanName: {
    ...typographyKit.rowTitle,
  },
  loanAmount: {
    flexShrink: 0,
  },
  loanAmountCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
  utilCaption: {
    ...typographyKit.caption,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  emptyText: {
    ...typographyKit.body,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 36,
  },
  linkLabel: {
    ...typographyKit.caption,
  },
  addCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addCtaLabel: {
    ...typographyKit.caption,
  },
  pressed: {
    opacity: 0.82,
  },
});

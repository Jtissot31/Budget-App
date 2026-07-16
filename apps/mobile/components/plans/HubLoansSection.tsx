import { useCallback, useEffect, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { HubSectionHeader } from '@/components/plans/HubSectionHeader';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { floatingGlassButtonPressed } from '@/constants/floatingGlassButton';
import {
  planFinanceContainerPressedStyle,
  planFinanceContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import { getLoans } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { resolveLoanIcon } from '@/lib/loanIcons';
import {
  formatLoanDebtAmount,
  formatLoanObligationName,
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

  const previewLoans = loans.slice(0, PREVIEW_LIMIT);

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
      <HubSectionHeader eyebrow="Obligations" title="Mes prêts et obligations" />

      {loans.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Aucun prêt enregistré. Ajoutes-en un pour le suivre ici.
        </Text>
      ) : (
        <View style={styles.cardList}>
          {previewLoans.map((loan) => {
            const loanType = loan.type ?? 'personal_loan';
            const displayTitle = formatLoanObligationName(loan);
            const isLineOfCredit = loanType === 'line_of_credit';
            const utilization = isLineOfCredit ? computeLineOfCreditUtilization(loan) : null;

            return (
              <Pressable
                key={loan.id}
                accessibilityRole="button"
                accessibilityLabel={`Voir le détail de ${displayTitle}`}
                onPress={() => openLoan(loan)}
                style={({ pressed }) => [pressed && planFinanceContainerPressedStyle()]}
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
          <AppIcon family="ionicons" name="add" size={18} color={colors.textSecondary} />
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
  cardList: {
    gap: spacing.sm,
  },
  loanRow: planFinanceContainerRowLayoutStyle(),
  loanCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  loanType: {
    ...typographyKit.metaMedium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  loanName: {
    ...typographyKit.bodyBold,
    letterSpacing: -0.2,
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
    ...typographyKit.metaMedium,
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
    ...typographyKit.bodyMedium,
  },
});

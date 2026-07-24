import { useCallback, useEffect, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { HubSectionHeader, HUB_SECTION_INNER_GAP } from '@/components/plans/HubSectionHeader';
import { OnyxContainer } from '@/components/OnyxContainer';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
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
import { moneyAmountTypography, spacing, typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import type { Loan } from '@/types';

const PREVIEW_LIMIT = 3;
const LOAN_ICON_SIZE = 40;

export function HubLoansSection() {
  const router = useRouter();
  const { colors } = useAppTheme();
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
      <HubSectionHeader eyebrow="Obligations" title="Prêts et dettes" />

      {loans.length === 0 ? null : (
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
                style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
              >
                <OnyxContainer style={styles.loanRow}>
                  <UserPickedIconWell
                    icon={resolveLoanIcon(loan)}
                    size={LOAN_ICON_SIZE}
                    wellGlyphWhite
                  />
                  <View style={styles.loanCopy}>
                    <Text style={[styles.loanType, { color: colors.textMuted }]} numberOfLines={1}>
                      {loanTypeBadgeLabel(loanType)}
                    </Text>
                    <Text style={[styles.loanName, { color: colors.text }]} numberOfLines={2}>
                      {displayTitle}
                    </Text>
                  </View>
                  <View style={styles.loanAmountCol}>
                    <Text
                      style={[
                        styles.loanAmount,
                        moneyAmountTypography({ tier: 'row' }),
                        { color: colors.text },
                      ]}
                    >
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
                </OnyxContainer>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajouter un prêt ou une obligation"
        onPress={openPortfolioDebts}
        style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
      >
        <OnyxContainer style={styles.addCta}>
          <View style={[styles.addIconWell, { backgroundColor: colors.input }]}>
            <AppIcon family="ionicons" name="add" size={18} color={colors.textSecondary} />
          </View>
          <Text style={[styles.addLabel, typographyKit.rowTitle, { color: colors.text }]}>
            Ajouter une obligation
          </Text>
          <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
        </OnyxContainer>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: HUB_SECTION_INNER_GAP,
  },
  cardList: {
    gap: ONYX_CONTAINER.listGap,
  },
  loanRow: onyxContainerRowLayoutStyle(),
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
  addCta: {
    ...onyxContainerRowLayoutStyle(),
    minHeight: 56,
  },
  addIconWell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addLabel: {
    flex: 1,
    minWidth: 0,
  },
});

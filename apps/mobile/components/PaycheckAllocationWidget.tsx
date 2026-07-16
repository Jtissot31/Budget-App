import { useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { useRouter } from 'expo-router';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import {
  PLAN_FINANCE_CONTAINER,
  planFinanceContainerPressedStyle,
  planFinanceContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import {
  jakartaMediumText,
  jakartaSemiboldText,
  moneyAmountTypography,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import {
  getPaycheckAvailableAmount,
  PAYCHECK_MOCK_ALLOCATIONS,
  PAYCHECK_MOCK_AMOUNT,
} from '@/lib/paycheckAllocation';
import { useAppTheme } from '@/lib/themeContext';

function formatEnvelopeCount(count: number): string {
  return count === 1 ? '1 enveloppe' : `${count} enveloppes`;
}

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const AVAILABLE_GREEN = '#4ADE80';

export function PaycheckAllocationWidget() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);

  const availableAmount = useMemo(
    () => getPaycheckAvailableAmount(PAYCHECK_MOCK_AMOUNT, PAYCHECK_MOCK_ALLOCATIONS),
    [],
  );
  const envelopeLabel = formatEnvelopeCount(PAYCHECK_MOCK_ALLOCATIONS.length);
  const paycheckLabel = formatDisplayMoneyAbsolute(PAYCHECK_MOCK_AMOUNT);
  const availableLabel = formatDisplayMoneyAbsolute(availableAmount);
  const collapsedAccessibilityLabel = `Paie reçue, ${paycheckLabel}, ${envelopeLabel}, ${availableLabel} disponible`;

  const toggleExpanded = () => {
    tapHaptic();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const openAllocationScreen = () => {
    tapHaptic();
    router.push('/paycheck-allocation');
  };

  if (!expanded) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={collapsedAccessibilityLabel}
        accessibilityHint="Afficher la répartition détaillée"
        accessibilityState={{ expanded: false }}
        onPress={toggleExpanded}
        style={({ pressed }) => [pressed && planFinanceContainerPressedStyle()]}
      >
        <PlanFinanceContainer style={planFinanceContainerRowLayoutStyle()}>
          <View
            style={[
              styles.collapsedIconWell,
              {
                backgroundColor: `${AVAILABLE_GREEN}12`,
                borderColor: `${AVAILABLE_GREEN}28`,
              },
            ]}
          >
            <AppIcon family="ionicons" name="wallet-outline" size={14} color={AVAILABLE_GREEN} />
          </View>
          <View style={styles.collapsedCopy}>
            <Text style={[styles.collapsedEyebrow, { color: colors.textMuted }, jakartaMediumText]}>
              Paie reçue
            </Text>
            <Text style={[styles.collapsedMeta, typographyKit.metaMedium]} numberOfLines={1}>
              <Text style={[styles.collapsedAmount, { color: colors.text }, jakartaSemiboldText]}>
                {paycheckLabel}
              </Text>
              <Text style={{ color: colors.textMuted }}>{` · ${envelopeLabel} · `}</Text>
              <Text style={{ color: AVAILABLE_GREEN }}>{`${availableLabel} dispo`}</Text>
            </Text>
          </View>
          <AppIcon
            family="ionicons"
            name="chevron-down"
            size={16}
            color={colors.textMuted}
            style={styles.chevron}
          />
        </PlanFinanceContainer>
      </Pressable>
    );
  }

  return (
    <PlanFinanceContainer style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Répartition de la paie"
        accessibilityHint="Réduire la carte"
        accessibilityState={{ expanded: true }}
        onPress={toggleExpanded}
        style={({ pressed }) => [styles.headerRow, pressed && planFinanceContainerPressedStyle()]}
      >
        <View style={styles.headerCopy}>
          <Text style={[styles.headerLabel, { color: colors.textMuted }, jakartaMediumText]}>
            Répartition de la paie
          </Text>
          <Text style={[styles.paycheckAmount, { color: colors.text }, moneyAmountTypography({ tier: 'stat' })]}>
            {formatDisplayMoneyAbsolute(PAYCHECK_MOCK_AMOUNT)}
          </Text>
        </View>
        <AppIcon
          family="ionicons"
          name="chevron-up"
          size={18}
          color={colors.textMuted}
          style={styles.chevron}
        />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ouvrir la répartition de la paie"
        onPress={openAllocationScreen}
        style={({ pressed }) => [styles.detailBody, pressed && planFinanceContainerPressedStyle()]}
      >
        <View style={styles.allocations}>
          {PAYCHECK_MOCK_ALLOCATIONS.map((line) => (
            <View key={line.id} style={styles.allocationRow}>
              <Text
                style={[styles.allocationLabel, { color: colors.text }, jakartaMediumText]}
                numberOfLines={1}
              >
                {line.label}
              </Text>
              <Text style={[styles.allocationAmount, { color: colors.text }, moneyAmountTypography({ tier: 'row' })]}>
                {formatDisplayMoneyAbsolute(line.amount)}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.availableRow, { borderTopColor: colors.containerBorder }]}>
          <Text style={[styles.availableLabel, { color: colors.text }, jakartaSemiboldText]}>
            Disponible
          </Text>
          <Text style={[styles.availableAmount, { color: AVAILABLE_GREEN }, moneyAmountTypography({ tier: 'card' })]}>
            {formatDisplayMoneyAbsolute(availableAmount)}
          </Text>
        </View>
      </Pressable>
    </PlanFinanceContainer>
  );
}

const styles = StyleSheet.create({
  collapsedIconWell: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  collapsedCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  collapsedEyebrow: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  collapsedMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  collapsedAmount: {
    fontSize: 13,
    lineHeight: 18,
  },
  chevron: {
    opacity: 0.55,
    flexShrink: 0,
  },
  card: {
    alignSelf: 'stretch',
    padding: PLAN_FINANCE_CONTAINER.padding.card,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  headerLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  paycheckAmount: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  detailBody: {
    gap: spacing.md,
  },
  allocations: {
    gap: spacing.sm,
  },
  allocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  allocationLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  allocationAmount: {
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  availableLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  availableAmount: {
    fontSize: 16,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
});

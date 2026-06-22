import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { useRouter } from 'expo-router';
import {
  jakartaBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  spacing,
} from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import {
  getPaycheckAvailableAmount,
  PAYCHECK_MOCK_ALLOCATIONS,
  PAYCHECK_MOCK_AMOUNT,
} from '@/lib/paycheckAllocation';
import { useAppTheme } from '@/lib/themeContext';

const AVAILABLE_GREEN = '#4ADE80';

export function PaycheckAllocationWidget() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const availableAmount = useMemo(
    () => getPaycheckAvailableAmount(PAYCHECK_MOCK_AMOUNT, PAYCHECK_MOCK_ALLOCATIONS),
    [],
  );

  const openAllocationScreen = () => {
    tapHaptic();
    router.push('/paycheck-allocation');
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ouvrir la répartition de la paie"
      onPress={openAllocationScreen}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.containerBackground,
          borderColor: colors.containerBorder,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerLabel, { color: colors.textMuted }, jakartaMediumText]}>
            Répartition de la paie
          </Text>
          <Text style={[styles.paycheckAmount, { color: colors.text }, jakartaBoldText]}>
            {formatDisplayMoneyAbsolute(PAYCHECK_MOCK_AMOUNT)}
          </Text>
        </View>
        <AppIcon family="ionicons" name="chevron-forward" size={18} color={colors.textMuted} />
      </View>

      <View style={styles.allocations}>
        {PAYCHECK_MOCK_ALLOCATIONS.map((line) => (
          <View key={line.id} style={styles.allocationRow}>
            <Text
              style={[styles.allocationLabel, { color: colors.text }, jakartaMediumText]}
              numberOfLines={1}
            >
              {line.label}
            </Text>
            <Text style={[styles.allocationAmount, { color: colors.text }, jakartaSemiboldText]}>
              {formatDisplayMoneyAbsolute(line.amount)}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.availableRow, { borderTopColor: colors.containerBorder }]}>
        <Text style={[styles.availableLabel, { color: colors.text }, jakartaSemiboldText]}>
          Disponible
        </Text>
        <Text style={[styles.availableAmount, { color: AVAILABLE_GREEN }, jakartaBoldText]}>
          {formatDisplayMoneyAbsolute(availableAmount)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
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
  pressed: {
    opacity: 0.78,
  },
});

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon } from '@/components/icons/AppIcon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { PageTransition } from '@/components/PageTransition';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  jakartaBoldText,
  jakartaExtraBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  spacing,
  typography,
} from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import {
  getPaycheckAllocatedTotal,
  getPaycheckAvailableAmount,
  PAYCHECK_MOCK_ALLOCATIONS,
  PAYCHECK_MOCK_AMOUNT,
  PAYCHECK_MOCK_SOURCE_ACCOUNT,
  type PaycheckAllocationLine,
} from '@/lib/paycheckAllocation';
import { useAppTheme } from '@/lib/themeContext';

const AVAILABLE_GREEN = '#4ADE80';

type TransferRowProps = {
  line: PaycheckAllocationLine;
  checked: boolean;
  onToggle: () => void;
};

function TransferConfirmRow({ line, checked, onToggle }: TransferRowProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`Virement vers ${line.label}, ${formatDisplayMoneyAbsolute(line.amount)}`}
      onPress={() => {
        tapHaptic();
        onToggle();
      }}
      style={({ pressed }) => [
        styles.transferCard,
        {
          backgroundColor: checked ? colors.surface : colors.containerBackground,
          borderColor: checked ? colors.borderStrong : colors.containerBorder,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.transferIconWell, { backgroundColor: colors.input }]}>
        <AppIcon family="material-community" name={line.icon} size={20} color={colors.textSecondary} />
      </View>

      <View style={styles.transferCopy}>
        <Text style={[styles.transferTitle, { color: colors.text }, jakartaSemiboldText]} numberOfLines={1}>
          {line.label}
        </Text>
        <View style={styles.transferRoute}>
          <Text style={[styles.transferRouteText, { color: colors.textMuted }, jakartaMediumText]} numberOfLines={1}>
            {PAYCHECK_MOCK_SOURCE_ACCOUNT}
          </Text>
          <AppIcon family="ionicons" name="arrow-forward" size={12} color={colors.textMuted} />
          <Text style={[styles.transferRouteText, { color: colors.textMuted }, jakartaMediumText]} numberOfLines={1}>
            {line.destinationLabel}
          </Text>
        </View>
        <Text style={[styles.transferAmount, { color: colors.text }, jakartaBoldText]}>
          {formatDisplayMoneyAbsolute(line.amount)}
        </Text>
      </View>

      {checked ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
      ) : (
        <View style={[styles.selectionRing, { borderColor: colors.borderStrong }]} />
      )}
    </Pressable>
  );
}

function AllocationBreakdownBar({
  lines,
  availableAmount,
}: {
  lines: readonly PaycheckAllocationLine[];
  availableAmount: number;
}) {
  const { colors } = useAppTheme();
  const total = PAYCHECK_MOCK_AMOUNT;

  const segments = useMemo(() => {
    const allocationSegments = lines.map((line) => ({
      key: line.id,
      flex: line.amount,
      color: line.segmentColor,
    }));
    if (availableAmount > 0) {
      allocationSegments.push({
        key: 'available',
        flex: availableAmount,
        color: AVAILABLE_GREEN,
      });
    }
    return allocationSegments;
  }, [availableAmount, lines]);

  return (
    <View style={styles.breakdownBlock}>
      <View style={[styles.stackBar, { backgroundColor: colors.input }]}>
        {segments.map((segment) =>
          segment.flex > 0 ? (
            <View
              key={segment.key}
              style={[styles.stackSegment, { backgroundColor: segment.color, flex: segment.flex }]}
            />
          ) : null,
        )}
      </View>

      <View style={styles.legend}>
        {lines.map((line) => (
          <View key={line.id} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: line.segmentColor }]} />
            <Text style={[styles.legendLabel, { color: colors.text }, jakartaMediumText]} numberOfLines={1}>
              {line.label}
            </Text>
            <Text style={[styles.legendValue, { color: colors.textMuted }, jakartaMediumText]}>
              {Math.round((line.amount / total) * 100)} %
            </Text>
          </View>
        ))}
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: AVAILABLE_GREEN }]} />
          <Text style={[styles.legendLabel, { color: colors.text }, jakartaMediumText]}>Disponible</Text>
          <Text style={[styles.legendValue, { color: AVAILABLE_GREEN }, jakartaSemiboldText]}>
            {Math.round((availableAmount / total) * 100)} %
          </Text>
        </View>
      </View>
    </View>
  );
}

export function PaycheckAllocationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(PAYCHECK_MOCK_ALLOCATIONS.map((line) => line.id)),
  );
  const [confirmed, setConfirmed] = useState(false);

  const availableAmount = getPaycheckAvailableAmount(PAYCHECK_MOCK_AMOUNT, PAYCHECK_MOCK_ALLOCATIONS);
  const allocatedTotal = getPaycheckAllocatedTotal(PAYCHECK_MOCK_ALLOCATIONS);

  const selectedLines = useMemo(
    () => PAYCHECK_MOCK_ALLOCATIONS.filter((line) => selectedIds.has(line.id)),
    [selectedIds],
  );
  const selectedTotal = getPaycheckAllocatedTotal(selectedLines);
  const allSelected = selectedIds.size === PAYCHECK_MOCK_ALLOCATIONS.length;

  const toggleLine = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    tapHaptic();
    setSelectedIds((current) =>
      current.size === PAYCHECK_MOCK_ALLOCATIONS.length
        ? new Set()
        : new Set(PAYCHECK_MOCK_ALLOCATIONS.map((line) => line.id)),
    );
  };

  const handleConfirm = () => {
    if (selectedLines.length === 0 || confirmed) return;
    successHaptic();
    setConfirmed(true);
    setTimeout(() => {
      router.back();
    }, 900);
  };

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.md }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={() => {
              tapHaptic();
              router.back();
            }}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }, jakartaExtraBoldText]} numberOfLines={1}>
            Répartition de la paie
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 120, 140) },
          ]}
        >
          <View
            style={[
              styles.heroCard,
              { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
            ]}
          >
            <DashboardSectionLabel>Paie reçue aujourd&apos;hui</DashboardSectionLabel>
            <Text style={[styles.heroAmount, { color: colors.text }, jakartaBoldText]}>
              {formatDisplayMoneyAbsolute(PAYCHECK_MOCK_AMOUNT)}
            </Text>
            <Text style={[styles.heroSource, { color: colors.textMuted }, jakartaMediumText]}>
              Déposé sur {PAYCHECK_MOCK_SOURCE_ACCOUNT}
            </Text>
          </View>

          <View
            style={[
              styles.breakdownCard,
              { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }, jakartaSemiboldText]}>
              Répartition suggérée
            </Text>
            <AllocationBreakdownBar lines={PAYCHECK_MOCK_ALLOCATIONS} availableAmount={availableAmount} />
            <View style={[styles.summaryRow, { borderTopColor: colors.containerBorder }]}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }, jakartaMediumText]}>
                Alloué aux enveloppes
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }, jakartaSemiboldText]}>
                {formatDisplayMoneyAbsolute(allocatedTotal)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.text }, jakartaSemiboldText]}>Disponible</Text>
              <Text style={[styles.summaryValue, { color: AVAILABLE_GREEN }, jakartaBoldText]}>
                {formatDisplayMoneyAbsolute(availableAmount)}
              </Text>
            </View>
          </View>

          <View style={styles.transfersHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }, jakartaSemiboldText]}>
              Virements à effectuer
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
              onPress={toggleAll}
              hitSlop={8}
              style={({ pressed }) => [styles.toggleAllHit, pressed && styles.pressed]}
            >
              <Text style={[styles.toggleAllLabel, { color: colors.textMuted }, jakartaMediumText]}>
                {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.transferList}>
            {PAYCHECK_MOCK_ALLOCATIONS.map((line) => (
              <TransferConfirmRow
                key={line.id}
                line={line}
                checked={selectedIds.has(line.id)}
                onToggle={() => toggleLine(line.id)}
              />
            ))}
          </View>

          {confirmed ? (
            <View
              style={[
                styles.successBanner,
                { backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.25)' },
              ]}
            >
              <AppIcon family="ionicons" name="checkmark-circle" size={18} color={AVAILABLE_GREEN} />
              <Text style={[styles.successText, { color: AVAILABLE_GREEN }, jakartaSemiboldText]}>
                {selectedLines.length} virement{selectedLines.length > 1 ? 's' : ''} confirmé
                {selectedLines.length > 1 ? 's' : ''} · {formatDisplayMoneyAbsolute(selectedTotal)} alloué
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom + spacing.md, spacing.lg),
              borderTopColor: colors.containerBorder,
              backgroundColor: colors.background,
            },
          ]}
        >
          <Text style={[styles.footerHint, { color: colors.textMuted }, jakartaMediumText]}>
            {selectedLines.length === 0
              ? 'Sélectionne au moins un virement'
              : `${selectedLines.length} virement${selectedLines.length > 1 ? 's' : ''} · ${formatDisplayMoneyAbsolute(selectedTotal)}`}
          </Text>
          <PrimarySaveButton
            label={
              confirmed
                ? 'Virements confirmés'
                : `Confirmer ${selectedLines.length} virement${selectedLines.length > 1 ? 's' : ''}`
            }
            onPress={handleConfirm}
            disabled={selectedLines.length === 0 || confirmed}
          />
        </View>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  headerSpacer: { width: 38 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  heroCard: {
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  heroAmount: {
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  heroSource: {
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  breakdownCard: {
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.caption,
    lineHeight: typography.caption + 4,
  },
  breakdownBlock: {
    gap: spacing.md,
  },
  stackBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 8,
    overflow: 'hidden',
    gap: 2,
  },
  stackSegment: {
    minWidth: 4,
    borderRadius: 4,
  },
  legend: {
    gap: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  legendValue: {
    fontSize: typography.micro,
    fontVariant: ['tabular-nums'],
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  summaryLabel: {
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  summaryValue: {
    fontSize: typography.caption,
    fontVariant: ['tabular-nums'],
  },
  transfersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleAllHit: {
    paddingVertical: spacing.xs,
  },
  toggleAllLabel: {
    fontSize: typography.micro,
  },
  transferList: {
    gap: spacing.sm,
  },
  transferCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  transferIconWell: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  transferTitle: {
    fontSize: typography.caption,
    lineHeight: typography.caption + 4,
  },
  transferRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  transferRouteText: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  transferAmount: {
    fontSize: typography.caption,
    fontVariant: ['tabular-nums'],
  },
  selectionRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  successText: {
    flex: 1,
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  footerHint: {
    fontSize: typography.micro,
    textAlign: 'center',
  },
  pressed: { opacity: 0.78 },
});

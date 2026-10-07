/**
 * Portefeuille — « Prêts et obligations » list (goal-card template → loan-detail).
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/icons/AppIcon';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { ProtoHeaderIconActions } from '@/components/proto/ProtoHeaderIconActions';
import { ProtoSectionHeader } from '@/components/proto/ProtoSectionHeader';
import { WalletProgressGoalRow } from '@/components/wallet/WalletProgressGoalRow';
import {
  destructiveIconColor,
  destructiveTextActionStyle,
  spacing,
  subtleDeleteButtonStyle,
  typographyKit,
} from '@/constants/theme';
import { deleteLoan, getLoans } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { resolveLoanIcon } from '@/lib/loanIcons';
import {
  formatLoanObligationName,
  formatWalletLoanGoalRow,
} from '@/lib/loanPresentation';
import { useAppTheme } from '@/lib/themeContext';
import type { Loan } from '@/types';

type Props = {
  /** Mask balances when the wallet œil toggle is on. */
  hideBalances?: boolean;
  /** When true, exit manage/select (another section took over). */
  suppressManaging?: boolean;
  /** Notify parent when manage/select mode changes. */
  onManagingChange?: (managing: boolean) => void;
};

export function WalletLoansSection({
  hideBalances = false,
  suppressManaging = false,
  onManagingChange,
}: Props) {
  const router = useRouter();
  const { colors, isLight } = useAppTheme();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [managingLoans, setManagingLoans] = useState(false);
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deletingLoans, setDeletingLoans] = useState(false);

  const load = useCallback(async () => {
    setLoans(await getLoans());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);

  useEffect(() => {
    if (!suppressManaging) return;
    setManagingLoans(false);
    setSelectedLoanIds([]);
    setConfirmDeleteVisible(false);
  }, [suppressManaging]);

  useEffect(() => {
    onManagingChange?.(managingLoans);
  }, [managingLoans, onManagingChange]);

  useEffect(() => {
    return () => onManagingChange?.(false);
  }, [onManagingChange]);

  const toggleManagingLoans = useCallback(() => {
    tapHaptic();
    setManagingLoans((prev) => {
      if (prev) setSelectedLoanIds([]);
      return !prev;
    });
  }, []);

  const toggleLoanSelection = useCallback((id: string) => {
    setSelectedLoanIds((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    );
  }, []);

  const beginManagingLoan = useCallback((id: string) => {
    tapHaptic();
    setManagingLoans(true);
    setSelectedLoanIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const openLoan = useCallback(
    (loan: Loan) => {
      tapHaptic();
      router.push({ pathname: '/loan-detail', params: { loanId: loan.id } });
    },
    [router],
  );

  const openDeleteConfirm = useCallback(() => {
    if (selectedLoanIds.length === 0) return;
    tapHaptic();
    setConfirmDeleteVisible(true);
  }, [selectedLoanIds.length]);

  const handleConfirmDelete = useCallback(async () => {
    if (deletingLoans || selectedLoanIds.length === 0) return;
    const ids = [...selectedLoanIds];
    setConfirmDeleteVisible(false);
    setDeletingLoans(true);
    try {
      await Promise.all(ids.map((id) => deleteLoan(id)));
      setSelectedLoanIds([]);
      setManagingLoans(false);
      successHaptic();
      dataEvents.emit();
      await load();
    } finally {
      setDeletingLoans(false);
    }
  }, [deletingLoans, load, selectedLoanIds]);

  return (
    <View style={styles.root}>
      <ProtoSectionHeader
        title="PRÊTS ET OBLIGATIONS"
        trailing={
          <ProtoHeaderIconActions
            managing={managingLoans}
            onEdit={toggleManagingLoans}
            editAccessibilityLabel="Gérer les prêts et obligations"
            editDoneAccessibilityLabel="Terminer la gestion"
          />
        }
      />

      <ProtoGlassCard style={styles.sectionCard}>
        {loans.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            Aucun prêt ou obligation pour l’instant
          </Text>
        ) : (
          loans.map((loan, index) => {
            const displayTitle = formatLoanObligationName(loan);
            const { pct, done, currentOverTotal, remainingLabel } = formatWalletLoanGoalRow(
              loan,
              hideBalances,
            );
            const selected = selectedLoanIds.includes(loan.id);

            return (
              <WalletProgressGoalRow
                key={loan.id}
                icon={resolveLoanIcon(loan)}
                title={displayTitle}
                pct={pct}
                currentOverTotal={currentOverTotal}
                remainingLabel={remainingLabel}
                done={done}
                managing={managingLoans}
                selected={selected}
                showTopDivider={index > 0}
                accessibilityLabel={
                  managingLoans
                    ? `${displayTitle}${selected ? ', sélectionné' : ''}`
                    : `Voir le détail de ${displayTitle}`
                }
                onPress={() => {
                  tapHaptic();
                  if (managingLoans) {
                    toggleLoanSelection(loan.id);
                    return;
                  }
                  openLoan(loan);
                }}
                onLongPress={() => beginManagingLoan(loan.id)}
              />
            );
          })
        )}
      </ProtoGlassCard>

      {managingLoans && loans.length > 0 ? (
        <View style={styles.deleteBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              selectedLoanIds.length === 0
                ? 'Sélectionne des prêts à supprimer'
                : `Supprimer ${selectedLoanIds.length} prêt${selectedLoanIds.length > 1 ? 's' : ''}`
            }
            disabled={deletingLoans || selectedLoanIds.length === 0}
            onPress={openDeleteConfirm}
            style={({ pressed }) => [
              subtleDeleteButtonStyle(isLight, { alignSelf: 'stretch' }),
              pressed && { opacity: 0.82 },
              (deletingLoans || selectedLoanIds.length === 0) && { opacity: 0.55 },
            ]}
          >
            <AppIcon
              family="ionicons"
              name="trash-outline"
              size={16}
              color={destructiveIconColor(isLight)}
            />
            <Text style={destructiveTextActionStyle(isLight)}>
              {deletingLoans
                ? 'Suppression…'
                : selectedLoanIds.length === 0
                  ? 'Sélectionne des prêts'
                  : selectedLoanIds.length === 1
                    ? 'Supprimer 1 prêt'
                    : `Supprimer ${selectedLoanIds.length} prêts`}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <ConfirmDeleteModal
        visible={confirmDeleteVisible}
        title={
          selectedLoanIds.length === 1
            ? 'Supprimer ce prêt ?'
            : `Supprimer ${selectedLoanIds.length} prêts ?`
        }
        message="Les paiements liés peuvent rester dans l’historique Agenda."
        confirmLabel={
          selectedLoanIds.length === 1 ? 'Supprimer' : 'Supprimer la sélection'
        }
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    alignSelf: 'stretch',
  },
  sectionCard: {
    width: '100%',
    alignSelf: 'stretch',
  },
  empty: {
    ...typographyKit.metaMedium,
    padding: 16,
  },
  deleteBlock: { marginTop: spacing.md },
});

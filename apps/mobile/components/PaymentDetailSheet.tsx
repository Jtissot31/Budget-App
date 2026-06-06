import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createNewRecurringPaymentForm,
  getRecurringImpactSummary,
  RecurringPaymentFormModal,
  manualAccountOptions,
  recurringPaymentToForm,
  saveRecurringPaymentForm,
  toAccountOptions,
  type PaymentForm,
} from '@/lib/recurringPaymentsForm';
import { BottomSheet } from '@/components/BottomSheet';
import { CategoryBudgetProgress } from '@/components/CategoryBudgetProgress';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { SurfaceCard } from '@/components/SurfaceCard';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import { radius, spacing, typography, type AppColors } from '@/constants/theme';
import {
  deleteRecurringPayment,
  deleteTransactionById,
  getCategories,
  getCategoryBudgets,
  getRecurringPayments,
  getSimulatedAccounts,
  upsertRecurringPayment,
} from '@/lib/db';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { detailHeroAmount, singleLineAmountProps } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import type { Category, CategoryBudget, RecurringPaymentFrequency, SimulatedAccount } from '@/types';

export type PaymentDetailPayload = {
  name: string;
  amount: number;
  /** Compte bancaire / carte — absent pour une synthèse marchand */
  account?: string | null;
  recurring?: boolean;
  sourceId?: string | null;
  kind?: 'payment' | 'income';
  /** Date ou période, déjà formatée */
  dateLabel?: string | null;
  /** Sous-titre (ex. catégorie marchand) */
  subtitle?: string | null;
  logoUrl?: string | null;
  icon?: string | null;
  color?: string | null;
  frequencyLabel?: string | null;
  frequency?: RecurringPaymentFrequency;
  active?: boolean;
  categoryName?: string | null;
  categoryId?: string | null;
};

type Props = {
  detail: PaymentDetailPayload | null;
  onClose: () => void;
  onDeleted?: () => void | Promise<void>;
};

const DETAIL_SHEET_TOP_RADIUS = 22;

type IconName = keyof typeof Ionicons.glyphMap;

export function PaymentDetailSheet({ detail, onClose, onDeleted }: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [deleting, setDeleting] = useState(false);
  const [confirmRecurringDeleteVisible, setConfirmRecurringDeleteVisible] = useState(false);
  const [confirmIncomeTxDeleteVisible, setConfirmIncomeTxDeleteVisible] = useState(false);
  const [confirmFormDeleteVisible, setConfirmFormDeleteVisible] = useState(false);
  const [recurringEditorOpen, setRecurringEditorOpen] = useState(false);
  const [recurringForm, setRecurringForm] = useState<PaymentForm | null>(null);
  const [recurringAccounts, setRecurringAccounts] = useState<ReturnType<typeof manualAccountOptions>>([]);
  const [recurringCategories, setRecurringCategories] = useState<Category[]>([]);
  const [recurringCategoryBudgets, setRecurringCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [detailCategoryBudgets, setDetailCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [recurringEditLoading, setRecurringEditLoading] = useState(false);
  const [activeOverride, setActiveOverride] = useState<boolean | null>(null);
  const [togglingActive, setTogglingActive] = useState(false);

  useEffect(() => {
    setDeleting(false);
    setActiveOverride(null);
  }, [detail?.sourceId]);

  useEffect(() => {
    if (!detail) {
      setRecurringEditorOpen(false);
      setRecurringForm(null);
      setDetailCategoryBudgets([]);
    }
  }, [detail]);

  useEffect(() => {
    if (!detail?.categoryId || detail.kind === 'income') {
      setDetailCategoryBudgets([]);
      return;
    }

    let cancelled = false;
    void getCategoryBudgets().then((budgets) => {
      if (!cancelled) setDetailCategoryBudgets(budgets);
    });

    return () => {
      cancelled = true;
    };
  }, [detail?.categoryId, detail?.kind]);

  const actualPayMatch = detail?.sourceId?.match(/^actual-pay-(.+)$/);
  const agendaIncomeTxId =
    typeof actualPayMatch?.[1] === 'string' ? actualPayMatch[1].trim() : '';
  const isEstimatedPayRow = detail?.sourceId === 'estimated-pay';
  const recurringEditId =
    detail?.recurring && detail.sourceId && !isEstimatedPayRow && !agendaIncomeTxId
      ? detail.sourceId
      : null;

  const persistAccounts = useCallback((simulated: SimulatedAccount[]) => {
    const accountOptions = toAccountOptions(simulated);
    return accountOptions.length ? accountOptions : manualAccountOptions();
  }, []);

  useEffect(() => {
    if (!recurringEditorOpen || !recurringEditId) return;
    let cancelled = false;
    setRecurringEditLoading(true);
    setRecurringForm(null);

    (async () => {
      try {
        const [payments, categories, categoryBudgets, simulatedAccounts] = await Promise.all([
          getRecurringPayments(),
          getCategories(),
          getCategoryBudgets(),
          getSimulatedAccounts(),
        ]);
        if (cancelled) return;

        const accounts = persistAccounts(simulatedAccounts);
        const payment = payments.find((item) => item.id === recurringEditId);
        if (!payment) {
          Alert.alert(
            'Introuvable',
            'Ce paiement récurrent a peut-être été supprimé. Actualise puis réessaie.',
          );
          setRecurringEditorOpen(false);
          return;
        }

        setRecurringAccounts(accounts);
        setRecurringCategories(categories);
        setRecurringCategoryBudgets(categoryBudgets);
        setRecurringForm(recurringPaymentToForm(payment));
      } catch {
        if (!cancelled) {
          Alert.alert('Chargement impossible', "Impossible d'ouvrir l'édition pour le moment.");
          setRecurringEditorOpen(false);
        }
      } finally {
        if (!cancelled) setRecurringEditLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [persistAccounts, recurringEditId, recurringEditorOpen]);

  const handleSheetClose = () => {
    if (recurringEditorOpen) {
      tapHaptic();
      setRecurringEditorOpen(false);
      setRecurringForm(null);
      return;
    }
    onClose();
  };

  const isRecurringActive = activeOverride ?? detail?.active ?? true;
  const impactForm = useMemo<PaymentForm | null>(() => {
    if (!detail || !recurringEditId) return null;
    return {
      id: recurringEditId,
      name: detail.name,
      amount: String(detail.amount || ''),
      kind: detail.kind === 'income' ? 'income' : 'payment',
      accountId: '',
      accountLabel: detail.account?.trim() || '',
      categoryId: detail.categoryId ?? null,
      frequency: detail.frequency ?? 'monthly',
      dueDay: '',
      nextDate: '',
      endDate: '',
      active: isRecurringActive,
      icon: 'repeat-outline',
      color: detail.color?.trim() || '#00A854',
      logoUrl: detail.logoUrl ?? null,
      logoMode: 'auto',
      createdAt: new Date().toISOString(),
    };
  }, [detail, isRecurringActive, recurringEditId]);

  const impactSummary = impactForm ? getRecurringImpactSummary(impactForm, detailCategoryBudgets) : null;

  if (!detail) return null;

  const detailCategoryBudget =
    detail.categoryId && detail.kind !== 'income'
      ? detailCategoryBudgets.find((item) => item.categoryId === detail.categoryId) ?? null
      : null;

  const account = detail.account?.trim() ? detail.account : '—';
  const recLabel =
    detail.frequencyLabel?.trim()
      ? detail.frequencyLabel
      : detail.recurring === undefined
        ? '—'
        : detail.recurring
          ? 'Oui'
          : 'Non';
  const dateStr = detail.dateLabel?.trim() ? detail.dateLabel : '—';
  const kindLabel = detail.kind === 'income' ? 'Revenu' : 'Paiement';

  const showModifierHeader =
    Boolean(recurringEditId) || Boolean(agendaIncomeTxId) || isEstimatedPayRow;

  const onPressModifier = () => {
    tapHaptic();
    if (recurringEditId) {
      setRecurringEditorOpen(true);
      return;
    }
    if (agendaIncomeTxId) {
      onClose();
      router.push({ pathname: '/add-transaction', params: { editId: agendaIncomeTxId } });
      return;
    }
    if (isEstimatedPayRow) {
      void (async () => {
        try {
          const [categories, categoryBudgets, simulatedAccounts] = await Promise.all([
            getCategories(),
            getCategoryBudgets(),
            getSimulatedAccounts(),
          ]);
          const accounts = persistAccounts(simulatedAccounts);
          setRecurringAccounts(accounts);
          setRecurringCategories(categories);
          setRecurringCategoryBudgets(categoryBudgets);
          setRecurringForm(createNewRecurringPaymentForm(accounts, categories, 'income'));
          setRecurringEditorOpen(true);
        } catch {
          Alert.alert('Chargement impossible', "Impossible d'ouvrir le formulaire pour le moment.");
        }
      })();
    }
  };

  const confirmDeleteRecurring = () => {
    if (!recurringEditId || deleting) return;
    tapHaptic();
    setConfirmRecurringDeleteVisible(true);
  };

  const confirmDeleteIncomeTransaction = () => {
    if (!agendaIncomeTxId || deleting) return;
    tapHaptic();
    setConfirmIncomeTxDeleteVisible(true);
  };

  const onPressDeleteFooter = () => {
    if (recurringEditId) {
      confirmDeleteRecurring();
      return;
    }
    if (agendaIncomeTxId) confirmDeleteIncomeTransaction();
  };

  const deleteFooterLabel = recurringEditId
    ? detail.kind === 'income'
      ? 'Supprimer le revenu récurrent'
      : 'Supprimer le paiement récurrent'
    : agendaIncomeTxId
      ? 'Supprimer la transaction'
      : '';

  const showDeleteFooter = Boolean(recurringEditId || agendaIncomeTxId);

  const amountTint = detail.kind === 'income' ? colors.success : colors.text;
  const amountPrefix = detail.kind === 'income' ? '+' : detail.kind === 'payment' ? '−' : '';

  const onSaveRecurring = async () => {
    if (!recurringForm) return;
    setRecurringSaving(true);
    const ok = await saveRecurringPaymentForm(recurringForm, recurringAccounts);
    setRecurringSaving(false);
    if (!ok) return;
    setRecurringEditorOpen(false);
    setRecurringForm(null);
    await onDeleted?.();
  };

  const onToggleActive = async () => {
    if (!recurringEditId || togglingActive) return;
    tapHaptic();
    setTogglingActive(true);
    try {
      const payments = await getRecurringPayments();
      const payment = payments.find((item) => item.id === recurringEditId);
      if (!payment) {
        Alert.alert('Introuvable', 'Ce paiement récurrent a peut-être été supprimé.');
        return;
      }
      const nextActive = !isRecurringActive;
      setActiveOverride(nextActive);
      await upsertRecurringPayment({ ...payment, active: nextActive });
      successHaptic();
      await onDeleted?.();
    } catch {
      setActiveOverride(null);
      Alert.alert('Erreur', "Impossible de mettre à jour l'état actif pour le moment.");
    } finally {
      setTogglingActive(false);
    }
  };

  const onDeleteRecurringForm =
    recurringForm && recurringForm.id
      ? () => { setConfirmFormDeleteVisible(true); }
      : undefined;

  return (
    <>
      <BottomSheet visible onClose={handleSheetClose} sheetStyle={styles.sheet}>
        <View style={styles.header}>
          <PaymentAvatar detail={detail} size={48} />
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={3} ellipsizeMode="tail">
              {detail.name}
            </Text>
          </View>
          {showModifierHeader ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                recurringEditId
                  ? 'Modifier le paiement ou revenu récurrent'
                  : agendaIncomeTxId
                    ? 'Modifier la transaction'
                    : 'Ajouter une échéance de paie récurrente'
              }
              hitSlop={10}
              onPress={onPressModifier}
              disabled={Boolean(recurringEditId && recurringEditLoading)}
              style={({ pressed }) => [
                styles.modifierButton,
                pressed && styles.headerButtonPressed,
                recurringEditId && recurringEditLoading && styles.disabled,
              ]}
            >
              {recurringEditId && recurringEditLoading ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={styles.modifierLabel}>Modifier</Text>
              )}
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer les détails"
            hitSlop={10}
            onPress={handleSheetClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.headerButtonPressed]}
          >
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </View>

      {detail.subtitle ? <Text style={styles.subtitle}>{detail.subtitle}</Text> : null}

        <Text style={[styles.amount, { color: amountTint }]} {...singleLineAmountProps}>
          {amountPrefix}
        {formatDisplayMoneyAbsolute(detail.amount)}
      </Text>

        {isEstimatedPayRow ? (
          <View style={styles.estimatedPayBanner}>
            <Ionicons name="sparkles" size={14} color={colors.primary} style={styles.estimatedPayBannerIcon} />
            <View style={styles.estimatedPayBannerText}>
              <Text style={styles.estimatedPayBannerLine}>
                Estimation à partir de tes paies passées. Le dépôt réel peut différer.
              </Text>
              <Text style={styles.estimatedPayBannerSub}>
                Une transaction importée remplace cette ligne.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.detailGrid}>
          <SurfaceCard style={styles.detailCardShell} innerStyle={styles.detailCardInner} padding={spacing.md}>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
            <View style={styles.detailCopy}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue} numberOfLines={3}>
                {dateStr}
              </Text>
            </View>
          </SurfaceCard>
          <SurfaceCard style={styles.detailCardShell} innerStyle={styles.detailCardInner} padding={spacing.md}>
            <Ionicons name="repeat-outline" size={14} color={colors.textMuted} />
            <View style={styles.detailCopy}>
              <Text style={styles.detailLabel}>Récurrence</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {recLabel}
              </Text>
            </View>
          </SurfaceCard>
        </View>

        <SurfaceCard style={styles.fullCardShell} innerStyle={styles.fullCardInner} padding={spacing.md}>
          <Ionicons name="wallet-outline" size={14} color={colors.textMuted} />
          <View style={styles.detailCopy}>
            <Text style={styles.detailLabel}>Compte</Text>
            <Text style={styles.detailValue} numberOfLines={3}>
              {account}
            </Text>
          </View>
        </SurfaceCard>

        <View style={styles.detailGrid}>
          <SurfaceCard style={styles.detailCardShell} innerStyle={styles.detailCardInner} padding={spacing.md}>
            <Ionicons name="pricetag-outline" size={14} color={colors.textMuted} />
            <View style={styles.detailCopy}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {kindLabel}
              </Text>
            </View>
          </SurfaceCard>
          {detail.categoryName?.trim() ? (
            <SurfaceCard style={styles.detailCardShell} innerStyle={styles.detailCardInner} padding={spacing.md}>
              <Ionicons name="folder-outline" size={14} color={colors.textMuted} />
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Catégorie</Text>
                <Text style={styles.detailValue} numberOfLines={2}>
                  {detail.categoryName}
                </Text>
              </View>
            </SurfaceCard>
          ) : (
            <View style={styles.detailCardSpacer} />
          )}
      </View>

        {recurringEditId && impactSummary ? (
          <SurfaceCard style={styles.budgetCardShell} innerStyle={styles.budgetCardInner} padding={spacing.md}>
            <DashboardSectionLabel style={styles.budgetCardEyebrow}>
              {detail.kind === 'income' ? 'Projection revenu' : 'Impact budget'}
            </DashboardSectionLabel>
            <Text
              style={[
                styles.impactValue,
                detail.kind === 'income' && { color: colors.success },
                !isRecurringActive && { color: colors.textMuted },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {impactSummary.primary}
            </Text>
            <Text style={styles.impactHint}>{impactSummary.secondary}</Text>
            {isRecurringActive &&
            detailCategoryBudget &&
            (detailCategoryBudget.limitAmount > 0 || detailCategoryBudget.spent > 0) ? (
              <CategoryBudgetProgress budget={detailCategoryBudget} />
            ) : null}
          </SurfaceCard>
        ) : null}

        {recurringEditId ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: isRecurringActive, disabled: togglingActive }}
            accessibilityLabel={isRecurringActive ? 'Paiement actif' : 'Paiement inactif'}
            disabled={togglingActive}
            onPress={() => void onToggleActive()}
            style={({ pressed }) => [
              styles.activeRow,
              pressed && styles.pressed,
              togglingActive && styles.disabled,
            ]}
          >
            <DashboardSectionLabel>Actif</DashboardSectionLabel>
            <Ionicons
              name={isRecurringActive ? 'toggle' : 'toggle-outline'}
              size={34}
              color={isRecurringActive ? colors.primary : colors.textMuted}
            />
          </Pressable>
        ) : null}

        {detailCategoryBudget &&
        (detailCategoryBudget.limitAmount > 0 || detailCategoryBudget.spent > 0) &&
        !recurringEditId ? (
          <SurfaceCard style={styles.budgetCardShell} innerStyle={styles.budgetCardInner} padding={spacing.md}>
            <Text style={styles.budgetCardEyebrow}>Budget de catégorie</Text>
            <CategoryBudgetProgress budget={detailCategoryBudget} />
          </SurfaceCard>
        ) : null}

        {showDeleteFooter ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={deleteFooterLabel}
            disabled={deleting}
            onPress={onPressDeleteFooter}
            style={({ pressed }) => [
              styles.deleteButtonWide,
              pressed && styles.pressed,
              deleting && styles.disabled,
            ]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.background} />
            <Text style={styles.deleteWideText}>{deleting ? 'Suppression…' : deleteFooterLabel}</Text>
          </Pressable>
        ) : null}
    </BottomSheet>

      <RecurringPaymentFormModal
        visible={recurringEditorOpen && recurringForm != null}
        form={recurringForm}
        accounts={recurringAccounts}
        categories={recurringCategories}
        categoryBudgets={recurringCategoryBudgets}
        saving={recurringSaving}
        bottomInset={insets.bottom}
        onClose={() => {
          setRecurringEditorOpen(false);
          setRecurringForm(null);
        }}
        onChange={setRecurringForm}
        onSave={() => void onSaveRecurring()}
        onDelete={onDeleteRecurringForm}
      />

      <ConfirmDeleteModal
        visible={confirmRecurringDeleteVisible}
        title={detail.kind === 'income' ? 'Supprimer ce revenu récurrent ?' : 'Supprimer ce paiement récurrent ?'}
        message={`${detail.name} sera retiré de l'agenda. Les transactions déjà créées ne seront pas supprimées.`}
        onConfirm={async () => {
          if (!recurringEditId) return;
          setConfirmRecurringDeleteVisible(false);
          try {
            setDeleting(true);
            await deleteRecurringPayment(recurringEditId);
            successHaptic();
            onClose();
            await onDeleted?.();
          } catch {
            setDeleting(false);
          }
        }}
        onCancel={() => setConfirmRecurringDeleteVisible(false)}
      />

      <ConfirmDeleteModal
        visible={confirmIncomeTxDeleteVisible}
        title="Supprimer cette transaction ?"
        message={`${detail.name} sera retiré de l'historique.`}
        onConfirm={async () => {
          if (!agendaIncomeTxId) return;
          setConfirmIncomeTxDeleteVisible(false);
          try {
            setDeleting(true);
            await deleteTransactionById(agendaIncomeTxId);
            successHaptic();
            onClose();
            await onDeleted?.();
          } catch {
            setDeleting(false);
          }
        }}
        onCancel={() => setConfirmIncomeTxDeleteVisible(false)}
      />

      <ConfirmDeleteModal
        visible={confirmFormDeleteVisible}
        title={recurringForm?.kind === 'income' ? 'Supprimer ce revenu ?' : 'Supprimer ce paiement ?'}
        message={`${recurringForm?.name || 'Cet élément'} sera retiré des récurrents.`}
        onConfirm={async () => {
          if (!recurringForm?.id) return;
          setConfirmFormDeleteVisible(false);
          try {
            await deleteRecurringPayment(recurringForm.id);
            successHaptic();
            setRecurringEditorOpen(false);
            setRecurringForm(null);
            onClose();
            await onDeleted?.();
          } catch {
            // silently ignore
          }
        }}
        onCancel={() => setConfirmFormDeleteVisible(false)}
      />
    </>
  );
}

function normalizeHex(value?: string | null) {
  return value?.startsWith('#') ? value : null;
}

const avatarShell = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

function PaymentAvatar({ detail, size }: { detail: PaymentDetailPayload; size: number }) {
  const { colors } = useAppTheme();
  const tint = normalizeHex(detail.color) ?? (detail.kind === 'income' ? colors.success : colors.warning);
  const icon: IconName =
    detail.icon && detail.icon in Ionicons.glyphMap && detail.icon !== 'repeat-outline'
      ? (detail.icon as IconName)
      : detail.kind === 'income'
        ? 'cash-outline'
        : 'receipt-outline';

  return (
    <UserPickedIconBadge icon={icon} color={tint} size={size} logoUrl={detail.logoUrl} style={avatarShell.base} />
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    sheet: {
      backgroundColor: colors.surfaceSolid,
      borderTopLeftRadius: DETAIL_SHEET_TOP_RADIUS,
      borderTopRightRadius: DETAIL_SHEET_TOP_RADIUS,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    headerText: { flex: 1, minWidth: 0, flexShrink: 1 },
    name: {
      minWidth: 0,
      flexShrink: 1,
      color: colors.text,
      fontSize: typography.dashboardGreeting,
      fontWeight: '800',
    },
    modifierButton: {
      flexShrink: 0,
      paddingHorizontal: spacing.sm,
      minWidth: 88,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSolid,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    modifierLabel: {
      color: colors.text,
      fontSize: typography.caption,
      fontWeight: '800',
    },
    closeButton: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSolid,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    headerButtonPressed: {
      opacity: 0.72,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: typography.caption,
      marginTop: -spacing.xs,
      marginBottom: spacing.sm,
    },
    estimatedPayBanner: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.md,
      marginTop: -spacing.xs,
    },
    estimatedPayBannerIcon: {
      marginTop: 2,
    },
    estimatedPayBannerText: {
      flex: 1,
      minWidth: 0,
    },
    estimatedPayBannerLine: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      lineHeight: typography.caption + 5,
      flexShrink: 1,
    },
    estimatedPayBannerSub: {
      color: colors.textMuted,
      fontSize: typography.meta,
      lineHeight: typography.meta + 4,
      marginTop: spacing.xs,
      flexShrink: 1,
    },
    amount: {
      ...detailHeroAmount,
      marginBottom: spacing.lg,
    },
    detailGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    detailCardShell: { flex: 1, minWidth: 0 },
    detailCardInner: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    detailCardSpacer: { flex: 1, minWidth: 0 },
    fullCardShell: { marginBottom: spacing.md },
    fullCardInner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    detailCopy: { flex: 1, minWidth: 0 },
    detailLabel: { color: colors.textMuted, fontSize: typography.micro },
    detailValue: { color: colors.text, fontSize: typography.meta, fontWeight: '700', marginTop: 2 },
    budgetCardShell: { marginBottom: spacing.md },
    budgetCardInner: { gap: spacing.sm },
    budgetCardEyebrow: {
      marginBottom: spacing.xs,
    },
    impactValue: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
    },
    impactHint: {
      color: colors.textMuted,
      fontSize: typography.meta,
      lineHeight: 17,
      marginTop: spacing.xs,
    },
    activeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      marginBottom: spacing.md,
    },
    deleteButtonWide: {
      alignSelf: 'stretch',
      minHeight: 52,
      marginTop: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.danger,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    deleteWideText: {
      color: colors.background,
      fontSize: typography.body,
      fontWeight: '900',
    },
    disabled: {
      opacity: 0.58,
    },
    pressed: {
      opacity: 0.78,
    },
  });
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumSwitch } from '@/components/PremiumSwitch';
import {
  createNewRecurringPaymentForm,
  frequencyLabel,
  getRecurringImpactSummary,
  RecurringPaymentFormModal,
  manualAccountOptions,
  saveRecurringPaymentForm,
  toAccountOptions,
  type AccountOption,
  type PaymentForm,
} from '@/lib/recurringPaymentsForm';
import { BottomSheet } from '@/components/BottomSheet';
import { ModifierButton } from '@/components/ModifierButton';
import { EditableField } from '@/components/EditableField';
import type { SettingsPickerOption } from '@/components/SettingsPickerSheet';
import { CategoryBudgetProgress } from '@/components/CategoryBudgetProgress';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { DetailSectionsCard } from '@/components/DetailSectionRows';
import type { DetailSection } from '@/components/DetailSectionRows';
import { ThemedConfirmModal } from '@/components/ThemedConfirmModal';
import { EMPTY_DETAIL_VALUE } from '@/lib/detailDisplay';
import type { ThemedConfirmVariant } from '@/components/ThemedConfirmModal';
import { SurfaceCard } from '@/components/SurfaceCard';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import {
  accountDetailHeroBlockStyle,
  destructiveIconColor,
  destructiveTextActionStyle,
  detailSectionLabelStyle,
  detailSectionsCardStyle,
  detailSubSectionHeaderStyle,
  jakartaExtraBoldText,
  radius,
  spacing,
  subtleDeleteButtonStyle,
  typography,
  typographyKit,
  type AppColors,
} from '@/constants/theme';
import {
  deleteRecurringPayment,
  deleteTransactionById,
  getCategories,
  getCategoryBudgets,
  getRecurringPayments,
  getSimulatedAccounts,
  upsertRecurringPayment,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { HandledSaveError } from '@/lib/editableSaveError';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { toLocalDateInputValue } from '@/lib/localDateInput';
import { parseFormattedNumber } from '@/lib/formatNumber';
import {
  detailHeroAmount,
  detailRowEditableContainer,
  detailRowSelectValueText,
  detailRowValueMoney,
} from '@/lib/textLayout';
import type { FormFeedback } from '@/lib/formFeedback';
import { useAppTheme } from '@/lib/themeContext';
import { TransactionAmountLabel, recurringPaymentAmountDirection } from '@/components/TransactionAmountLabel';
import { formatDisplayMoneyAbsolute, formatRecurringPaymentAmount } from '@/lib/formatDisplayMoney';
import { resolveRecurringPaymentDisplayIcon } from '@/lib/recurringPaymentPresentation';
import type {
  Category,
  CategoryBudget,
  RecurringPayment,
  RecurringPaymentFrequency,
  RecurringPaymentKind,
  SimulatedAccount,
} from '@/types';

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

const FREQUENCY_OPTIONS: SettingsPickerOption<RecurringPaymentFrequency>[] = [
  { id: 'weekly', label: 'Hebdo' },
  { id: 'biweekly', label: 'Bihebdo' },
  { id: 'monthly', label: 'Mensuel' },
  { id: 'yearly', label: 'Annuel' },
];

const KIND_OPTIONS: SettingsPickerOption<RecurringPaymentKind>[] = [
  { id: 'payment', label: 'Paiement' },
  { id: 'income', label: 'Revenu' },
];

const detailRowSelectTextStyle: TextStyle = {
  ...detailRowSelectValueText,
  textAlign: 'right',
};

function formatPaymentDetailDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate.slice(0, 10);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function PaymentDetailSheet({ detail, onClose, onDeleted }: Props) {
  const router = useRouter();
  const { colors, isLight } = useAppTheme();
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
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [recurringFeedback, setRecurringFeedback] = useState<FormFeedback | null>(null);
  const [detailCategoryBudgets, setDetailCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [inlinePayment, setInlinePayment] = useState<RecurringPayment | null>(null);
  const [inlineAccounts, setInlineAccounts] = useState<AccountOption[]>([]);
  const [inlineCategories, setInlineCategories] = useState<Category[]>([]);
  const [inlineLoading, setInlineLoading] = useState(false);
  const [activeOverride, setActiveOverride] = useState<boolean | null>(null);
  const [togglingActive, setTogglingActive] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertVariant, setAlertVariant] = useState<ThemedConfirmVariant>('error');

  const showAlert = (title: string, message: string, variant: ThemedConfirmVariant = 'error') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVariant(variant);
    setAlertVisible(true);
  };

  useEffect(() => {
    setDeleting(false);
    setActiveOverride(null);
    setInlinePayment(null);
    setInlineAccounts([]);
    setInlineCategories([]);
  }, [detail?.sourceId]);

  useEffect(() => {
    if (!detail) {
      setRecurringEditorOpen(false);
      setRecurringForm(null);
      setDetailCategoryBudgets([]);
    }
  }, [detail]);

  useEffect(() => {
    const categoryId = inlinePayment?.categoryId ?? detail?.categoryId;
    const kind = inlinePayment?.kind ?? detail?.kind;
    if (!categoryId || kind === 'income') {
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
  }, [detail?.categoryId, detail?.kind, inlinePayment?.categoryId, inlinePayment?.kind]);

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
    if (!recurringEditId) {
      setInlinePayment(null);
      setInlineAccounts([]);
      setInlineCategories([]);
      setInlineLoading(false);
      return;
    }

    let cancelled = false;
    setInlineLoading(true);

    (async () => {
      try {
        const [payments, categories, simulatedAccounts] = await Promise.all([
          getRecurringPayments(),
          getCategories(),
          getSimulatedAccounts(),
        ]);
        if (cancelled) return;

        const accounts = persistAccounts(simulatedAccounts);
        const payment = payments.find((item) => item.id === recurringEditId);
        if (!payment) {
          showAlert('Introuvable', 'Ce paiement récurrent a peut-être été supprimé. Actualise puis réessaie.');
          return;
        }

        setInlineAccounts(accounts);
        setInlineCategories(categories);
        setInlinePayment(payment);
      } catch {
        if (!cancelled) {
          showAlert('Chargement impossible', 'Impossible de charger les détails pour le moment.');
        }
      } finally {
        if (!cancelled) setInlineLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [persistAccounts, recurringEditId]);

  const handleSheetClose = () => {
    if (recurringEditorOpen) {
      tapHaptic();
      setRecurringEditorOpen(false);
      setRecurringForm(null);
      return;
    }
    onClose();
  };

  const isRecurringActive = activeOverride ?? inlinePayment?.active ?? detail?.active ?? true;
  const inlineEditable = Boolean(recurringEditId && inlinePayment && !inlineLoading);

  const accountPickerOptions = useMemo(
    () => inlineAccounts.map((account) => ({ id: account.id, label: account.label })),
    [inlineAccounts],
  );

  const categoryPickerOptions = useMemo(
    () =>
      inlineCategories.map((category) => ({
        id: category.id,
        label: category.name,
        budgetCategoryIcon: { icon: category.icon, name: category.name },
      })),
    [inlineCategories],
  );

  const persistRecurringUpdate = useCallback(
    async (updates: Partial<RecurringPayment>) => {
      if (!recurringEditId) return;
      const base = inlinePayment ?? (await getRecurringPayments()).find((item) => item.id === recurringEditId);
      if (!base) {
        showAlert('Introuvable', 'Ce paiement récurrent a peut-être été supprimé.');
        throw new HandledSaveError();
      }
      const next = { ...base, ...updates };
      await upsertRecurringPayment(next);
      setInlinePayment(next);
      successHaptic();
      dataEvents.emit();
      await onDeleted?.();
    },
    [inlinePayment, onDeleted, recurringEditId],
  );

  const handleSaveName = useCallback(
    async (newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) {
        showAlert('Nom requis', 'Le nom ne peut pas être vide.');
        throw new HandledSaveError();
      }
      if (trimmed === (inlinePayment?.name ?? detail?.name)) return;
      await persistRecurringUpdate({ name: trimmed });
    },
    [detail?.name, inlinePayment?.name, persistRecurringUpdate],
  );

  const handleSaveAmount = useCallback(
    async (amountStr: string) => {
      const amount = parseFormattedNumber(amountStr);
      if (Number.isNaN(amount) || amount <= 0) {
        showAlert('Montant invalide', 'Saisis un montant positif.');
        throw new HandledSaveError();
      }
      if (amount === (inlinePayment?.amount ?? detail?.amount)) return;
      await persistRecurringUpdate({ amount });
    },
    [detail?.amount, inlinePayment?.amount, persistRecurringUpdate],
  );

  const handleSaveNextDate = useCallback(
    async (nextDayYmd: string) => {
      const current = inlinePayment?.nextDate?.trim()
        ? toLocalDateInputValue(inlinePayment.nextDate)
        : '';
      if (nextDayYmd === current) return;
      await persistRecurringUpdate({ nextDate: nextDayYmd, dueDay: null });
    },
    [inlinePayment?.nextDate, persistRecurringUpdate],
  );

  const handleSaveFrequency = useCallback(
    async (frequencyId: string) => {
      const frequency = frequencyId as RecurringPaymentFrequency;
      if (!FREQUENCY_OPTIONS.some((option) => option.id === frequency)) return;
      if (frequency === inlinePayment?.frequency) return;
      await persistRecurringUpdate({ frequency });
    },
    [inlinePayment?.frequency, persistRecurringUpdate],
  );

  const handleSaveKind = useCallback(
    async (kindId: string) => {
      const kind = kindId as RecurringPaymentKind;
      if (!KIND_OPTIONS.some((option) => option.id === kind)) return;
      if (kind === (inlinePayment?.kind ?? 'payment')) return;
      await persistRecurringUpdate({ kind });
    },
    [inlinePayment?.kind, persistRecurringUpdate],
  );

  const handleSaveAccount = useCallback(
    async (accountId: string) => {
      const account = inlineAccounts.find((item) => item.id === accountId);
      if (!account) {
        showAlert('Compte introuvable', 'Choisis un compte valide.');
        throw new HandledSaveError();
      }
      if (accountId === inlinePayment?.accountId) return;
      await persistRecurringUpdate({ accountId: account.id, accountLabel: account.label });
    },
    [inlineAccounts, inlinePayment?.accountId, persistRecurringUpdate],
  );

  const handleSaveCategory = useCallback(
    async (categoryId: string) => {
      const category = inlineCategories.find((item) => item.id === categoryId);
      if (!category) {
        showAlert('Catégorie introuvable', 'Choisis une catégorie valide.');
        throw new HandledSaveError();
      }
      if (categoryId === (inlinePayment?.categoryId ?? '')) return;
      await persistRecurringUpdate({
        categoryId: category.id,
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryColor: category.color,
      });
    },
    [inlineCategories, inlinePayment?.categoryId, persistRecurringUpdate],
  );

  const displayKind = inlinePayment?.kind ?? detail?.kind ?? 'payment';
  const displayAmount = inlinePayment?.amount ?? detail?.amount ?? 0;
  const displayCategoryId = inlinePayment?.categoryId ?? detail?.categoryId ?? null;
  const displayCategoryName =
    inlinePayment?.categoryName?.trim()
    || inlineCategories.find((item) => item.id === displayCategoryId)?.name
    || detail?.categoryName?.trim()
    || '';
  const displayAccountLabel = inlinePayment?.accountLabel?.trim() || detail?.account?.trim() || '';
  const displayFrequency = inlinePayment?.frequency ?? detail?.frequency ?? 'monthly';
  const displayNextDate = inlinePayment?.nextDate?.trim() || '';

  const impactForm = useMemo<PaymentForm | null>(() => {
    if (!detail || !recurringEditId) return null;
    return {
      id: recurringEditId,
      name: inlinePayment?.name ?? detail.name,
      amount: String(displayAmount || ''),
      kind: displayKind === 'income' ? 'income' : 'payment',
      accountId: inlinePayment?.accountId ?? '',
      accountLabel: displayAccountLabel,
      categoryId: displayCategoryId,
      frequency: displayFrequency,
      dueDay: '',
      nextDate: displayNextDate,
      endDate: inlinePayment?.endDate ?? '',
      active: isRecurringActive,
      icon: inlinePayment?.icon ?? 'repeat-outline',
      color: inlinePayment?.color?.trim() || detail.color?.trim() || '#00A854',
      logoUrl: inlinePayment?.logoUrl ?? detail.logoUrl ?? null,
      logoMode: 'auto',
      createdAt: inlinePayment?.createdAt ?? new Date().toISOString(),
    };
  }, [
    detail,
    displayAccountLabel,
    displayAmount,
    displayCategoryId,
    displayFrequency,
    displayKind,
    displayNextDate,
    inlinePayment,
    isRecurringActive,
    recurringEditId,
  ]);

  const impactSummary = impactForm ? getRecurringImpactSummary(impactForm, detailCategoryBudgets) : null;

  const detailSections = useMemo((): DetailSection[] => {
    if (!detail) return [];

    const accountValue = displayAccountLabel || EMPTY_DETAIL_VALUE;
    const recurrenceValue = frequencyLabel(displayFrequency);
    const dateValue = displayNextDate
      ? formatPaymentDetailDate(displayNextDate)
      : detail.dateLabel?.trim()
        ? detail.dateLabel
        : EMPTY_DETAIL_VALUE;
    const kindValue = displayKind === 'income' ? 'Revenu' : 'Paiement';
    const recurringSectionTitle =
      displayKind === 'income'
        ? 'Revenu récurrent'
        : detail.recurring
          ? 'Paiement récurrent'
          : 'Transaction';
    const amountColor = displayKind === 'income' ? colors.success : colors.text;

    const transactionRows: DetailSection['rows'] = [];

    if (inlineEditable) {
      transactionRows.push({
        label: 'Montant',
        value: formatDisplayMoneyAbsolute(displayAmount),
        icon: 'cash-outline',
        valueColor: amountColor,
        valueLayout: 'amount',
        valueContent: (
          <EditableField
            type="money"
            value={String(displayAmount || '')}
            onSave={handleSaveAmount}
            align="right"
            accessibilityLabel="Modifier le montant"
            containerStyle={detailRowEditableContainer}
            textStyle={[detailRowValueMoney, { color: amountColor }]}
          />
        ),
      });
    }

    transactionRows.push(
      {
        label: 'Date',
        value: dateValue,
        icon: 'calendar-outline',
        ...(inlineEditable
          ? {
              valueContent: (
                <EditableField
                  type="date"
                  value={displayNextDate ? toLocalDateInputValue(displayNextDate) : toLocalDateInputValue(new Date().toISOString())}
                  formatDateLabel={formatPaymentDetailDate}
                  onSave={handleSaveNextDate}
                  align="right"
                  accessibilityLabel="Modifier la prochaine date"
                  containerStyle={detailRowEditableContainer}
                  textStyle={detailRowSelectTextStyle}
                />
              ),
            }
          : null),
      },
      {
        label: 'Récurrence',
        value: recurrenceValue,
        icon: 'repeat-outline',
        ...(inlineEditable
          ? {
              valueContent: (
                <EditableField
                  type="select"
                  value={recurrenceValue}
                  selectedId={displayFrequency}
                  selectOptions={FREQUENCY_OPTIONS}
                  pickerTitle="Fréquence"
                  onSave={handleSaveFrequency}
                  align="right"
                  accessibilityLabel="Modifier la fréquence"
                  containerStyle={detailRowEditableContainer}
                  textStyle={detailRowSelectTextStyle}
                />
              ),
            }
          : null),
      },
      {
        label: 'Type',
        value: kindValue,
        icon: displayKind === 'income' ? 'arrow-down-outline' : 'arrow-up-outline',
        ...(inlineEditable
          ? {
              valueContent: (
                <EditableField
                  type="select"
                  value={kindValue}
                  selectedId={displayKind}
                  selectOptions={KIND_OPTIONS}
                  pickerTitle="Type"
                  onSave={handleSaveKind}
                  align="right"
                  accessibilityLabel="Modifier le type"
                  containerStyle={detailRowEditableContainer}
                  textStyle={detailRowSelectTextStyle}
                />
              ),
            }
          : null),
      },
    );

    const sections: DetailSection[] = [
      {
        title: recurringSectionTitle,
        rows: transactionRows,
      },
    ];

    if (accountValue !== EMPTY_DETAIL_VALUE || inlineEditable) {
      sections.push({
        title: 'Compte',
        rows: [
          {
            label: 'Compte',
            value: accountValue,
            icon: 'wallet-outline',
            ...(inlineEditable
              ? {
                  valueContent: (
                    <EditableField
                      type="select"
                      value={accountValue}
                      selectedId={inlinePayment?.accountId ?? accountPickerOptions[0]?.id ?? ''}
                      selectOptions={accountPickerOptions}
                      pickerTitle="Compte"
                      onSave={handleSaveAccount}
                      align="right"
                      accessibilityLabel="Modifier le compte"
                      containerStyle={detailRowEditableContainer}
                      textStyle={detailRowSelectTextStyle}
                    />
                  ),
                }
              : null),
          },
        ],
      });
    }

    if (displayCategoryName || inlineEditable) {
      sections.push({
        title: 'Catégorie',
        rows: [
          {
            label: 'Catégorie',
            value: displayCategoryName || EMPTY_DETAIL_VALUE,
            icon: 'pricetag-outline',
            ...(inlineEditable
              ? {
                  valueContent: (
                    <EditableField
                      type="select"
                      value={displayCategoryName || EMPTY_DETAIL_VALUE}
                      selectedId={displayCategoryId ?? categoryPickerOptions[0]?.id ?? ''}
                      selectOptions={categoryPickerOptions}
                      pickerTitle="Catégorie"
                      onSave={handleSaveCategory}
                      align="right"
                      accessibilityLabel="Modifier la catégorie"
                      containerStyle={detailRowEditableContainer}
                      textStyle={detailRowSelectTextStyle}
                    />
                  ),
                }
              : null),
          },
        ],
      });
    }

    return sections;
  }, [
    accountPickerOptions,
    categoryPickerOptions,
    colors.success,
    colors.text,
    detail,
    displayAccountLabel,
    displayAmount,
    displayCategoryId,
    displayCategoryName,
    displayFrequency,
    displayKind,
    displayNextDate,
    handleSaveAccount,
    handleSaveAmount,
    handleSaveCategory,
    handleSaveFrequency,
    handleSaveKind,
    handleSaveNextDate,
    inlineEditable,
    inlinePayment?.accountId,
  ]);

  if (!detail) return null;

  const detailCategoryBudget =
    displayCategoryId && displayKind !== 'income'
      ? detailCategoryBudgets.find((item) => item.categoryId === displayCategoryId) ?? null
      : null;

  const showModifierHeader = Boolean(agendaIncomeTxId) || isEstimatedPayRow;

  const onPressModifier = () => {
    tapHaptic();
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
          showAlert('Chargement impossible', "Impossible d'ouvrir le formulaire pour le moment.");
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
    ? displayKind === 'income'
      ? 'Supprimer le revenu récurrent'
      : 'Supprimer le paiement récurrent'
    : agendaIncomeTxId
      ? 'Supprimer la transaction'
      : '';

  const showDeleteFooter = Boolean(recurringEditId || agendaIncomeTxId);

  const amountTint = displayKind === 'income' ? colors.success : colors.text;
  const formattedAmount = detail.recurring
    ? formatRecurringPaymentAmount(displayAmount, displayKind)
    : formatDisplayMoneyAbsolute(displayAmount);
  const amountDirection = recurringPaymentAmountDirection(displayKind);
  const displayName = inlinePayment?.name ?? detail.name;

  const onSaveRecurring = async () => {
    if (!recurringForm) return;
    setRecurringSaving(true);
    const result = await saveRecurringPaymentForm(recurringForm, recurringAccounts);
    setRecurringSaving(false);
    if (result !== true) {
      setRecurringFeedback(result);
      return;
    }
    setRecurringFeedback(null);
    setRecurringEditorOpen(false);
    setRecurringForm(null);
    dataEvents.emit();
    await onDeleted?.();
  };

  const onDeleteRecurringForm =
    recurringForm && recurringForm.id
      ? () => { setConfirmFormDeleteVisible(true); }
      : undefined;

  const onActiveValueChange = async (nextActive: boolean) => {
    if (!recurringEditId || togglingActive || nextActive === isRecurringActive) return;
    tapHaptic();
    setTogglingActive(true);
    try {
      const payments = await getRecurringPayments();
      const payment = payments.find((item) => item.id === recurringEditId);
      if (!payment) {
        showAlert('Introuvable', 'Ce paiement récurrent a peut-être été supprimé.');
        return;
      }
      setActiveOverride(nextActive);
      const next = { ...payment, active: nextActive };
      await upsertRecurringPayment(next);
      setInlinePayment((current) => (current?.id === next.id ? next : current));
      successHaptic();
      dataEvents.emit();
      await onDeleted?.();
    } catch {
      setActiveOverride(null);
      showAlert('Erreur', "Impossible de mettre à jour l'état actif pour le moment.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <>
      <BottomSheet
        visible
        onClose={handleSheetClose}
        sheetStyle={styles.sheet}
        scrollContentContainerStyle={styles.sheetContent}
      >
        <View style={styles.topBar}>
          <View style={styles.topBarSpacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer les détails"
            hitSlop={10}
            onPress={handleSheetClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.headerButtonPressed]}
          >
            <AppIcon family="ionicons" name="close" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.sheetBody}>
          <View style={[accountDetailHeroBlockStyle(), { gap: spacing.lg }]}>
            <View style={styles.heroIdentityRow}>
              <PaymentAvatar detail={detail} size={56} />
              <View style={styles.heroIdentityCopy}>
                {inlineEditable ? (
                  <EditableField
                    type="text"
                    value={displayName}
                    onSave={handleSaveName}
                    accessibilityLabel="Modifier le nom"
                    textStyle={styles.heroLabel}
                    containerStyle={styles.heroLabelField}
                    placeholder="Nom"
                  />
                ) : (
                  <Text style={styles.heroLabel} numberOfLines={3} ellipsizeMode="tail">
                    {displayName}
                  </Text>
                )}
                {detail.subtitle ? (
                  <Text style={styles.heroSubtitle} numberOfLines={2}>
                    {detail.subtitle}
                  </Text>
                ) : null}
              </View>
              {showModifierHeader ? (
                <ModifierButton
                  accessibilityLabel={
                    agendaIncomeTxId
                      ? 'Modifier la transaction'
                      : 'Ajouter une échéance de paie récurrente'
                  }
                  onPress={onPressModifier}
                  hitSlop={10}
                />
              ) : null}
            </View>

            <TransactionAmountLabel
              amount={formattedAmount}
              direction={amountDirection}
              color={amountTint}
              textStyle={detailHeroAmount}
              containerStyle={styles.heroAmountContainer}
              showDirectionIcon
            />
          </View>

          {isEstimatedPayRow ? (
            <View style={styles.estimatedPayBanner}>
              <AppIcon family="ionicons" name="sparkles" size={14} color={colors.primary} style={styles.estimatedPayBannerIcon} />
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

          <DetailSectionsCard sections={detailSections} colors={colors} />

          {recurringEditId && impactSummary ? (
            <SurfaceCard style={detailSectionsCardStyle()} padding={spacing.lg}>
              <Text style={[detailSectionLabelStyle(), { color: colors.textMuted }]}>
                {displayKind === 'income' ? 'PROJECTION REVENU' : 'IMPACT BUDGET'}
              </Text>
              <Text
                style={[
                  styles.impactValue,
                  displayKind === 'income' && { color: colors.success },
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
            <SurfaceCard style={detailSectionsCardStyle()} padding={spacing.lg}>
              <View style={[styles.activeRow, togglingActive && styles.disabled]}>
                <Text style={[detailSubSectionHeaderStyle(), styles.activeRowLabel, { color: colors.textMuted }]}>
                  Actif
                </Text>
                <PremiumSwitch
                  accessibilityLabel={isRecurringActive ? 'Paiement actif' : 'Paiement inactif'}
                  accessibilityState={{ checked: isRecurringActive, disabled: togglingActive }}
                  disabled={togglingActive}
                  value={isRecurringActive}
                  onValueChange={(nextActive) => void onActiveValueChange(nextActive)}
                />
              </View>
            </SurfaceCard>
          ) : null}

          {detailCategoryBudget &&
          (detailCategoryBudget.limitAmount > 0 || detailCategoryBudget.spent > 0) &&
          !recurringEditId ? (
            <SurfaceCard style={detailSectionsCardStyle()} padding={spacing.lg}>
              <Text style={[detailSectionLabelStyle(), { color: colors.textMuted }]}>
                BUDGET DE CATÉGORIE
              </Text>
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
                subtleDeleteButtonStyle(isLight, { alignSelf: 'stretch' }),
                pressed && { opacity: 0.72 },
                deleting && styles.disabled,
              ]}
            >
              <AppIcon family="ionicons" name="trash-outline" size={16} color={destructiveIconColor(isLight)} />
              <Text style={destructiveTextActionStyle(isLight)}>
                {deleting ? 'Suppression…' : deleteFooterLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
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
          setRecurringFeedback(null);
        }}
        onChange={setRecurringForm}
        onSave={() => void onSaveRecurring()}
        onDelete={onDeleteRecurringForm}
        feedback={recurringFeedback}
      />

      <ConfirmDeleteModal
        visible={confirmRecurringDeleteVisible}
        title={displayKind === 'income' ? 'Supprimer ce revenu récurrent ?' : 'Supprimer ce paiement récurrent ?'}
        message={`${displayName} sera retiré de l'agenda. Les transactions déjà créées ne seront pas supprimées.`}
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
        message={`${displayName} sera retiré de l'historique.`}
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

      <ThemedConfirmModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        variant={alertVariant}
        confirmLabel="Compris"
        onConfirm={() => setAlertVisible(false)}
        onCancel={() => setAlertVisible(false)}
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
  const icon = resolveRecurringPaymentDisplayIcon({
    icon: detail.icon,
    kind: detail.kind,
  });
  const hasLogo = Boolean(detail.logoUrl?.trim());

  return (
    <UserPickedIconWell
      icon={icon}
      color={tint}
      size={size}
      logoUrl={detail.logoUrl}
      merchantLabel={detail.name}
      wellGlyphWhite={Boolean(detail.recurring) && detail.kind !== 'income'}
      noBackground={hasLogo}
      style={avatarShell.base}
    />
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    sheet: {
      backgroundColor: colors.containerBackground,
      borderTopLeftRadius: DETAIL_SHEET_TOP_RADIUS,
      borderTopRightRadius: DETAIL_SHEET_TOP_RADIUS,
    },
    sheetContent: {
      paddingBottom: spacing.xl,
    },
    sheetBody: {
      gap: spacing.xl,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: spacing.sm,
    },
    topBarSpacer: {
      flex: 1,
    },
    heroIdentityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    heroIdentityCopy: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    heroLabelField: {
      flex: 1,
      minWidth: 0,
      alignSelf: 'stretch',
    },
    heroLabel: {
      ...jakartaExtraBoldText,
      fontSize: typography.dashboardGreeting,
      letterSpacing: -0.4,
      color: colors.text,
      minWidth: 0,
      flexShrink: 1,
    },
    heroSubtitle: {
      ...typographyKit.microMedium,
      color: colors.textMuted,
    },
    heroAmountContainer: {
      justifyContent: 'center',
      alignSelf: 'stretch',
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
    estimatedPayBanner: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginTop: -spacing.sm,
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
    impactValue: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
      marginTop: spacing.xs,
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
    },
    activeRowLabel: {
      marginBottom: 0,
    },
    disabled: {
      opacity: 0.58,
    },
    pressed: {
      opacity: 0.78,
    },
  });
}

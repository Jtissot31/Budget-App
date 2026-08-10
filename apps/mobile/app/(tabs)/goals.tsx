/**
 * Agenda tab — Budget Proto Figma UI only (not PlanFinancierHub / not AgendaView shell).
 * List-row tap → PaymentDetailSheet (opaque detail).
 * FAB → RecurringPaymentFormModal via uiEvents.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProtoAgendaScreen } from '@/components/agenda/ProtoAgendaScreen';
import {
  PaymentDetailSheet,
  type PaymentDetailPayload,
} from '@/components/PaymentDetailSheet';
import { loadRecurringPickerCategories } from '@/lib/budgetCategories';
import {
  createNewRecurringPaymentForm,
  RecurringPaymentFormModal,
  manualAccountOptions,
  saveRecurringPaymentForm,
  toAccountOptions,
  type PaymentForm,
  type RecurringPaymentAddVariant,
} from '@/lib/recurringPaymentsForm';
import { getCategoryBudgets, getSimulatedAccounts } from '@/lib/db';
import { dataEvents, uiEvents } from '@/lib/events';
import type { FormFeedback } from '@/lib/formFeedback';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { Category, CategoryBudget } from '@/types';

export default function AgendaTab() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [paymentDetail, setPaymentDetail] = useState<PaymentDetailPayload | null>(null);
  const [recurringForm, setRecurringForm] = useState<PaymentForm | null>(null);
  const [recurringAccounts, setRecurringAccounts] = useState<ReturnType<typeof toAccountOptions>>([]);
  const [recurringCategories, setRecurringCategories] = useState<Category[]>([]);
  const [recurringCategoryBudgets, setRecurringCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [recurringFeedback, setRecurringFeedback] = useState<FormFeedback | null>(null);

  const prepareRecurringFormContext = useCallback(async () => {
    const [categories, categoryBudgets, simulatedAccounts] = await Promise.all([
      loadRecurringPickerCategories(),
      getCategoryBudgets(),
      getSimulatedAccounts(),
    ]);
    const accounts = toAccountOptions(simulatedAccounts);
    const accountOptions = accounts.length ? accounts : manualAccountOptions();
    setRecurringAccounts(accountOptions);
    setRecurringCategories(categories);
    setRecurringCategoryBudgets(categoryBudgets);
    return { accountOptions, categories };
  }, []);

  const openNewRecurringPayment = useCallback(
    async (variant: RecurringPaymentAddVariant = 'bill') => {
      tapHaptic();
      const { accountOptions, categories } = await prepareRecurringFormContext();
      setRecurringFeedback(null);
      setRecurringForm(createNewRecurringPaymentForm(accountOptions, categories, variant));
    },
    [prepareRecurringFormContext],
  );

  useEffect(
    () =>
      uiEvents.subscribeNewRecurringPayment((variant) => {
        if (!isFocused) return;
        void openNewRecurringPayment(variant);
      }),
    [isFocused, openNewRecurringPayment],
  );

  const saveRecurringPayment = async () => {
    if (!recurringForm) return;
    setRecurringSaving(true);
    const result = await saveRecurringPaymentForm(recurringForm, recurringAccounts);
    setRecurringSaving(false);
    if (result !== true) {
      setRecurringFeedback(result);
      return;
    }
    setRecurringFeedback(null);
    setRecurringForm(null);
    dataEvents.emit();
    successHaptic();
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ProtoAgendaScreen onOpenPaymentDetail={setPaymentDetail} />

      <PaymentDetailSheet
        detail={paymentDetail}
        onClose={() => setPaymentDetail(null)}
        onDeleted={() => {
          setPaymentDetail(null);
          dataEvents.emit();
        }}
      />

      <RecurringPaymentFormModal
        visible={recurringForm != null}
        form={recurringForm}
        accounts={recurringAccounts}
        categories={recurringCategories}
        categoryBudgets={recurringCategoryBudgets}
        saving={recurringSaving}
        bottomInset={insets.bottom}
        onClose={() => {
          setRecurringForm(null);
          setRecurringFeedback(null);
        }}
        onChange={setRecurringForm}
        onSave={() => void saveRecurringPayment()}
        feedback={recurringFeedback}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});

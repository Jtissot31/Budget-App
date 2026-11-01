/**
 * Create a loan: a name, a type and four amounts, nothing else. Duration comes from the balance
 * and the payment; lender, rate terms and the rest can stay empty.
 */
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipSelectField } from '@/components/ChipSelectField';
import { DraggableSheetScrollView, DraggableSheetSurface } from '@/components/DraggableSheetSurface';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { FORM_SECTION_LABEL_STYLE, jakartaMediumText, jakartaSemiboldText, radius, spacing } from '@/constants/theme';
import { upsertLoan } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { parseFormattedNumber } from '@/lib/formatNumber';
import { successHaptic } from '@/lib/haptics';
import { defaultLoanIcon } from '@/lib/loanIcons';
import {
  FORM_SHEET_CONTENT_PADDING_TOP,
  FormSheetChromeHeader,
  FormSheetModalBody,
  formSheetScrollContentStyle,
  formSheetScrollPaddingBottom,
  formSheetScrollViewStyle,
  useFormSheetHeight,
  useFormSheetKeyboardInset,
} from '@/lib/sheet/formSheetScroll';
import { useAppTheme } from '@/lib/themeContext';
import type { Loan, LoanType, SimulatedAccount } from '@/types';

const LOAN_TYPES: { id: LoanType; label: string }[] = [
  { id: 'personal_loan', label: 'Prêt' },
  { id: 'mortgage', label: 'Hypothèque' },
  { id: 'line_of_credit', label: 'Marge de crédit' },
  { id: 'friend_debt', label: 'Entre proches' },
];

/** Lets the Modal's slide-in finish; Android ignores a focus request made before that. */
const FOCUS_DELAY_MS = 320;
const DEFAULT_DURATION_MONTHS = 60;

function amountFrom(text: string): number {
  const parsed = parseFormattedNumber(text || '0');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function dateKeyPlusMonths(from: Date, months: number): string {
  const next = new Date(from);
  next.setMonth(next.getMonth() + months);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

export function LoanFormSheet({
  visible,
  accounts,
  onClose,
}: {
  visible: boolean;
  accounts: readonly SimulatedAccount[];
  onClose: () => void;
}) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sheetHeight = useFormSheetHeight(0.92);
  const keyboardInset = useFormSheetKeyboardInset();
  const nameInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<LoanType>('personal_loan');
  const [principal, setPrincipal] = useState('');
  const [balance, setBalance] = useState('');
  const [payment, setPayment] = useState('');
  const [rate, setRate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setType('personal_loan');
    setPrincipal('');
    setBalance('');
    setPayment('');
    setRate('');
    setSaving(false);
    const timer = setTimeout(() => nameInputRef.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const principalValue = amountFrom(principal);
  const canSave = name.trim().length > 0 && principalValue > 0 && !saving;
  const fieldSurface = { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const now = new Date();
    // Left empty, the balance is the full amount borrowed.
    const balanceValue = balance.trim() ? amountFrom(balance) : principalValue;
    const paymentValue = amountFrom(payment);
    const durationMonths =
      paymentValue > 0 ? Math.max(1, Math.ceil(balanceValue / paymentValue)) : DEFAULT_DURATION_MONTHS;
    const reason = name.trim();
    const loan: Loan = {
      id: `loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      name: reason,
      reason,
      lender: '',
      principal: principalValue,
      balanceRemaining: balanceValue,
      interestRate: amountFrom(rate),
      monthlyPayment: paymentValue,
      startDate: dateKeyPlusMonths(now, 0),
      endDate: dateKeyPlusMonths(now, durationMonths),
      durationAmount: durationMonths,
      durationUnit: 'months',
      paymentFrequency: 'monthly',
      paymentAccountId: accounts.find((account) => account.kind === 'checking')?.id ?? accounts[0]?.id ?? '',
      nextPaymentDate: dateKeyPlusMonths(now, 1),
      icon: defaultLoanIcon(type),
      createdAt: now.toISOString(),
    };
    await upsertLoan(loan);
    dataEvents.emit();
    successHaptic();
    onClose();
  };

  const amountField = (label: string, value: string, onChange: (next: string) => void, suffix: string, placeholder = '0') => (
    <View style={styles.half}>
      <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.inputShell, fieldSurface]}>
        <NumericAmountInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          style={[styles.input, { color: colors.text }]}
          accessibilityLabel={label}
        />
        <Text style={[styles.suffix, { color: colors.textMuted }]}>{suffix}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.backdrop, { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
          <FormSheetModalBody>
            <DraggableSheetSurface
              onClose={onClose}
              sheetHeight={sheetHeight}
              style={[styles.sheet, { backgroundColor: colors.background }]}
            >
              <FormSheetChromeHeader
                title="Nouveau prêt"
                onClose={onClose}
                titleColor={colors.text}
                closeIconColor={colors.textMuted}
                handleColor={colors.borderStrong}
                closeButtonStyle={{ backgroundColor: colors.surfaceElevated }}
                headerStyle={styles.headerPad}
              />
              <DraggableSheetScrollView
                style={formSheetScrollViewStyle()}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                  styles.content,
                  formSheetScrollContentStyle,
                  { paddingBottom: formSheetScrollPaddingBottom(insets.bottom, keyboardInset) },
                ]}
              >
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Nom</Text>
                  <View style={[styles.inputShell, fieldSurface]}>
                    <TextInput
                      ref={nameInputRef}
                      value={name}
                      onChangeText={setName}
                      placeholder="Ex. : Auto"
                      placeholderTextColor={colors.textMuted}
                      maxLength={40}
                      returnKeyType="done"
                      style={[styles.input, { color: colors.text }]}
                      accessibilityLabel="Nom du prêt"
                    />
                  </View>
                </View>

                <ChipSelectField
                  label="Type"
                  options={LOAN_TYPES}
                  selectedId={type}
                  onSelect={(id) => setType(id as LoanType)}
                />

                <View style={styles.row}>
                  {amountField('Montant emprunté', principal, setPrincipal, '$')}
                  {amountField('Solde restant', balance, setBalance, '$', principal || '0')}
                </View>
                <View style={styles.row}>
                  {amountField('Paiement mensuel', payment, setPayment, '$')}
                  {amountField('Taux', rate, setRate, '%')}
                </View>

                <PrimarySaveButton label="Créer" onPress={() => void save()} loading={saving} disabled={!canSave} />
              </DraggableSheetScrollView>
            </DraggableSheetSurface>
          </FormSheetModalBody>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: FORM_SHEET_CONTENT_PADDING_TOP,
  },
  headerPad: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  field: { gap: 8 },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flexGrow: 1, flexBasis: 0, minWidth: 0, gap: 8 },
  label: { ...FORM_SECTION_LABEL_STYLE },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { ...jakartaSemiboldText, flexGrow: 1, flexShrink: 1, fontSize: 16, paddingVertical: 0 },
  suffix: { ...jakartaMediumText, fontSize: 16, lineHeight: 20, marginLeft: 8 },
});

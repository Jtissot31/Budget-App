/**
 * « Factures d'avance » — creates the savings goal AND an envelope in the account the user picks.
 *
 * Deliberately almost wordless: account chips, two big amounts, and a four-step ladder
 * (2 semaines → 1 mois → 2 mois → 3 mois) that fills as the typed amounts grow. One line says
 * how long the current step takes.
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DraggableSheetScrollView, DraggableSheetSurface } from '@/components/DraggableSheetSurface';
import { AppIcon } from '@/components/icons/AppIcon';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ghostCardShadow } from '@/constants/ghostUi';
import { jakartaBoldText, jakartaMediumText, jakartaSemiboldText, radius, spacing } from '@/constants/theme';
import { createBillsCushionGoal, freeBalanceByAccount, isCushionAccount } from '@/lib/billsCushion';
import { cushionTiers, monthlyRecurringBills, monthsToReach, tierProgress } from '@/lib/billsCushionTiers';
import { getRecurringPayments, getSimulatedAccounts } from '@/lib/db';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { formatNumberInputFromValue, parseFormattedNumber } from '@/lib/formatNumber';
import { successHaptic, tapHaptic } from '@/lib/haptics';
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
import type { RecurringPayment, SimulatedAccount } from '@/types';

const money = formatDisplayMoneyAbsolute;
const NODE = 20;

function amountOf(text: string): number {
  const parsed = parseFormattedNumber(text || '0');
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

/** « Chèque ··4521 » — short enough for a chip, unique per account. */
function chipLabel(account: SimulatedAccount): string {
  const kind = account.kind === 'checking' ? 'Chèque' : account.kind === 'savings' ? 'Épargne' : 'Cash';
  const digits = (account.last4 ?? '').replace(/\D/g, '').slice(-4);
  return digits ? `${kind} ··${digits}` : kind;
}

/**
 * Where the filled part of the ladder ends, 0–1 across its width. Nodes sit at the centre of
 * four equal columns (12.5 %, 37.5 %, 62.5 %, 87.5 %); the line starts at 0 with nothing saved.
 */
function ladderFill(saved: number, amounts: readonly number[]): number {
  const stops = [0, 0.125, 0.375, 0.625, 0.875];
  const values = [0, ...amounts];
  for (let i = 1; i < values.length; i++) {
    const from = values[i - 1] ?? 0;
    const to = values[i] ?? from;
    if (saved <= to) {
      const span = to - from;
      const t = span > 0 ? Math.max(0, (saved - from) / span) : 1;
      return (stops[i - 1] ?? 0) + t * ((stops[i] ?? 0) - (stops[i - 1] ?? 0));
    }
  }
  return stops[stops.length - 1] ?? 0.875;
}

/** Mounted only while open — every opening starts from a clean form. */
export function BillsCushionSheet({
  suggestedMonthly,
  onClose,
  onCreated,
}: {
  /** Monthly amount prefilled from the Copilote suggestion. */
  suggestedMonthly: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sheetHeight = useFormSheetHeight(0.78);
  const keyboardInset = useFormSheetKeyboardInset();

  const [accounts, setAccounts] = useState<SimulatedAccount[]>([]);
  const [free, setFree] = useState<Record<string, number>>({});
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [initial, setInitial] = useState('');
  const [monthly, setMonthly] = useState(() => formatNumberInputFromValue(suggestedMonthly));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [allAccounts, recurring] = await Promise.all([getSimulatedAccounts(), getRecurringPayments()]);
      const usable = allAccounts.filter(isCushionAccount);
      const freeBalances = await freeBalanceByAccount(usable);
      if (cancelled) return;
      setAccounts(usable);
      setFree(freeBalances);
      setPayments(recurring);
      // Bills are paid from the chequing account — start there.
      setAccountId((usable.find((a) => a.kind === 'checking') ?? usable[0])?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tiers = useMemo(() => cushionTiers(monthlyRecurringBills(payments)), [payments]);
  const available = accountId ? (free[accountId] ?? 0) : 0;
  const initialValue = Math.min(amountOf(initial), available);
  const monthlyValue = amountOf(monthly);
  const progress = tierProgress(initialValue, tiers);
  const months = monthsToReach(progress.current.amount, initialValue, monthlyValue);
  const fill = ladderFill(
    initialValue,
    tiers.map((tier) => tier.amount),
  );
  const overCap = amountOf(initial) > available;

  const create = async () => {
    if (!accountId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createBillsCushionGoal({
        accountId,
        monthlyContribution: monthlyValue,
        initialAmount: initialValue,
        isLight,
      });
      successHaptic();
      onCreated();
    } catch {
      setError('Impossible de créer l’objectif. Réessaie.');
      setSaving(false);
    }
  };

  const amountField = (label: string, value: string, onChange: (text: string) => void, a11y: string) => (
    <View style={[styles.amountCard, { backgroundColor: colors.containerBackground }]}>
      <Text style={[styles.amountLabel, { color: colors.textMuted }]}>{label}</Text>
      <NumericAmountInput
        value={value}
        onChangeText={onChange}
        placeholder="0 $"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        style={[styles.amountInput, { color: colors.text }]}
        accessibilityLabel={a11y}
      />
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
              style={[styles.sheet, ghostCardShadow, { backgroundColor: colors.background }]}
            >
              <FormSheetChromeHeader
                title="Factures d’avance"
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
                {/* Where the envelope lives */}
                <View style={styles.chips}>
                  {accounts.map((account) => {
                    const selected = account.id === accountId;
                    return (
                      <Pressable
                        key={account.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${account.name}, ${money(free[account.id] ?? 0)} libres`}
                        onPress={() => {
                          tapHaptic();
                          setAccountId(account.id);
                        }}
                        style={[
                          styles.chip,
                          { backgroundColor: selected ? colors.text : colors.containerBackground },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: selected ? colors.background : colors.text }]} numberOfLines={1}>
                          {chipLabel(account)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {accountId ? (
                  <Text style={[styles.free, { color: overCap ? colors.danger : colors.textMuted }]}>
                    {overCap ? `Maximum ${money(available)}` : `${money(available)} libres`}
                  </Text>
                ) : (
                  <Text style={[styles.free, { color: colors.textMuted }]}>Ajoute d’abord un compte.</Text>
                )}

                {/* The two numbers that drive everything */}
                <View style={styles.amountRow}>
                  {amountField('Déjà de côté', initial, setInitial, 'Montant déjà mis de côté')}
                  {amountField('Par mois', monthly, setMonthly, 'Montant mis de côté chaque mois')}
                </View>

                {/* The ladder: fills as the amounts grow */}
                <View style={styles.ladder}>
                  <View style={[styles.track, { backgroundColor: colors.borderSubtle }]}>
                    <View style={[styles.trackFill, { width: `${fill * 100}%`, backgroundColor: colors.accentGreen }]} />
                  </View>
                  <View style={styles.steps}>
                    {tiers.map((tier) => {
                      const done = initialValue >= tier.amount;
                      const current = !done && tier.id === progress.current.id;
                      return (
                        <View key={tier.id} style={styles.step}>
                          <View
                            style={[
                              styles.node,
                              { backgroundColor: done ? colors.accentGreen : colors.background },
                              { borderColor: done || current ? colors.accentGreen : colors.borderStrong },
                            ]}
                          >
                            {done ? <AppIcon family="ionicons" name="checkmark" size={12} color={colors.background} /> : null}
                          </View>
                          <Text style={[styles.stepLabel, { color: current ? colors.text : colors.textMuted }]} numberOfLines={1}>
                            {tier.label}
                          </Text>
                          <Text style={[styles.stepAmount, { color: current ? colors.text : colors.textMuted }]} numberOfLines={1}>
                            {money(tier.amount)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {months != null && months > 0 ? (
                  <Text style={[styles.estimate, { color: colors.textMuted }]}>
                    {progress.current.label} dans{' '}
                    <Text style={{ color: colors.accentGreen }}>≈ {months} mois</Text>
                  </Text>
                ) : null}

                {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

                <PrimarySaveButton
                  label="Créer"
                  onPress={() => void create()}
                  loading={saving}
                  disabled={!accountId || saving}
                  style={styles.save}
                />
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
  headerPad: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },

  /* Account chips */
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  chipText: { ...jakartaSemiboldText, fontSize: 14 },
  free: { ...jakartaMediumText, fontSize: 13, marginTop: -spacing.sm, paddingHorizontal: 4 },

  /* Amounts */
  amountRow: { flexDirection: 'row', gap: 10 },
  amountCard: { flex: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  amountLabel: { ...jakartaMediumText, fontSize: 12.5 },
  amountInput: { ...jakartaBoldText, fontSize: 24, letterSpacing: -0.5, paddingVertical: 4, minWidth: 0 },

  /* Ladder */
  ladder: { marginTop: spacing.xs },
  track: { position: 'absolute', left: 0, right: 0, top: NODE / 2 - 2, height: 4, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 2 },
  steps: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { ...jakartaMediumText, fontSize: 12 },
  stepAmount: { ...jakartaBoldText, fontSize: 14, letterSpacing: -0.2 },
  estimate: { ...jakartaMediumText, fontSize: 14, textAlign: 'center' },

  error: { ...jakartaMediumText, fontSize: 13, textAlign: 'center' },
  save: { marginTop: spacing.xs },
});

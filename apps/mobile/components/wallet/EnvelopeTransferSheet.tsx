/**
 * Move money inside one account: between the account's free part and its envelopes.
 * Same language as the Virement form (big amount, numpad, source and destination chips), minus
 * everything else. With `focus`, one side is fixed to that envelope and only the other can be picked.
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipSelectField } from '@/components/ChipSelectField';
import { DraggableSheetScrollView, DraggableSheetSurface } from '@/components/DraggableSheetSurface';
import { GhostNumpad } from '@/components/GhostNumpad';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { interNumericExtraBoldText, jakartaMediumText, jakartaSemiboldText, radius, spacing } from '@/constants/theme';
import { getEnvelopesByAccount, moveEnvelopeMoney, type AccountEnvelope } from '@/lib/accountEnvelopes';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { formatMoneyAmountInput } from '@/lib/formatMoneyAmountInput';
import { parseFormattedNumber } from '@/lib/formatNumber';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import {
  FORM_SHEET_CONTENT_PADDING_TOP,
  FormSheetChromeHeader,
  FormSheetModalBody,
  formSheetScrollContentStyle,
  formSheetScrollPaddingBottom,
  formSheetScrollViewStyle,
  useFormSheetHeight,
} from '@/lib/sheet/formSheetScroll';
import { useAppTheme } from '@/lib/themeContext';

/** Picker id for the account's unassigned part. */
const FREE = '__free';

export function EnvelopeTransferSheet({
  visible,
  accountId,
  accountName,
  balance,
  focus,
  onClose,
}: {
  visible: boolean;
  accountId: string;
  accountName: string;
  balance: number;
  focus?: { kind: 'add' | 'remove' | 'transfer'; envelope: AccountEnvelope };
  onClose: () => void;
}) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sheetHeight = useFormSheetHeight(0.92);
  const [envelopes, setEnvelopes] = useState<AccountEnvelope[]>([]);
  const [fromId, setFromId] = useState<string>(FREE);
  const [toId, setToId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const focusKind = focus?.kind ?? null;
  const focusId = focus?.envelope.id ?? null;

  useEffect(() => {
    if (!visible) return;
    setFromId((focusKind === 'remove' || focusKind === 'transfer') && focusId ? focusId : FREE);
    setToId(focusKind === 'add' ? focusId : focusKind === 'remove' ? FREE : null);
    setAmount('');
    setSaving(false);
    void getEnvelopesByAccount().then((byAccount) => {
      const list = byAccount[accountId] ?? [];
      setEnvelopes(list);
      if (!focusId) setToId(list[0]?.id ?? null);
    });
  }, [accountId, focusId, focusKind, visible]);

  const free = balance - envelopes.reduce((sum, e) => sum + e.amount, 0);
  const sources = useMemo(
    () => [
      { id: FREE, label: accountName, amount: free },
      ...envelopes
        .filter((e) => focusKind !== 'add' || e.id !== focusId)
        .map((e) => ({ id: e.id, label: `${e.icon} ${e.name}`, amount: e.amount })),
    ],
    [accountName, envelopes, focusId, focusKind, free],
  );
  const destinations = [
    // Sending money back to the account only makes sense when it comes from an envelope.
    ...(fromId === FREE || focusKind === 'transfer' ? [] : [{ id: FREE, label: accountName }]),
    ...envelopes.filter((e) => e.id !== fromId).map((e) => ({ id: e.id, label: `${e.icon} ${e.name}` })),
  ];
  const fromAmount =
    focusKind === 'remove' || focusKind === 'transfer'
      ? (envelopes.find((e) => e.id === focusId)?.amount ?? 0)
      : (sources.find((s) => s.id === fromId)?.amount ?? 0);
  const parsed = parseFormattedNumber(amount || '0');
  const value = Number.isNaN(parsed) ? 0 : parsed;
  const tooMuch = value > Math.max(0, fromAmount) + 0.001;
  const canSave = value > 0 && !tooMuch && !!toId && toId !== fromId && !saving;

  // Keep the destination valid when the source changes.
  const firstDestinationId = destinations[0]?.id ?? null;
  useEffect(() => {
    if (toId && toId !== fromId) return;
    setToId(firstDestinationId);
  }, [firstDestinationId, fromId, toId]);

  const save = async () => {
    if (!canSave || !toId) return;
    setSaving(true);
    try {
      await moveEnvelopeMoney(fromId === FREE ? null : fromId, toId === FREE ? null : toId, value);
      successHaptic();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  const title = focus
    ? `${focus.kind === 'add' ? 'Ajouter à' : focus.kind === 'remove' ? 'Retirer de' : 'Transférer de'} ${focus.envelope.name}`
    : 'Virer';
  const actionLabel = focusKind === 'add' ? 'Ajouter' : focusKind === 'remove' ? 'Retirer' : focusKind === 'transfer' ? 'Transférer' : 'Virer';

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
                title={title}
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
                  { paddingBottom: formSheetScrollPaddingBottom(insets.bottom) },
                ]}
              >
                {envelopes.length === 0 ? (
                  <Text style={[styles.empty, { color: colors.textMuted }]}>Aucune enveloppe pour ce compte.</Text>
                ) : (
                  <>
                    <View style={styles.amountBlock}>
                      <Text
                        style={[styles.amount, { color: colors.text }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                        accessibilityLabel={`Montant : ${amount || '0'} dollars`}
                      >
                        {`${amount ? formatMoneyAmountInput(amount) : '0'} $`}
                      </Text>
                      <View style={styles.helperRow}>
                        <Text style={[styles.hint, { color: tooMuch ? colors.danger : colors.textMuted }]}>
                          {tooMuch
                            ? 'Plus élevé que la source'
                            : `${formatDisplayMoneyAbsolute(Math.max(0, fromAmount))} disponibles`}
                        </Text>
                        {fromAmount > 0 ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Tout virer"
                            hitSlop={8}
                            onPress={() => {
                              tapHaptic();
                              setAmount(String(Math.round(fromAmount * 100) / 100));
                            }}
                          >
                            <Text style={[styles.helperAction, { color: colors.text }]}>Tout</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>

                    <GhostNumpad value={amount} onChange={setAmount} />

                    {!focusKind || focusKind === 'add' ? (
                      <ChipSelectField label="De" options={sources} selectedId={fromId} onSelect={setFromId} />
                    ) : null}
                    {!focusKind || focusKind === 'transfer' ? (
                      <ChipSelectField
                        label="Vers"
                        options={destinations}
                        selectedId={toId ?? ''}
                        onSelect={setToId}
                        emptyHint="Aucune autre enveloppe"
                      />
                    ) : null}

                    <PrimarySaveButton
                      label={actionLabel}
                      onPress={() => void save()}
                      loading={saving}
                      disabled={!canSave}
                    />
                  </>
                )}
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
  sheet: { borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingTop: FORM_SHEET_CONTENT_PADDING_TOP },
  headerPad: { paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  amountBlock: { alignItems: 'center', gap: 6, paddingTop: spacing.sm },
  amount: { ...interNumericExtraBoldText, fontSize: 48, lineHeight: 58, fontVariant: ['tabular-nums'] },
  helperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  hint: { ...jakartaMediumText, fontSize: 13, lineHeight: 17, flexShrink: 1 },
  helperAction: { ...jakartaSemiboldText, fontSize: 13, lineHeight: 17 },
  empty: { ...jakartaMediumText, fontSize: 14, lineHeight: 20, paddingVertical: spacing.lg, textAlign: 'center' },
});

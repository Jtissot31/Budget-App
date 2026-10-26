/**
 * Move money inside one account: unassigned → envelope, or envelope → envelope.
 * Same minimal look as the envelope sheet: filled group, quiet rows, one button.
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DraggableSheetScrollView, DraggableSheetSurface } from '@/components/DraggableSheetSurface';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { jakartaMediumText, jakartaSemiboldText, radius, spacing } from '@/constants/theme';
import { getEnvelopesByAccount, moveEnvelopeMoney, type AccountEnvelope } from '@/lib/accountEnvelopes';
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

/** Picker id for the account's unassigned part. */
const FREE = '__free';

export function EnvelopeTransferSheet({
  visible,
  accountId,
  balance,
  onClose,
}: {
  visible: boolean;
  accountId: string;
  balance: number;
  onClose: () => void;
}) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sheetHeight = useFormSheetHeight(0.7);
  const keyboardInset = useFormSheetKeyboardInset();
  const [envelopes, setEnvelopes] = useState<AccountEnvelope[]>([]);
  const [fromId, setFromId] = useState<string>(FREE);
  const [toId, setToId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setFromId(FREE);
    setAmount('');
    setSaving(false);
    void getEnvelopesByAccount().then((byAccount) => {
      const list = byAccount[accountId] ?? [];
      setEnvelopes(list);
      setToId(list[0]?.id ?? null);
    });
  }, [accountId, visible]);

  const free = balance - envelopes.reduce((sum, e) => sum + e.amount, 0);
  const sources = useMemo(
    () => [
      { id: FREE, label: 'Non attribué', amount: free },
      ...envelopes.map((e) => ({ id: e.id, label: `${e.icon} ${e.name}`, amount: e.amount })),
    ],
    [envelopes, free],
  );
  const destinations = envelopes.filter((e) => e.id !== fromId);
  const fromAmount = sources.find((s) => s.id === fromId)?.amount ?? 0;
  const parsed = parseFormattedNumber(amount || '0');
  const value = Number.isNaN(parsed) ? 0 : parsed;
  const tooMuch = value > Math.max(0, fromAmount) + 0.001;
  const canSave = value > 0 && !tooMuch && !!toId && toId !== fromId && !saving;

  // Keep the destination valid when the source changes.
  useEffect(() => {
    if (toId && toId !== fromId) return;
    setToId(destinations[0]?.id ?? null);
  }, [destinations, fromId, toId]);

  const save = async () => {
    if (!canSave || !toId) return;
    setSaving(true);
    try {
      await moveEnvelopeMoney(fromId === FREE ? null : fromId, toId, value);
      successHaptic();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const chips = (
    items: { id: string; label: string }[],
    selectedId: string | null,
    onSelect: (id: string) => void,
  ) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.chipRow}>
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              tapHaptic();
              onSelect(item.id);
            }}
            style={[styles.chip, { backgroundColor: selected ? colors.text : colors.surfaceElevated }]}
          >
            <Text style={[styles.chipText, { color: selected ? colors.background : colors.text }]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  if (!visible) return null;

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
                title="Virer vers une enveloppe"
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
                {envelopes.length === 0 ? (
                  <Text style={[styles.empty, { color: colors.textMuted }]}>
                    Aucune enveloppe pour ce compte. Crée-en une depuis Wallet.
                  </Text>
                ) : (
                  <>
                    <View style={styles.block}>
                      <Text style={[styles.label, { color: colors.textMuted }]}>De</Text>
                      {chips(sources, fromId, setFromId)}
                    </View>
                    <View style={styles.block}>
                      <Text style={[styles.label, { color: colors.textMuted }]}>Vers</Text>
                      {destinations.length > 0 ? (
                        chips(destinations.map((e) => ({ id: e.id, label: `${e.icon} ${e.name}` })), toId, setToId)
                      ) : (
                        <Text style={[styles.hint, { color: colors.textMuted }]}>Aucune autre enveloppe</Text>
                      )}
                    </View>

                    <View style={[styles.group, { backgroundColor: colors.containerBackground }]}>
                      <View style={styles.row}>
                        <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Montant</Text>
                        <NumericAmountInput
                          value={amount}
                          onChangeText={setAmount}
                          placeholder="0 $"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                          style={[styles.rowInput, { color: colors.text }]}
                          accessibilityLabel="Montant à virer"
                        />
                      </View>
                    </View>

                    <View style={styles.helperRow}>
                      <Text style={[styles.hint, { color: tooMuch ? colors.danger : colors.textMuted }]}>
                        {tooMuch
                          ? 'Montant plus élevé que la source'
                          : `${formatDisplayMoneyAbsolute(Math.max(0, fromAmount))} disponibles`}
                      </Text>
                      {fromAmount > 0 ? (
                        <Pressable
                          accessibilityRole="button"
                          hitSlop={8}
                          onPress={() => {
                            tapHaptic();
                            setAmount(formatNumberInputFromValue(Math.round(fromAmount * 100) / 100));
                          }}
                        >
                          <Text style={[styles.helperAction, { color: colors.text }]}>Tout</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    <PrimarySaveButton label="Virer" onPress={() => void save()} loading={saving} disabled={!canSave} />
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
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  block: { gap: spacing.sm },
  label: { ...jakartaMediumText, fontSize: 13 },
  chipRow: { gap: 6 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center' },
  chipText: { ...jakartaMediumText, fontSize: 14 },
  group: { borderRadius: 16, overflow: 'hidden', marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16 },
  rowLabel: { ...jakartaMediumText, fontSize: 15 },
  rowInput: { flex: 1, minWidth: 0, ...jakartaMediumText, fontSize: 15, paddingVertical: 12, textAlign: 'right' },
  helperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: 4 },
  hint: { ...jakartaMediumText, fontSize: 12.5, flexShrink: 1 },
  helperAction: { ...jakartaSemiboldText, fontSize: 12.5 },
  empty: { ...jakartaMediumText, fontSize: 14, lineHeight: 20, paddingVertical: spacing.lg, textAlign: 'center' },
});

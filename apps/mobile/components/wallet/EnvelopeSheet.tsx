/**
 * Create / edit an envelope — built like the app's other form sheets (add-transaction,
 * new account): chrome header, small section labels, 48 px inputs, primary save button.
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DraggableSheetScrollView, DraggableSheetSurface } from '@/components/DraggableSheetSurface';
import { PressScale } from '@/components/kit/motion';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ghostCardShadow } from '@/constants/ghostUi';
import {
  FORM_SECTION_LABEL_STYLE,
  jakartaMediumText,
  jakartaSemiboldText,
  radius,
  spacing,
} from '@/constants/theme';
import {
  DEFAULT_ENVELOPE_ICON,
  deleteEnvelope,
  ENVELOPE_EMOJIS,
  ENVELOPE_PRESETS,
  isEnvelopeEmoji,
  saveEnvelope,
} from '@/lib/accountEnvelopes';
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
import type { EnvelopeDraft } from '@/components/wallet/AccountEnvelopes';

export function EnvelopeSheet({
  draft,
  accountName,
  /** Amount still free in the account, excluding this envelope's own current amount. */
  available,
  onClose,
}: {
  draft: EnvelopeDraft | null;
  accountName: string;
  available: number;
  onClose: () => void;
}) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sheetHeight = useFormSheetHeight(0.82);
  const keyboardInset = useFormSheetKeyboardInset();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(DEFAULT_ENVELOPE_ICON);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!draft) return;
    setName(draft.envelope.name);
    setIcon(isEnvelopeEmoji(draft.envelope.icon) ? draft.envelope.icon : DEFAULT_ENVELOPE_ICON);
    setAmount(draft.isNew || !draft.envelope.amount ? '' : formatNumberInputFromValue(draft.envelope.amount));
    setSaving(false);
  }, [draft]);

  if (!draft) return null;

  const parsed = parseFormattedNumber(amount || '0');
  const amountValue = Number.isNaN(parsed) ? 0 : parsed;
  const remainingAfter = available - amountValue;
  const canSave = name.trim().length > 0 && !saving;
  const inputSurface = { backgroundColor: colors.input, borderColor: colors.border };
  const label = [FORM_SECTION_LABEL_STYLE, { color: colors.textMuted }];

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    await saveEnvelope({ ...draft.envelope, name: name.trim(), icon, amount: Math.max(0, amountValue) }, draft.isNew);
    successHaptic();
    onClose();
  };

  const remove = async () => {
    tapHaptic();
    await deleteEnvelope(draft.envelope.id);
    onClose();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.backdrop, { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
          <FormSheetModalBody>
            <DraggableSheetSurface
              onClose={onClose}
              sheetHeight={sheetHeight}
              style={[styles.sheet, ghostCardShadow, { backgroundColor: colors.background, borderColor: colors.containerBorder }]}
            >
              <FormSheetChromeHeader
                title={draft.isNew ? 'Nouvelle enveloppe' : 'Modifier l’enveloppe'}
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
                <Text style={[styles.context, { color: colors.textMuted }]} numberOfLines={1}>
                  Dans {accountName}
                </Text>

                {/* Name, with the chosen emoji at the start of the row */}
                <View style={styles.section}>
                  <Text style={label}>Nom</Text>
                  <View style={[styles.nameRow, inputSurface]}>
                    <Text style={styles.nameEmoji}>{icon}</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Ex. Factures"
                      placeholderTextColor={colors.textMuted}
                      autoFocus={draft.isNew && !draft.envelope.name}
                      returnKeyType="next"
                      onSubmitEditing={() => amountRef.current?.focus()}
                      style={[styles.nameInput, { color: colors.text }]}
                      accessibilityLabel="Nom de l’enveloppe"
                    />
                  </View>
                  {draft.isNew ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.chipRow}>
                      {ENVELOPE_PRESETS.map((preset) => {
                        const selected = name === preset.name;
                        return (
                          <PressScale
                            key={preset.name}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            onPress={() => {
                              tapHaptic();
                              setName(preset.name);
                              setIcon(preset.icon);
                            }}
                            scaleTo={0.94}
                            style={[styles.chip, { backgroundColor: selected ? colors.text : colors.surfaceElevated }]}
                          >
                            <Text style={styles.chipEmoji}>{preset.icon}</Text>
                            <Text style={[styles.chipText, { color: selected ? colors.background : colors.text }]}>{preset.name}</Text>
                          </PressScale>
                        );
                      })}
                    </ScrollView>
                  ) : null}
                </View>

                {/* Emoji — compact inline row */}
                <View style={styles.section}>
                  <Text style={label}>Emoji</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.emojiRow}>
                    {ENVELOPE_EMOJIS.map((emoji) => {
                      const selected = icon === emoji;
                      return (
                        <PressScale
                          key={emoji}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={emoji}
                          onPress={() => {
                            tapHaptic();
                            setIcon(emoji);
                          }}
                          scaleTo={0.88}
                          style={[
                            styles.emojiOption,
                            { backgroundColor: selected ? colors.surfaceElevated : 'transparent', borderColor: selected ? colors.text : 'transparent' },
                          ]}
                        >
                          <Text style={styles.emojiText}>{emoji}</Text>
                        </PressScale>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Amount */}
                <View style={styles.section}>
                  <Text style={label}>Montant</Text>
                  <View style={[styles.amountRow, inputSurface]}>
                    <NumericAmountInput
                      ref={amountRef}
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      style={[styles.amountInput, { color: colors.text }]}
                      accessibilityLabel="Montant de l’enveloppe"
                    />
                    <Text style={[styles.suffix, { color: colors.textMuted }]}>$</Text>
                  </View>
                  <View style={styles.helperRow}>
                    <Text style={[styles.helper, { color: remainingAfter < 0 ? colors.danger : colors.textMuted }]}>
                      {remainingAfter < 0
                        ? `Dépasse le solde de ${formatDisplayMoneyAbsolute(-remainingAfter)}`
                        : `Reste à répartir : ${formatDisplayMoneyAbsolute(remainingAfter)}`}
                    </Text>
                    {available > 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => {
                          tapHaptic();
                          setAmount(formatNumberInputFromValue(Math.round(available * 100) / 100));
                        }}
                      >
                        <Text style={[styles.helperAction, { color: colors.text }]}>Tout le reste</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={!canSave && styles.disabled}>
                  <PrimarySaveButton
                    label={draft.isNew ? 'Créer l’enveloppe' : 'Enregistrer'}
                    onPress={() => void save()}
                    loading={saving}
                    disabled={!canSave}
                  />
                </View>

                {!draft.isNew ? (
                  <Pressable accessibilityRole="button" onPress={() => void remove()} hitSlop={8} style={styles.deleteRow}>
                    <Text style={[styles.deleteText, { color: colors.danger }]}>Supprimer l’enveloppe</Text>
                  </Pressable>
                ) : null}
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
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: FORM_SHEET_CONTENT_PADDING_TOP,
  },
  headerPad: { paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md + 2 },
  context: { ...jakartaMediumText, fontSize: 13, marginTop: -spacing.xs },
  section: { gap: spacing.sm },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  nameEmoji: { fontSize: 20 },
  nameInput: { flex: 1, minWidth: 0, ...jakartaMediumText, fontSize: 15, paddingVertical: 10 },
  chipRow: { gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 11, borderRadius: 16 },
  chipEmoji: { fontSize: 13 },
  chipText: { ...jakartaMediumText, fontSize: 13 },

  emojiRow: { gap: 4 },
  emojiOption: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 20 },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  amountInput: { flex: 1, minWidth: 0, ...jakartaSemiboldText, fontSize: 18, paddingVertical: 8 },
  suffix: { ...jakartaMediumText, fontSize: 15 },
  helperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  helper: { ...jakartaMediumText, fontSize: 12.5, flexShrink: 1 },
  helperAction: { ...jakartaSemiboldText, fontSize: 12.5 },

  disabled: { opacity: 0.45 },
  deleteRow: { alignItems: 'center', paddingVertical: 4 },
  deleteText: { ...jakartaSemiboldText, fontSize: 14 },
});

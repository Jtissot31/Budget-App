/**
 * Create / edit an envelope — built for speed and calm:
 *   1. one tap on a suggestion (💡 Factures, 🎉 Loisirs…) fills the emoji + name,
 *   2. the amount is the hero (big, centred) with 25 % / 50 % / Tout shortcuts,
 *   3. one button.
 * The emoji is tappable to change it; the name is a plain centred field. No grouped form rows.
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DraggableSheetScrollView, DraggableSheetSurface } from '@/components/DraggableSheetSurface';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ghostCardShadow } from '@/constants/ghostUi';
import {
  jakartaBoldText,
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

/** Amount shortcuts: share of what is still free in the account. */
const QUICK_AMOUNTS: { label: string; share: number }[] = [
  { label: '25 %', share: 0.25 },
  { label: '50 %', share: 0.5 },
  { label: 'Tout', share: 1 },
];

const money = formatDisplayMoneyAbsolute;

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
  const sheetHeight = useFormSheetHeight(0.76);
  const keyboardInset = useFormSheetKeyboardInset();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(DEFAULT_ENVELOPE_ICON);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const amountRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!draft) return;
    setName(draft.envelope.name);
    setIcon(isEnvelopeEmoji(draft.envelope.icon) ? draft.envelope.icon : DEFAULT_ENVELOPE_ICON);
    setAmount(draft.isNew || !draft.envelope.amount ? '' : formatNumberInputFromValue(draft.envelope.amount));
    setSaving(false);
    setEmojiOpen(false);
  }, [draft]);

  if (!draft) return null;

  const parsed = parseFormattedNumber(amount || '0');
  const amountValue = Number.isNaN(parsed) ? 0 : parsed;
  const remainingAfter = available - amountValue;
  const canSave = name.trim().length > 0 && !saving;
  const cents = (value: number) => Math.round(value * 100) / 100;

  const pickPreset = (preset: { name: string; icon: string }) => {
    tapHaptic();
    setName(preset.name);
    setIcon(preset.icon);
    setEmojiOpen(false);
    // The name is settled — the amount is the only thing left to type.
    amountRef.current?.focus();
  };

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
              style={[styles.sheet, ghostCardShadow, { backgroundColor: colors.background }]}
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

                {/* One-tap starting points (new envelopes only) */}
                {draft.isNew ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="always"
                    style={styles.presetsScroll}
                    contentContainerStyle={styles.presets}
                  >
                    {ENVELOPE_PRESETS.map((preset) => {
                      const active = name.trim() === preset.name && icon === preset.icon;
                      return (
                        <Pressable
                          key={preset.name}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() => pickPreset(preset)}
                          style={[styles.chip, { backgroundColor: active ? colors.text : colors.containerBackground }]}
                        >
                          <Text style={styles.chipEmoji}>{preset.icon}</Text>
                          <Text style={[styles.chipLabel, { color: active ? colors.background : colors.text }]}>
                            {preset.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : null}

                {/* Emoji + name */}
                <View style={styles.identity}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Changer l’emoji"
                    hitSlop={8}
                    onPress={() => {
                      tapHaptic();
                      setEmojiOpen((open) => !open);
                    }}
                    style={[styles.emojiButton, { backgroundColor: colors.containerBackground }]}
                  >
                    <Text style={styles.emoji}>{icon}</Text>
                  </Pressable>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Nom"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="next"
                    onSubmitEditing={() => amountRef.current?.focus()}
                    style={[styles.nameInput, { color: colors.text }]}
                    accessibilityLabel="Nom de l’enveloppe"
                  />
                </View>

                {emojiOpen ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="always"
                    contentContainerStyle={styles.emojiRow}
                  >
                    {ENVELOPE_EMOJIS.map((emoji) => (
                      <Pressable
                        key={emoji}
                        accessibilityRole="button"
                        accessibilityState={{ selected: icon === emoji }}
                        accessibilityLabel={emoji}
                        onPress={() => {
                          tapHaptic();
                          setIcon(emoji);
                          setEmojiOpen(false);
                        }}
                        style={[styles.emojiOption, icon !== emoji && styles.emojiDim]}
                      >
                        <Text style={styles.emojiOptionText}>{emoji}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}

                {/* The amount is the hero */}
                <View style={styles.amountBlock}>
                  <NumericAmountInput
                    ref={amountRef}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0 $"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    style={[styles.amountInput, { color: colors.text }]}
                    accessibilityLabel="Montant de l’enveloppe"
                  />
                  <Text style={[styles.helper, { color: remainingAfter < 0 ? colors.danger : colors.textMuted }]}>
                    {remainingAfter < 0
                      ? `Dépasse le solde de ${money(-remainingAfter)}`
                      : `${money(remainingAfter)} disponibles`}
                  </Text>
                  {available > 0 ? (
                    <View style={styles.quickRow}>
                      {QUICK_AMOUNTS.map((quick) => (
                        <Pressable
                          key={quick.label}
                          accessibilityRole="button"
                          accessibilityLabel={`${quick.label} du disponible`}
                          onPress={() => {
                            tapHaptic();
                            setAmount(formatNumberInputFromValue(cents(available * quick.share)));
                          }}
                          style={[styles.quick, { backgroundColor: colors.containerBackground }]}
                        >
                          <Text style={[styles.quickText, { color: colors.text }]}>{quick.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>

                <PrimarySaveButton
                  label={draft.isNew ? 'Créer' : 'Enregistrer'}
                  onPress={() => void save()}
                  loading={saving}
                  disabled={!canSave}
                  style={styles.save}
                />

                {!draft.isNew ? (
                  <Pressable accessibilityRole="button" onPress={() => void remove()} hitSlop={8} style={styles.deleteRow}>
                    <Text style={[styles.deleteText, { color: colors.danger }]}>Supprimer</Text>
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
    paddingTop: FORM_SHEET_CONTENT_PADDING_TOP,
  },
  headerPad: { paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  context: { ...jakartaMediumText, fontSize: 13, marginTop: -spacing.sm },

  /* Suggestions */
  presetsScroll: { marginHorizontal: -spacing.lg },
  presets: { gap: 8, paddingHorizontal: spacing.lg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20 },
  chipEmoji: { fontSize: 16 },
  chipLabel: { ...jakartaSemiboldText, fontSize: 14 },

  /* Emoji + name */
  identity: { alignItems: 'center', gap: spacing.sm },
  emojiButton: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 36, lineHeight: 46 },
  nameInput: {
    ...jakartaSemiboldText,
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: -0.4,
    paddingVertical: 8,
  },
  emojiRow: { gap: 2, paddingHorizontal: 2 },
  emojiOption: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emojiOptionText: { fontSize: 24 },
  emojiDim: { opacity: 0.45 },

  /* Amount */
  amountBlock: { alignItems: 'center', gap: spacing.sm },
  amountInput: {
    ...jakartaBoldText,
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: 44,
    letterSpacing: -1.2,
    paddingVertical: 4,
  },
  helper: { ...jakartaMediumText, fontSize: 13 },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  quick: { height: 34, paddingHorizontal: 16, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  quickText: { ...jakartaSemiboldText, fontSize: 13 },

  save: { marginTop: spacing.xs },
  deleteRow: { alignItems: 'center', paddingVertical: 4 },
  deleteText: { ...jakartaMediumText, fontSize: 14 },
});

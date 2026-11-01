/**
 * Create / edit an envelope: a name and an emoji, nothing else. A new envelope starts at 0 $;
 * money moves through Ajouter / Retirer on its detail page, and deleting lives there too.
 */
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DraggableSheetScrollView, DraggableSheetSurface } from '@/components/DraggableSheetSurface';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ghostCardShadow } from '@/constants/ghostUi';
import { jakartaMediumText, jakartaSemiboldText, radius, spacing } from '@/constants/theme';
import { DEFAULT_ENVELOPE_ICON, ENVELOPE_EMOJIS, isEnvelopeEmoji, saveEnvelope } from '@/lib/accountEnvelopes';
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

const EMOJI_COLUMNS = 6;
const EMOJI_GAP = 8;
/** Tall on purpose: the Android keyboard overlays the sheet, so the form must sit in its upper half. */
const SHEET_HEIGHT_RATIO = 0.92;
/** Lets the Modal's slide-in finish; Android ignores a focus request made before that. */
const FOCUS_DELAY_MS = 320;

export function EnvelopeSheet({
  draft,
  onClose,
}: {
  draft: EnvelopeDraft | null;
  onClose: () => void;
}) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sheetHeight = useFormSheetHeight(SHEET_HEIGHT_RATIO);
  const nameInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const keyboardInset = useFormSheetKeyboardInset();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(DEFAULT_ENVELOPE_ICON);
  const [saving, setSaving] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    if (!draft) return;
    setName(draft.envelope.name);
    setIcon(isEnvelopeEmoji(draft.envelope.icon) ? draft.envelope.icon : DEFAULT_ENVELOPE_ICON);
    setSaving(false);
  }, [draft]);

  useEffect(() => {
    if (!draft?.isNew) return;
    const timer = setTimeout(() => nameInputRef.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  if (!draft) return null;

  const canSave = name.trim().length > 0 && !saving;
  const emojiCell = Math.floor((gridWidth - EMOJI_GAP * (EMOJI_COLUMNS - 1)) / EMOJI_COLUMNS);
  const fieldSurface = { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    await saveEnvelope({ ...draft.envelope, name: name.trim(), icon }, draft.isNew);
    successHaptic();
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
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Nom</Text>
                  <View style={[styles.inputShell, fieldSurface]}>
                    <TextInput
                      ref={nameInputRef}
                      value={name}
                      onChangeText={setName}
                      placeholder="Ex. : Factures"
                      placeholderTextColor={colors.textMuted}
                      maxLength={32}
                      returnKeyType="done"
                      style={[styles.input, { color: colors.text }]}
                      accessibilityLabel="Nom de l’enveloppe"
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Emoji</Text>
                  <View
                    style={styles.emojiGrid}
                    onLayout={(event) => setGridWidth(Math.floor(event.nativeEvent.layout.width))}
                  >
                    {emojiCell > 0
                      ? ENVELOPE_EMOJIS.map((emoji) => {
                          const selected = icon === emoji;
                          return (
                            <Pressable
                              key={emoji}
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                              accessibilityLabel={emoji}
                              onPress={() => {
                                tapHaptic();
                                setIcon(emoji);
                              }}
                            >
                              <View
                                style={[
                                  styles.emojiCell,
                                  { width: emojiCell, height: emojiCell },
                                  selected
                                    ? { backgroundColor: colors.surfaceElevated, borderColor: colors.text }
                                    : fieldSurface,
                                ]}
                              >
                                <Text style={styles.emoji}>{emoji}</Text>
                              </View>
                            </Pressable>
                          );
                        })
                      : null}
                  </View>
                </View>

                <PrimarySaveButton
                  label={draft.isNew ? 'Créer' : 'Enregistrer'}
                  onPress={() => void save()}
                  loading={saving}
                  disabled={!canSave}
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
  headerPad: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },

  field: { gap: 8 },
  label: { ...jakartaMediumText, fontSize: 13, lineHeight: 17 },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { ...jakartaSemiboldText, flexGrow: 1, flexShrink: 1, fontSize: 16, paddingVertical: 0 },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: EMOJI_GAP },
  emojiCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emoji: { fontSize: 21, lineHeight: 27 },
});

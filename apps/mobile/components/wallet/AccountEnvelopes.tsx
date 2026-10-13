/**
 * Envelopes inside a Wallet account row: an expandable panel (split bar + one row per
 * envelope + « Non attribué », or a short empty state with suggestions) and the
 * create / edit sheet (emoji + name + amount).
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DraggableSheetScrollView, DraggableSheetSurface } from '@/components/DraggableSheetSurface';
import { AppIcon } from '@/components/icons/AppIcon';
import { accentForKey } from '@/components/kit/charts';
import { AnimatedFill, PressScale, Reveal } from '@/components/kit/motion';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { jakartaBoldText, jakartaMediumText, jakartaSemiboldText, spacing } from '@/constants/theme';
import {
  DEFAULT_ENVELOPE_ICON,
  deleteEnvelope,
  ENVELOPE_EMOJIS,
  ENVELOPE_PRESETS,
  isEnvelopeEmoji,
  newEnvelopeId,
  saveEnvelope,
  type AccountEnvelope,
} from '@/lib/accountEnvelopes';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { formatNumberInputFromValue, parseFormattedNumber } from '@/lib/formatNumber';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { FormSheetModalBody, formSheetScrollViewStyle, useFormSheetHeight } from '@/lib/sheet/formSheetScroll';
import { useAppTheme } from '@/lib/themeContext';

const PANEL_INSET = 14 + 40 + 12; // row padding + logo + gap — aligns with the account title
const EMPTY_SUGGESTIONS = ENVELOPE_PRESETS.slice(0, 3);

type Preset = { name: string; icon: string };

function money(value: number): string {
  return `${value < 0 ? '−' : ''}${formatDisplayMoneyAbsolute(Math.abs(value))}`;
}

/** Emoji for new envelopes, Ionicons glyph for older ones. */
function EnvelopeGlyph({ icon, size, color }: { icon: string; size: number; color: string }) {
  if (isEnvelopeEmoji(icon)) return <Text style={{ fontSize: size, lineHeight: size * 1.25 }}>{icon}</Text>;
  return <AppIcon family="ionicons" name={icon} size={size} color={color} />;
}

/* ───────────────────────── Panel ───────────────────────── */

export function AccountEnvelopesPanel({
  balance,
  envelopes,
  hideBalances,
  onAdd,
  onEdit,
}: {
  balance: number;
  envelopes: AccountEnvelope[];
  hideBalances: boolean;
  onAdd: (preset?: Preset) => void;
  onEdit: (envelope: AccountEnvelope) => void;
}) {
  const { colors } = useAppTheme();
  const assigned = envelopes.reduce((sum, envelope) => sum + envelope.amount, 0);
  const unassigned = balance - assigned;
  const base = Math.max(balance, assigned, 1);
  const show = (value: number) => (hideBalances ? '••••' : money(value));
  const add = (preset?: Preset) => {
    tapHaptic();
    onAdd(preset);
  };

  if (envelopes.length === 0) {
    return (
      <Reveal style={[styles.panel, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.emptyLine, { color: colors.textMuted }]}>Réserve une partie du solde pour un usage précis.</Text>
        <View style={styles.suggestions}>
          {EMPTY_SUGGESTIONS.map((preset) => (
            <PressScale
              key={preset.name}
              accessibilityRole="button"
              accessibilityLabel={`Créer l’enveloppe ${preset.name}`}
              onPress={() => add(preset)}
              scaleTo={0.94}
              style={[styles.suggestion, { backgroundColor: colors.surfaceElevated }]}
            >
              <Text style={styles.suggestionEmoji}>{preset.icon}</Text>
              <Text style={[styles.suggestionText, { color: colors.text }]}>{preset.name}</Text>
            </PressScale>
          ))}
        </View>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Créer une enveloppe"
          onPress={() => add()}
          scaleTo={0.97}
          style={[styles.primaryButton, { backgroundColor: colors.text }]}
        >
          <AppIcon family="ionicons" name="add" size={18} color={colors.background} />
          <Text style={[styles.primaryText, { color: colors.background }]}>Créer une enveloppe</Text>
        </PressScale>
      </Reveal>
    );
  }

  return (
    <Reveal style={[styles.panel, { borderTopColor: colors.borderSubtle }]}>
      <View style={[styles.splitBar, { backgroundColor: colors.borderSubtle }]}>
        {envelopes.map((envelope) =>
          envelope.amount > 0 ? (
            <View key={envelope.id} style={{ flex: envelope.amount / base, backgroundColor: accentForKey(envelope.id) }} />
          ) : null,
        )}
        {unassigned > 0 ? <View style={{ flex: unassigned / base }} /> : null}
      </View>

      {envelopes.map((envelope) => {
        const accent = accentForKey(envelope.id);
        return (
          <PressScale
            key={envelope.id}
            accessibilityRole="button"
            accessibilityLabel={`${envelope.name}, ${show(envelope.amount)}. Modifier`}
            onPress={() => {
              tapHaptic();
              onEdit(envelope);
            }}
            scaleTo={0.98}
            style={styles.envRow}
          >
            <View style={[styles.envIcon, { backgroundColor: `${accent}24` }]}>
              <EnvelopeGlyph icon={envelope.icon} size={14} color={accent} />
            </View>
            <View style={styles.envCopy}>
              <Text style={[styles.envName, { color: colors.text }]} numberOfLines={1}>
                {envelope.name}
              </Text>
              {!hideBalances && balance > 0 ? (
                <View style={[styles.envTrack, { backgroundColor: colors.borderSubtle }]}>
                  <AnimatedFill progress={envelope.amount / Math.max(balance, 1)} style={[styles.envFill, { backgroundColor: accent }]} />
                </View>
              ) : null}
            </View>
            <Text style={[styles.envAmount, { color: colors.text }]}>{show(envelope.amount)}</Text>
          </PressScale>
        );
      })}

      <View style={styles.envRow}>
        <View style={[styles.envIcon, { backgroundColor: colors.surfaceElevated }]}>
          <AppIcon
            family="ionicons"
            name={unassigned < 0 ? 'alert' : 'ellipsis-horizontal'}
            size={14}
            color={unassigned < 0 ? colors.danger : colors.textMuted}
          />
        </View>
        <Text style={[styles.envName, styles.envCopy, { color: unassigned < 0 ? colors.danger : colors.textMuted }]}>
          {unassigned < 0 ? 'Dépassement du solde' : 'Non attribué'}
        </Text>
        <Text style={[styles.envAmount, { color: unassigned < 0 ? colors.danger : colors.textMuted }]}>{show(unassigned)}</Text>
      </View>

      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Nouvelle enveloppe"
        onPress={() => add()}
        scaleTo={0.97}
        style={[styles.secondaryButton, { backgroundColor: colors.surfaceElevated }]}
      >
        <AppIcon family="ionicons" name="add" size={18} color={colors.text} />
        <Text style={[styles.secondaryText, { color: colors.text }]}>Nouvelle enveloppe</Text>
      </PressScale>
    </Reveal>
  );
}

/* ───────────────────────── Sheet ───────────────────────── */

export type EnvelopeDraft = { envelope: AccountEnvelope; isNew: boolean };

export function newEnvelopeDraft(accountId: string, displayOrder: number, preset?: Preset): EnvelopeDraft {
  return {
    isNew: true,
    envelope: {
      id: newEnvelopeId(),
      accountId,
      name: preset?.name ?? '',
      icon: preset?.icon ?? DEFAULT_ENVELOPE_ICON,
      amount: 0,
      displayOrder,
      createdAt: new Date().toISOString(),
    },
  };
}

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
  const sheetHeight = useFormSheetHeight(0.86);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(DEFAULT_ENVELOPE_ICON);
  const [amount, setAmount] = useState('');
  const [pickingEmoji, setPickingEmoji] = useState(false);
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!draft) return;
    setName(draft.envelope.name);
    setIcon(draft.envelope.icon);
    setAmount(draft.isNew || !draft.envelope.amount ? '' : formatNumberInputFromValue(draft.envelope.amount));
    setPickingEmoji(false);
    setSaving(false);
  }, [draft]);

  if (!draft) return null;

  const parsed = parseFormattedNumber(amount || '0');
  const amountValue = Number.isNaN(parsed) ? 0 : parsed;
  const remainingAfter = available - amountValue;
  const canSave = name.trim().length > 0 && !saving;

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
            <DraggableSheetSurface onClose={onClose} sheetHeight={sheetHeight} style={[styles.sheet, { backgroundColor: colors.background }]}>
              <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
              <View style={styles.topBar}>
                <Text style={[styles.topTitle, { color: colors.textMuted }]} numberOfLines={1}>
                  {draft.isNew ? 'Nouvelle enveloppe' : 'Enveloppe'} · {accountName}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onClose} hitSlop={14}>
                  <AppIcon family="ionicons" name="close" size={22} color={colors.textMuted} />
                </Pressable>
              </View>

              <DraggableSheetScrollView
                style={[styles.list, formSheetScrollViewStyle()]}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.md) + 32 }]}
              >
                {/* Identity: big emoji + name as a title */}
                <View style={styles.identity}>
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel="Choisir un emoji"
                    onPress={() => {
                      tapHaptic();
                      setPickingEmoji((open) => !open);
                    }}
                    scaleTo={0.9}
                    style={[styles.emojiWell, { backgroundColor: colors.surfaceElevated }]}
                  >
                    <EnvelopeGlyph icon={icon} size={34} color={colors.text} />
                    <View style={[styles.emojiBadge, { backgroundColor: colors.text, borderColor: colors.background }]}>
                      <AppIcon family="ionicons" name={pickingEmoji ? 'chevron-up' : 'pencil'} size={10} color={colors.background} />
                    </View>
                  </PressScale>

                  {pickingEmoji ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.emojiRow}>
                      {ENVELOPE_EMOJIS.map((emoji) => (
                        <PressScale
                          key={emoji}
                          accessibilityRole="button"
                          accessibilityLabel={emoji}
                          onPress={() => {
                            tapHaptic();
                            setIcon(emoji);
                            setPickingEmoji(false);
                          }}
                          scaleTo={0.85}
                          style={[styles.emojiOption, icon === emoji && { backgroundColor: colors.surfaceElevated }]}
                        >
                          <Text style={styles.emojiOptionText}>{emoji}</Text>
                        </PressScale>
                      ))}
                    </ScrollView>
                  ) : null}

                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Nom de l’enveloppe"
                    placeholderTextColor={colors.textMuted}
                    autoFocus={draft.isNew && !draft.envelope.name}
                    returnKeyType="next"
                    onSubmitEditing={() => amountRef.current?.focus()}
                    style={[styles.nameInput, { color: colors.text }]}
                    textAlign="center"
                    accessibilityLabel="Nom de l’enveloppe"
                  />
                </View>

                {/* Suggestions — emoji + name in one tap */}
                {draft.isNew ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.presetRow}>
                    {ENVELOPE_PRESETS.map((preset) => {
                      const selected = name === preset.name && icon === preset.icon;
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
                          style={[styles.preset, { backgroundColor: selected ? colors.text : colors.surfaceElevated }]}
                        >
                          <Text style={styles.presetEmoji}>{preset.icon}</Text>
                          <Text style={[styles.presetText, { color: selected ? colors.background : colors.text }]}>{preset.name}</Text>
                        </PressScale>
                      );
                    })}
                  </ScrollView>
                ) : null}

                {/* Amount — centred hero figure */}
                <View style={[styles.amountCard, { backgroundColor: colors.surfaceElevated }]}>
                  <View style={styles.amountRow}>
                    <NumericAmountInput
                      ref={amountRef}
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      style={[styles.amountInput, { color: colors.text }]}
                      textAlign="center"
                      accessibilityLabel="Montant de l’enveloppe"
                    />
                    <Text style={[styles.amountSuffix, { color: colors.textMuted }]}>$</Text>
                  </View>
                  <View style={styles.remainingRow}>
                    <Text style={[styles.remaining, { color: remainingAfter < 0 ? colors.danger : colors.textMuted }]}>
                      {remainingAfter < 0
                        ? `Dépasse le solde de ${formatDisplayMoneyAbsolute(-remainingAfter)}`
                        : `Reste à répartir : ${formatDisplayMoneyAbsolute(remainingAfter)}`}
                    </Text>
                    {available > 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          tapHaptic();
                          setAmount(formatNumberInputFromValue(Math.round(available * 100) / 100));
                        }}
                        hitSlop={8}
                        style={[styles.fillAll, { backgroundColor: colors.background }]}
                      >
                        <Text style={[styles.fillAllText, { color: colors.text }]}>Tout le reste</Text>
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
  /* Panel */
  panel: {
    marginLeft: PANEL_INSET,
    marginRight: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  emptyLine: { ...jakartaMediumText, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 11, borderRadius: 16 },
  suggestionEmoji: { fontSize: 14 },
  suggestionText: { ...jakartaSemiboldText, fontSize: 13 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 22 },
  primaryText: { ...jakartaBoldText, fontSize: 14 },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 21, marginTop: 6 },
  secondaryText: { ...jakartaSemiboldText, fontSize: 14 },
  splitBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2, marginBottom: 8 },
  envRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  envIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  envCopy: { flex: 1, minWidth: 0, gap: 4 },
  envName: { ...jakartaMediumText, fontSize: 14 },
  envTrack: { height: 3, borderRadius: 1.5, overflow: 'hidden' },
  envFill: { height: '100%', borderRadius: 1.5 },
  envAmount: { ...jakartaSemiboldText, fontSize: 14 },

  /* Sheet */
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: spacing.sm, marginBottom: spacing.sm },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  topTitle: { ...jakartaSemiboldText, fontSize: 13, flexShrink: 1 },
  list: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },

  identity: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm },
  emojiWell: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emojiBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiRow: { gap: 4, paddingHorizontal: 2 },
  emojiOption: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emojiOptionText: { fontSize: 24 },
  nameInput: { ...jakartaBoldText, fontSize: 24, letterSpacing: -0.4, alignSelf: 'stretch', paddingVertical: 4 },

  presetRow: { gap: 8 },
  preset: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 13, borderRadius: 18 },
  presetEmoji: { fontSize: 15 },
  presetText: { ...jakartaSemiboldText, fontSize: 13.5 },

  amountCard: { borderRadius: 24, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, alignSelf: 'stretch' },
  amountInput: { ...jakartaBoldText, fontSize: 36, letterSpacing: -1, minWidth: 80, paddingVertical: 0 },
  amountSuffix: { ...jakartaBoldText, fontSize: 26 },
  remainingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  remaining: { ...jakartaMediumText, fontSize: 12.5 },
  fillAll: { height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center' },
  fillAllText: { ...jakartaSemiboldText, fontSize: 12 },

  disabled: { opacity: 0.45 },
  deleteRow: { alignItems: 'center', paddingVertical: 4 },
  deleteText: { ...jakartaSemiboldText, fontSize: 14 },
});

/**
 * Envelopes inside a Wallet account row: an expandable panel (split bar + one row per
 * envelope + « Non attribué ») and the create / edit sheet.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DraggableSheetScrollView, DraggableSheetSurface } from '@/components/DraggableSheetSurface';
import { AppIcon } from '@/components/icons/AppIcon';
import { accentForKey } from '@/components/kit/charts';
import { AnimatedFill, PressScale, Reveal } from '@/components/kit/motion';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import {
  FORM_SECTION_LABEL_STYLE,
  jakartaBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  radius,
  spacing,
} from '@/constants/theme';
import {
  deleteEnvelope,
  ENVELOPE_ICONS,
  ENVELOPE_PRESETS,
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

function money(value: number): string {
  return `${value < 0 ? '−' : ''}${formatDisplayMoneyAbsolute(Math.abs(value))}`;
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
  onAdd: () => void;
  onEdit: (envelope: AccountEnvelope) => void;
}) {
  const { colors } = useAppTheme();
  const assigned = envelopes.reduce((sum, envelope) => sum + envelope.amount, 0);
  const unassigned = balance - assigned;
  const base = Math.max(balance, assigned, 1);
  const show = (value: number) => (hideBalances ? '••••' : money(value));

  return (
    <Reveal style={[styles.panel, { borderTopColor: colors.borderSubtle }]}>
      {envelopes.length > 0 ? (
        <View style={[styles.splitBar, { backgroundColor: colors.borderSubtle }]}>
          {envelopes.map((envelope) =>
            envelope.amount > 0 ? (
              <View
                key={envelope.id}
                style={{ flex: envelope.amount / base, backgroundColor: accentForKey(envelope.id) }}
              />
            ) : null,
          )}
          {unassigned > 0 ? <View style={{ flex: unassigned / base }} /> : null}
        </View>
      ) : null}

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
              <AppIcon family="ionicons" name={envelope.icon} size={14} color={accent} />
            </View>
            <View style={styles.envCopy}>
              <Text style={[styles.envName, { color: colors.text }]} numberOfLines={1}>
                {envelope.name}
              </Text>
              {!hideBalances && balance > 0 ? (
                <View style={[styles.envTrack, { backgroundColor: colors.borderSubtle }]}>
                  <AnimatedFill
                    progress={envelope.amount / Math.max(balance, 1)}
                    style={[styles.envFill, { backgroundColor: accent }]}
                  />
                </View>
              ) : null}
            </View>
            <Text style={[styles.envAmount, { color: colors.text }]}>{show(envelope.amount)}</Text>
          </PressScale>
        );
      })}

      {envelopes.length > 0 ? (
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
          <Text style={[styles.envAmount, { color: unassigned < 0 ? colors.danger : colors.textMuted }]}>
            {show(unassigned)}
          </Text>
        </View>
      ) : (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Sépare ce solde en enveloppes : factures, loisirs, épargne…
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nouvelle enveloppe"
        onPress={() => {
          tapHaptic();
          onAdd();
        }}
        hitSlop={6}
        style={styles.addRow}
      >
        <AppIcon family="ionicons" name="add" size={16} color={colors.accentGreen} />
        <Text style={[styles.addText, { color: colors.accentGreen }]}>Nouvelle enveloppe</Text>
      </Pressable>
    </Reveal>
  );
}

/* ───────────────────────── Sheet ───────────────────────── */

export type EnvelopeDraft = { envelope: AccountEnvelope; isNew: boolean };

export function newEnvelopeDraft(accountId: string, displayOrder: number): EnvelopeDraft {
  return {
    isNew: true,
    envelope: {
      id: newEnvelopeId(),
      accountId,
      name: '',
      icon: ENVELOPE_PRESETS[0]!.icon,
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
  const sheetHeight = useFormSheetHeight(0.82);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(ENVELOPE_PRESETS[0]!.icon);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setName(draft.envelope.name);
    setIcon(draft.envelope.icon);
    setAmount(draft.isNew || !draft.envelope.amount ? '' : String(draft.envelope.amount).replace('.', ','));
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
              style={[styles.sheet, { backgroundColor: colors.background }]}
            >
              <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
              <View style={styles.header}>
                <View style={styles.headerCopy}>
                  <Text style={[styles.title, { color: colors.text }]}>
                    {draft.isNew ? 'Nouvelle enveloppe' : 'Modifier l’enveloppe'}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                    {accountName}
                  </Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onClose} hitSlop={14}>
                  <AppIcon family="ionicons" name="close" size={22} color={colors.textMuted} />
                </Pressable>
              </View>

              <DraggableSheetScrollView
                style={[styles.list, formSheetScrollViewStyle()]}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.md) + 32 }]}
              >
                {draft.isNew ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.chips}>
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
                          <AppIcon family="ionicons" name={preset.icon} size={15} color={selected ? colors.background : colors.text} />
                          <Text style={[styles.chipText, { color: selected ? colors.background : colors.text }]}>{preset.name}</Text>
                        </PressScale>
                      );
                    })}
                  </ScrollView>
                ) : null}

                <View style={styles.section}>
                  <Text style={label}>Nom</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Ex. Factures"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, inputSurface, { color: colors.text }]}
                  />
                </View>

                <View style={styles.section}>
                  <Text style={label}>Montant</Text>
                  <View style={[styles.amountShell, inputSurface]}>
                    <NumericAmountInput
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      style={[styles.amountInput, { color: colors.text }]}
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
                      >
                        <Text style={[styles.fillAll, { color: colors.accentGreen }]}>Tout le reste</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={label}>Icône</Text>
                  <View style={styles.iconGrid}>
                    {ENVELOPE_ICONS.map((glyph) => {
                      const selected = icon === glyph;
                      const accent = accentForKey(draft.envelope.id);
                      return (
                        <PressScale
                          key={glyph}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={glyph}
                          onPress={() => {
                            tapHaptic();
                            setIcon(glyph);
                          }}
                          scaleTo={0.9}
                          style={[
                            styles.iconOption,
                            { backgroundColor: selected ? `${accent}2E` : colors.surfaceElevated },
                            selected && { borderColor: accent },
                          ]}
                        >
                          <AppIcon family="ionicons" name={glyph} size={18} color={selected ? accent : colors.textSecondary} />
                        </PressScale>
                      );
                    })}
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
                    <AppIcon family="ionicons" name="trash-outline" size={16} color={colors.danger} />
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
  splitBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2, marginBottom: 8 },
  envRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  envIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  envCopy: { flex: 1, minWidth: 0, gap: 4 },
  envName: { ...jakartaMediumText, fontSize: 14 },
  envTrack: { height: 3, borderRadius: 1.5, overflow: 'hidden' },
  envFill: { height: '100%', borderRadius: 1.5 },
  envAmount: { ...jakartaSemiboldText, fontSize: 14 },
  emptyText: { ...jakartaMediumText, fontSize: 13, lineHeight: 18, paddingVertical: 4 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, alignSelf: 'flex-start' },
  addText: { ...jakartaSemiboldText, fontSize: 13.5 },

  /* Sheet */
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: spacing.sm, marginBottom: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...jakartaBoldText, fontSize: 20, letterSpacing: -0.3 },
  subtitle: { ...jakartaMediumText, fontSize: 13 },
  list: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  chips: { gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 13, borderRadius: 18 },
  chipText: { ...jakartaMediumText, fontSize: 14 },
  input: {
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    ...jakartaMediumText,
    fontSize: 15,
  },
  amountShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 60,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
  },
  amountInput: { flex: 1, minWidth: 0, ...jakartaBoldText, fontSize: 26, paddingVertical: 8 },
  amountSuffix: { ...jakartaBoldText, fontSize: 20 },
  remainingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  remaining: { ...jakartaMediumText, fontSize: 12.5, flexShrink: 1 },
  fillAll: { ...jakartaSemiboldText, fontSize: 12.5 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  deleteText: { ...jakartaSemiboldText, fontSize: 14 },
});

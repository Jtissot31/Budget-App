/**
 * Envelopes inside a Wallet account row: an expandable panel (split bar + one row per
 * envelope + « Non attribué », or a short empty state with suggestions) and the
 * create / edit sheet (emoji + name + amount).
 */
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { accentForKey } from '@/components/kit/charts';
import { PressScale, Reveal } from '@/components/kit/motion';
import { jakartaBoldText, jakartaMediumText, jakartaSemiboldText } from '@/constants/theme';
import {
  DEFAULT_ENVELOPE_ICON,
  ENVELOPE_PRESETS,
  isEnvelopeEmoji,
  newEnvelopeId,
  type AccountEnvelope,
} from '@/lib/accountEnvelopes';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
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
        <Text style={[styles.emptyLine, { color: colors.textMuted }]}>Sépare ce solde en enveloppes</Text>
        <View style={styles.suggestions}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Créer une enveloppe"
            onPress={() => add()}
            scaleTo={0.94}
            style={[styles.suggestion, { backgroundColor: colors.text }]}
          >
            <AppIcon family="ionicons" name="add" size={15} color={colors.background} />
            <Text style={[styles.suggestionText, { color: colors.background }]}>Nouvelle</Text>
          </PressScale>
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
      </Reveal>
    );
  }

  return (
    <Reveal style={[styles.panel, { borderTopColor: colors.borderSubtle }]}>
      <View style={styles.panelHead}>
        <Text style={[styles.panelTitle, { color: colors.textMuted }]}>ENVELOPPES</Text>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Nouvelle enveloppe"
          onPress={() => add()}
          scaleTo={0.92}
          hitSlop={8}
          style={[styles.addPill, { backgroundColor: colors.surfaceElevated }]}
        >
          <AppIcon family="ionicons" name="add" size={14} color={colors.text} />
          <Text style={[styles.addPillText, { color: colors.text }]}>Ajouter</Text>
        </PressScale>
      </View>
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
          // Emoji · name · amount — proportions live in the split bar above.
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
            <View style={[styles.envDot, { backgroundColor: accent }]} />
            <View style={styles.envIcon}>
              <EnvelopeGlyph icon={envelope.icon} size={15} color={accent} />
            </View>
            <Text style={[styles.envName, styles.envCopy, { color: colors.text }]} numberOfLines={1}>
              {envelope.name}
            </Text>
            <Text style={[styles.envAmount, { color: colors.text }]}>{show(envelope.amount)}</Text>
          </PressScale>
        );
      })}

      <View style={styles.envRow}>
        <View style={[styles.envDot, { backgroundColor: unassigned < 0 ? colors.danger : colors.borderStrong }]} />
        <View style={styles.envIcon} />
        <Text style={[styles.envName, styles.envCopy, { color: unassigned < 0 ? colors.danger : colors.textMuted }]}>
          {unassigned < 0 ? 'Dépassement du solde' : 'Non attribué'}
        </Text>
        <Text style={[styles.envAmount, { color: unassigned < 0 ? colors.danger : colors.textMuted }]}>{show(unassigned)}</Text>
      </View>

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

export { EnvelopeSheet } from '@/components/wallet/EnvelopeSheet';

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
  emptyLine: { ...jakartaMediumText, fontSize: 12, marginBottom: 8 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  panelTitle: { ...jakartaSemiboldText, fontSize: 11, letterSpacing: 0.8 },
  addPill: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 26, paddingHorizontal: 10, borderRadius: 13 },
  addPillText: { ...jakartaSemiboldText, fontSize: 12 },
  envDot: { width: 3, height: 16, borderRadius: 1.5 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 11, borderRadius: 16 },
  suggestionEmoji: { fontSize: 14 },
  suggestionText: { ...jakartaSemiboldText, fontSize: 13 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 22 },
  primaryText: { ...jakartaBoldText, fontSize: 14 },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 21, marginTop: 6 },
  secondaryText: { ...jakartaSemiboldText, fontSize: 14 },
  splitBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2, marginBottom: 8 },
  envRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
  envIcon: { width: 20, alignItems: 'center', justifyContent: 'center' },
  envCopy: { flex: 1, minWidth: 0, gap: 4 },
  envName: { ...jakartaMediumText, fontSize: 14 },
  envTrack: { height: 3, borderRadius: 1.5, overflow: 'hidden' },
  envFill: { height: '100%', borderRadius: 1.5 },
  envAmount: { ...jakartaSemiboldText, fontSize: 14 },
});

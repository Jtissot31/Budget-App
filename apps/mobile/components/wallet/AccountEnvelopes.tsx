/**
 * Envelopes inside a Wallet account row: an expandable panel and the create / edit sheet
 * (emoji + name + amount).
 *
 * The panel is just more lines of the same list: one per envelope — emoji, name, amount — laid
 * out on the account rows' own grid (emoji under the logo, name under the title, amount in the
 * balance column). No container, no tint, no tile behind the emoji. One quiet footer line adds
 * an envelope; the collapse arrow sits in the same column as the account's expand arrow.
 */
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { PressScale, Reveal } from '@/components/kit/motion';
import { jakartaMediumText, jakartaSemiboldText } from '@/constants/theme';
import {
  DEFAULT_ENVELOPE_ICON,
  isEnvelopeEmoji,
  newEnvelopeId,
  type AccountEnvelope,
} from '@/lib/accountEnvelopes';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

/** Account row geometry (ListRow padding 14, logo slot 40, gap 12) that envelope lines reuse. */
const ROW_PAD = 14;
const LOGO_SLOT = 40;
/** Envelopes are indented under their account so they read as its children (emoji not under the logo). */
const CHILD_INDENT = 20;
/** The account's amount ends left of its expand arrow (28 wide + 6 gap) — envelopes match it. */
const TRAILING_SLOT = 28 + 6;

type Preset = { name: string; icon: string };

function money(value: number): string {
  return `${value < 0 ? '−' : ''}${formatDisplayMoneyAbsolute(Math.abs(value))}`;
}

/** The envelope's emoji on its own (older envelopes stored an Ionicons glyph instead). */
export function EnvelopeEmoji({
  icon,
  size = LOGO_SLOT,
  glyphSize,
}: {
  icon: string;
  size?: number;
  glyphSize?: number;
}) {
  const { colors } = useAppTheme();
  const glyph = glyphSize ?? Math.round(size * 0.5);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {isEnvelopeEmoji(icon) ? (
        <Text style={{ fontSize: glyph, lineHeight: Math.round(glyph * 1.25) }}>{icon}</Text>
      ) : (
        <AppIcon family="ionicons" name={icon} size={glyph} color={colors.textMuted} />
      )}
    </View>
  );
}

/* ───────────────────────── Panel ───────────────────────── */

export function AccountEnvelopesPanel({
  envelopes,
  hideBalances,
  onAdd,
  onEdit,
  onCollapse,
}: {
  envelopes: AccountEnvelope[];
  hideBalances: boolean;
  onAdd: () => void;
  onEdit: (envelope: AccountEnvelope) => void;
  /** Folds the panel back up — shown after the envelopes, where the eye ends. */
  onCollapse: () => void;
}) {
  const { colors } = useAppTheme();
  const show = (value: number) => (hideBalances ? '••••' : money(value));

  return (
    <Reveal style={styles.wrap}>
      {envelopes.map((envelope) => (
        <PressScale
          key={envelope.id}
          accessibilityRole="button"
          accessibilityLabel={`${envelope.name}, ${show(envelope.amount)}. Modifier`}
          onPress={() => {
            tapHaptic();
            onEdit(envelope);
          }}
          scaleTo={0.98}
          style={styles.row}
        >
          <EnvelopeEmoji icon={envelope.icon} glyphSize={16} />
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {envelope.name}
          </Text>
          <Text style={[styles.amount, { color: colors.text }]}>{show(envelope.amount)}</Text>
        </PressScale>
      ))}

      <View style={styles.footer}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Nouvelle enveloppe"
          onPress={() => {
            tapHaptic();
            onAdd();
          }}
          scaleTo={0.98}
          containerStyle={styles.addContainer}
          style={styles.addRow}
        >
          <View style={styles.addSlot}>
            <AppIcon family="ionicons" name="add" size={16} color={colors.textMuted} />
          </View>
          <Text style={[styles.addLabel, { color: colors.textMuted }]} numberOfLines={1}>
            Nouvelle enveloppe
          </Text>
        </PressScale>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Masquer les enveloppes"
          onPress={() => {
            tapHaptic();
            onCollapse();
          }}
          scaleTo={0.9}
          style={styles.collapseButton}
        >
          <AppIcon family="ionicons" name="chevron-up" size={16} color={colors.textMuted} />
        </PressScale>
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
  wrap: { paddingBottom: 6 },

  /* One line per envelope — same grid as the account rows above */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 36,
    paddingLeft: ROW_PAD + CHILD_INDENT,
    paddingRight: ROW_PAD + TRAILING_SLOT,
  },
  name: { ...jakartaMediumText, flex: 1, minWidth: 0, fontSize: 13 },
  amount: { ...jakartaSemiboldText, fontSize: 13, letterSpacing: -0.2 },

  /* Footer: add on the left, collapse arrow in the account arrow's column */
  footer: { flexDirection: 'row', alignItems: 'center', paddingLeft: ROW_PAD + CHILD_INDENT, paddingRight: ROW_PAD - 6 },
  addContainer: { flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 },
  addSlot: { width: LOGO_SLOT, alignItems: 'center' },
  addLabel: { ...jakartaMediumText, flex: 1, minWidth: 0, fontSize: 13 },
  collapseButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});

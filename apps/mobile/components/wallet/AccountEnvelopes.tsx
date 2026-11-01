/**
 * Envelope bits shared by the account and envelope detail pages: the emoji glyph, a new draft
 * and the create / edit sheet (emoji + name).
 */
import { Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  DEFAULT_ENVELOPE_ICON,
  isEnvelopeEmoji,
  newEnvelopeId,
  type AccountEnvelope,
} from '@/lib/accountEnvelopes';
import { useAppTheme } from '@/lib/themeContext';

const LOGO_SLOT = 40;

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

export type EnvelopeDraft = { envelope: AccountEnvelope; isNew: boolean };

export function newEnvelopeDraft(accountId: string, displayOrder: number): EnvelopeDraft {
  return {
    isNew: true,
    envelope: {
      id: newEnvelopeId(),
      accountId,
      name: '',
      icon: DEFAULT_ENVELOPE_ICON,
      amount: 0,
      displayOrder,
      createdAt: new Date().toISOString(),
    },
  };
}

export { EnvelopeSheet } from '@/components/wallet/EnvelopeSheet';

/**
 * Recurring bill row shell — the card Agenda renders for each payment.
 * Home upcoming bills use the same component so fill, radius, border, and padding stay one source.
 */
import type { ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';

/** Vertical gap between stacked bill rows (`ProtoAgendaScreen` cards column). */
export const AGENDA_BILL_ROW_GAP = 8;

const BILL_ROW_RADIUS = 16;
const BILL_ROW_PADDING = 10;

export function AgendaBillRowCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ProtoGlassCard style={[{ borderRadius: BILL_ROW_RADIUS }, style]} padding={BILL_ROW_PADDING}>
      {children}
    </ProtoGlassCard>
  );
}

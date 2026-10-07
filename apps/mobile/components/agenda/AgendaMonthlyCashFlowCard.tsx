/**
 * Agenda month cash-flow summary.
 * Parent supplies the visible month’s scheduled income, bills, and event count.
 * Modal surface, theme border, no halo.
 */
import { StyleSheet, Text, View } from 'react-native';
import {
  moneyAmountTypography,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { formatDisplayMoneyAbsoluteExact } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  net: number;
  inflows: number;
  committed: number;
  events: number;
};

function exactWithSign(value: number, direction: 'signed' | 'in' | 'out'): string {
  const abs = formatDisplayMoneyAbsoluteExact(Math.abs(value));
  if (direction === 'out') return value > 0 ? `−${abs}` : abs;
  if (value > 0) return `+${abs}`;
  if (value < 0) return `−${abs}`;
  return abs;
}

export function AgendaMonthlyCashFlowCard({ net, inflows, committed, events }: Props) {
  const { colors } = useAppTheme();
  const eventLabel = `${events} events`;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Monthly cash flow ${exactWithSign(net, 'signed')}, ${eventLabel}, inflows ${exactWithSign(inflows, 'in')}, committed ${exactWithSign(committed, 'out')}`}
      style={[
        styles.card,
        {
          backgroundColor: colors.modalSurface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.top}>
        <View style={styles.lead}>
          <Text style={[styles.kicker, { color: colors.textMuted }]}>MONTHLY CASH FLOW</Text>
          <Text
            style={[
              moneyAmountTypography({ tier: 'hero' }),
              styles.heroAmount,
              { color: colors.text },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {exactWithSign(net, 'signed')}
          </Text>
        </View>
        <View style={styles.scheduled}>
          <Text style={[styles.kicker, styles.kickerEnd, { color: colors.textMuted }]}>
            SCHEDULED
          </Text>
          <Text style={[styles.events, { color: colors.text }]} numberOfLines={1}>
            {eventLabel}
          </Text>
        </View>
      </View>

      <View style={styles.flows}>
        <View style={styles.flow}>
          <Text style={[styles.flowLabel, { color: colors.textMuted }]} numberOfLines={1}>
            Inflows
          </Text>
          <Text
            style={[
              moneyAmountTypography({ tier: 'card' }),
              styles.flowAmount,
              { color: colors.text },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {exactWithSign(inflows, 'in')}
          </Text>
        </View>
        <View style={styles.flow}>
          <Text style={[styles.flowLabel, { color: colors.textMuted }]} numberOfLines={1}>
            Committed
          </Text>
          <Text
            style={[
              moneyAmountTypography({ tier: 'card' }),
              styles.flowAmount,
              { color: colors.text },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {exactWithSign(committed, 'out')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  lead: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  kicker: {
    ...typographyKit.microMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  kickerEnd: {
    textAlign: 'right',
  },
  heroAmount: {
    flexShrink: 1,
  },
  scheduled: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 6,
    maxWidth: '42%',
  },
  events: {
    ...typographyKit.bodyBold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  flows: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  flow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.xs,
  },
  flowLabel: {
    ...typographyKit.metaMedium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  flowAmount: {
    textAlign: 'center',
    maxWidth: '100%',
  },
});

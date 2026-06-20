import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { spacing } from '@/constants/theme';
import type { ProgressCardData } from '@/types/aiWidgets';
import { AI_WIDGET_RADIUS, aiWidgetFonts, useAIWidgetColors } from './theme';

type Props = {
  data: ProgressCardData;
};

type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function resolveWidgetIcon(icon?: string): MaterialIconName | null {
  if (!icon) return null;
  return icon as MaterialIconName;
}

/** Keep currency amounts on one line (e.g. "12\u00A0600,00\u00A0$"). */
function formatValueLabel(value: string): string {
  return value.replace(/ /g, '\u00A0');
}

export function ProgressCardWidget({ data }: Props) {
  const palette = useAIWidgetColors();
  const percent = Math.min(100, Math.max(0, data.percent));
  const iconName = resolveWidgetIcon(data.icon);

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, padding: palette.padding }]}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: palette.textMuted, fontFamily: aiWidgetFonts.label }]}>
          {data.label.toUpperCase()}
        </Text>
        {iconName ? (
          <MaterialCommunityIcons name={iconName} size={16} color={palette.green} />
        ) : null}
      </View>

      <View style={styles.valueRow}>
        <Text
          style={[styles.value, { color: palette.text, fontFamily: aiWidgetFonts.mono }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatValueLabel(data.value_label)}
        </Text>
        <Text style={[styles.percentLabel, { color: palette.green, fontFamily: aiWidgetFonts.label }]}>
          {data.percent_label}
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: palette.track }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: palette.green, width: `${percent}%` },
          ]}
        />
      </View>

      {data.status_line ? (
        <View style={styles.statusRow}>
          <MaterialCommunityIcons name="check-circle-outline" size={14} color={palette.green} />
          <Text
            style={[styles.statusText, { color: palette.textMuted, fontFamily: aiWidgetFonts.labelRegular }]}
          >
            {data.status_line}
          </Text>
        </View>
      ) : null}

      {data.actions?.length ? (
        <View style={styles.actionsRow}>
          {data.actions.map((action) => (
            <View
              key={action.label}
              style={[styles.actionPill, { backgroundColor: palette.background }]}
            >
              <Text style={[styles.actionText, { color: palette.text, fontFamily: aiWidgetFonts.label }]}>
                {action.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: AI_WIDGET_RADIUS,
    gap: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    width: '100%',
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flex: 1,
    minWidth: 0,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    width: '100%',
  },
  value: {
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    flex: 1,
    minWidth: 0,
  },
  percentLabel: {
    fontSize: 13,
    flexShrink: 0,
  },
  track: {
    height: 8,
    borderRadius: AI_WIDGET_RADIUS,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: AI_WIDGET_RADIUS,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusText: {
    fontSize: 13,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionPill: {
    borderRadius: AI_WIDGET_RADIUS,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionText: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
});

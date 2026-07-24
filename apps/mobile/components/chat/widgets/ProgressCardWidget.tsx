import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { spacing } from '@/constants/theme';
import type { ProgressCardData } from '@/types/aiWidgets';
import {
  AI_WIDGET_RADIUS,
  aiWidgetAmountTextProps,
  aiWidgetFonts,
  aiWidgetKeyStatTextProps,
  aiWidgetTypography,
  useAIWidgetColors,
} from './theme';
import { WidgetCardShell } from './WidgetCardShell';

type Props = {
  data: ProgressCardData;
};

type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function resolveWidgetIcon(icon?: string): MaterialIconName | null {
  if (!icon) return null;
  return icon as MaterialIconName;
}

function formatValueLabel(value: string): string {
  return value.replace(/ /g, '\u00A0');
}

/**
 * Progress card — amount + percent phrase stack so « 70 % de l'objectif » never
 * mid-phrase-ellipsizes beside a long money amount.
 */
export function ProgressCardWidget({ data }: Props) {
  const palette = useAIWidgetColors();
  const percent = Math.min(100, Math.max(0, data.percent));
  const iconName = resolveWidgetIcon(data.icon);

  return (
    <WidgetCardShell label={data.label}>
      <View style={styles.labelRow}>
        {iconName ? (
          <AppIcon family="material-community" name={iconName} size={16} color={palette.green} />
        ) : null}
      </View>

      <View style={styles.valueBlock}>
        <Text
          style={[aiWidgetTypography.value, styles.valueLabel, { color: palette.text }]}
          {...aiWidgetAmountTextProps}
        >
          {formatValueLabel(data.value_label)}
        </Text>
        <Text
          style={[
            styles.percentLabel,
            { color: palette.green, fontFamily: aiWidgetFonts.label },
          ]}
          {...aiWidgetKeyStatTextProps}
        >
          {data.percent_label}
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: palette.track }]}>
        <View style={[styles.fill, { backgroundColor: palette.green, width: `${percent}%` }]} />
      </View>

      {data.status_line ? (
        <View style={styles.statusRow}>
          <AppIcon family="material-community" name="check-circle-outline" size={14} color={palette.green} />
          <Text
            style={[styles.statusText, { color: palette.textMuted, fontFamily: aiWidgetFonts.labelRegular }]}
            numberOfLines={3}
          >
            {data.status_line}
          </Text>
        </View>
      ) : null}

      {data.actions?.length ? (
        <View style={styles.actionsRow}>
          {data.actions.map((action) => (
            <View key={action.label} style={[styles.actionPill, { backgroundColor: palette.track }]}>
              <Text
                style={[styles.actionText, { color: palette.text, fontFamily: aiWidgetFonts.label }]}
              >
                {action.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </WidgetCardShell>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
  },
  valueBlock: {
    width: '100%',
    minWidth: 0,
    gap: spacing.xs,
  },
  valueLabel: {
    width: '100%',
    minWidth: 0,
  },
  percentLabel: {
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.1,
    width: '100%',
    minWidth: 0,
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
    alignItems: 'flex-start',
    gap: spacing.xs,
    minWidth: 0,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    minWidth: 0,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionPill: {
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionText: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
});

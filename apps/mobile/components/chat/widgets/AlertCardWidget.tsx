import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/constants/theme';
import type { AlertCardData } from '@/types/aiWidgets';
import { AI_WIDGET_RADIUS, aiWidgetFonts, useAIWidgetColors } from './theme';

type Props = {
  data: AlertCardData;
};

function severityColor(
  severity: AlertCardData['severity'],
  palette: ReturnType<typeof useAIWidgetColors>,
): string {
  switch (severity) {
    case 'danger':
      return palette.red;
    case 'warning':
      return palette.warning;
    case 'success':
      return palette.green;
    case 'info':
    default:
      return palette.info;
  }
}

export function AlertCardWidget({ data }: Props) {
  const palette = useAIWidgetColors();
  const accent = severityColor(data.severity, palette);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          padding: palette.padding,
          borderLeftColor: accent,
        },
      ]}
    >
      <Text style={[styles.title, { color: palette.text, fontFamily: aiWidgetFonts.title }]}>
        {data.title}
      </Text>
      <Text style={[styles.message, { color: palette.textMuted, fontFamily: aiWidgetFonts.labelRegular }]}>
        {data.message}
      </Text>

      {data.action ? (
        <View style={[styles.actionPill, { backgroundColor: palette.background }]}>
          <Text style={[styles.actionText, { color: palette.text, fontFamily: aiWidgetFonts.label }]}>
            {data.action.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: AI_WIDGET_RADIUS,
    borderLeftWidth: 3,
    gap: spacing.sm,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionPill: {
    alignSelf: 'flex-start',
    borderRadius: AI_WIDGET_RADIUS,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  actionText: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
});

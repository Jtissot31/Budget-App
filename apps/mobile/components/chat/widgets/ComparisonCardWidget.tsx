import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/constants/theme';
import type { ComparisonCardData } from '@/types/aiWidgets';
import { AI_WIDGET_RADIUS, aiWidgetFonts, useAIWidgetColors } from './theme';

type Props = {
  data: ComparisonCardData;
};

function isPrimaryItem(data: ComparisonCardData, index: number, item: ComparisonCardData['items'][number]): boolean {
  if (item.highlight === true) return true;
  if (data.primary_index != null && data.primary_index === index) return true;
  return false;
}

export function ComparisonCardWidget({ data }: Props) {
  const palette = useAIWidgetColors();

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, padding: palette.padding }]}>
      <Text style={[styles.label, { color: palette.textMuted, fontFamily: aiWidgetFonts.label }]}>
        {data.label.toUpperCase()}
      </Text>

      {data.items.map((item, index) => {
        const primary = isPrimaryItem(data, index, item);
        return (
          <View
            key={`${item.label}-${item.value}`}
            style={[
              styles.itemRow,
              primary
                ? { backgroundColor: palette.background, borderLeftColor: palette.green }
                : { borderLeftColor: 'transparent' },
            ]}
          >
            <Text
              style={[
                styles.itemLabel,
                { color: primary ? palette.text : palette.textMuted, fontFamily: aiWidgetFonts.labelRegular },
              ]}
            >
              {item.label}
            </Text>
            <Text
              style={[
                styles.itemValue,
                {
                  color: primary ? palette.green : palette.text,
                  fontFamily: aiWidgetFonts.mono,
                },
              ]}
            >
              {item.value}
            </Text>
          </View>
        );
      })}

      {data.footer ? (
        <Text style={[styles.footer, { color: palette.textMuted, fontFamily: aiWidgetFonts.labelRegular }]}>
          {data.footer}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: AI_WIDGET_RADIUS,
    gap: spacing.sm,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderLeftWidth: 3,
    borderRadius: AI_WIDGET_RADIUS,
  },
  itemLabel: {
    fontSize: 13,
    flex: 1,
  },
  itemValue: {
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  footer: {
    fontSize: 12,
    marginTop: spacing.xs,
  },
});

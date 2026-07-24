import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/constants/theme';
import type { ComparisonCardData } from '@/types/aiWidgets';
import {
  aiWidgetAmountTextProps,
  aiWidgetAmountTypography,
  aiWidgetFonts,
  aiWidgetTypography,
  useAIWidgetColors,
} from './theme';
import { WidgetCardShell } from './WidgetCardShell';

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
    <WidgetCardShell label={data.label} caption={data.footer}>
      {data.items.map((item, index) => {
        const primary = isPrimaryItem(data, index, item);
        return (
          <View
            key={`${item.label}-${item.value}`}
            style={[
              styles.itemRow,
              primary
                ? { backgroundColor: palette.track, borderLeftColor: palette.green }
                : { borderLeftColor: 'transparent' },
            ]}
          >
            <Text
              style={[
                styles.itemLabel,
                aiWidgetTypography.legend,
                { color: primary ? palette.text : palette.textMuted, fontFamily: aiWidgetFonts.labelRegular },
              ]}
              numberOfLines={2}
            >
              {item.label}
            </Text>
            <Text
              style={[
                aiWidgetAmountTypography('card'),
                styles.itemValue,
                { color: primary ? palette.green : palette.text },
              ]}
              {...aiWidgetAmountTextProps}
            >
              {item.value}
            </Text>
          </View>
        );
      })}
    </WidgetCardShell>
  );
}

const styles = StyleSheet.create({
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderLeftWidth: 3,
    borderRadius: 8,
    minWidth: 0,
  },
  itemLabel: {
    flex: 1,
    minWidth: 0,
  },
  itemValue: {
    textAlign: 'right',
    flexShrink: 1,
    maxWidth: '48%',
    minWidth: 0,
  },
});

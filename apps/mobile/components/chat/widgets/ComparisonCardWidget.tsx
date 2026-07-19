import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/constants/theme';
import type { ComparisonCardData } from '@/types/aiWidgets';
import { aiWidgetAmountTypography, aiWidgetFonts, aiWidgetTypography, useAIWidgetColors } from './theme';
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
                aiWidgetTypography.legend,
                { color: primary ? palette.text : palette.textMuted, fontFamily: aiWidgetFonts.labelRegular },
              ]}
            >
              {item.label}
            </Text>
            <Text
              style={[
                aiWidgetAmountTypography('card'),
                styles.itemValue,
                { color: primary ? palette.green : palette.text },
              ]}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderLeftWidth: 3,
    borderRadius: 8,
  },
  itemValue: {
    textAlign: 'right',
  },
});

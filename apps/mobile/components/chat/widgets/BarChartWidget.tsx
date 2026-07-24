import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fontFamilies } from '@/constants/plusJakartaFonts';
import { planFinanceSecondaryButtonStyle } from '@/constants/planFinanceKit';
import { spacing } from '@/constants/theme';
import { formatDisplayMoneyAbsoluteExact } from '@/lib/formatDisplayMoney';
import type { BarChartData, BarChartItem } from '@/types/aiWidgets';
import {
  aiWidgetAmountTextProps,
  aiWidgetAmountTypography,
  aiWidgetFonts,
  aiWidgetLabelTextProps,
  useAIWidgetColors,
} from './theme';
import { WidgetCardShell } from './WidgetCardShell';

type Props = {
  data: BarChartData;
};

/** Maquette « Dépenses par catégorie » — barres horizontales spent/limit. */
const MOCK = {
  secondary: '#8A8A8A',
  limitMuted: '#5A5A5A',
  warning: '#E6A000',
  warningLimit: '#8A7A55',
  divider: '#1C1C1C',
  barGreen: '#00E664',
  track: '#1C1C1C',
  barHeight: 8,
  listMaxHeight: 280,
} as const;

const titleStyle = {
  fontFamily: fontFamilies.bold,
  fontSize: 14,
  lineHeight: 18,
  letterSpacing: 0.6,
  textTransform: 'uppercase' as const,
};

const categoryNameStyle = {
  fontFamily: fontFamilies.semibold,
  fontSize: 14,
  lineHeight: 18,
  includeFontPadding: false,
};

const amountStyle = {
  ...aiWidgetAmountTypography('row'),
  fontSize: 13,
  lineHeight: 18,
  includeFontPadding: false,
};

const captionStyle = {
  fontFamily: aiWidgetFonts.labelRegular,
  fontSize: 13,
  lineHeight: 18,
};

function resolveSpentLabel(item: BarChartItem): string {
  return item.value_label ?? formatDisplayMoneyAbsoluteExact(item.value);
}

function resolveLimitLabel(item: BarChartItem): string | null {
  if (item.limit == null || !Number.isFinite(item.limit) || item.limit <= 0) return null;
  return item.limit_label ?? formatDisplayMoneyAbsoluteExact(item.limit);
}

function resolveBarFraction(item: BarChartItem, maxValue: number): number {
  const limit = item.limit;
  if (limit != null && Number.isFinite(limit) && limit > 0) {
    const fraction = item.value / limit;
    return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  }

  if (maxValue <= 0) return 0;
  const fraction = item.value / maxValue;
  return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
}

function isOverBudget(item: BarChartItem): boolean {
  const limit = item.limit;
  return limit != null && Number.isFinite(limit) && limit > 0 && item.value > limit;
}

type CategoryRowProps = {
  item: BarChartItem;
  maxValue: number;
  textColor: string;
};

function CategoryRow({ item, maxValue, textColor }: CategoryRowProps) {
  const limitLabel = resolveLimitLabel(item);
  const spentLabel = resolveSpentLabel(item);
  const overBudget = isOverBudget(item);
  const barFraction = resolveBarFraction(item, maxValue);
  const barFillFlex = barFraction > 0 ? Math.max(barFraction, 0.01) : 0;
  const barEmptyFlex = Math.max(1 - barFillFlex, 0.01);
  const barColor = overBudget ? MOCK.warning : MOCK.barGreen;
  const spentColor = overBudget ? MOCK.warning : MOCK.secondary;
  const limitColor = overBudget ? MOCK.warningLimit : MOCK.limitMuted;

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text
          style={[styles.categoryName, categoryNameStyle, { color: textColor }]}
          {...aiWidgetLabelTextProps}
        >
          {item.label}
        </Text>
        <Text
          style={[styles.amount, amountStyle, { color: spentColor }]}
          {...aiWidgetAmountTextProps}
        >
          {spentLabel}
          {limitLabel ? (
            <Text style={{ color: limitColor }}>{` / ${limitLabel}`}</Text>
          ) : null}
        </Text>
      </View>

      <View style={[styles.barTrack, { backgroundColor: MOCK.track }]}>
        {barFillFlex > 0 ? (
          <View
            style={[
              styles.barFill,
              {
                flex: barFillFlex,
                backgroundColor: barColor,
              },
            ]}
          />
        ) : null}
        <View style={{ flex: barEmptyFlex }} />
      </View>
    </View>
  );
}

export function BarChartWidget({ data }: Props) {
  const palette = useAIWidgetColors();

  const maxValue = useMemo(
    () => Math.max(...data.items.map((item) => item.value), 1),
    [data.items],
  );

  const shellLabel = data.label ?? 'Dépenses par catégorie';
  const rowItems = data.items.map((item) => (
    <CategoryRow
      key={`${item.label}-${item.value}-${item.limit ?? 'nolimit'}`}
      item={item}
      maxValue={maxValue}
      textColor={palette.text}
    />
  ));

  return (
    <WidgetCardShell style={styles.shell}>
      <Text style={[styles.title, titleStyle, { color: palette.text }]}>{shellLabel.toUpperCase()}</Text>

      {data.items.length > 4 ? (
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.list} nestedScrollEnabled>
          {rowItems}
        </ScrollView>
      ) : (
        <View style={styles.list}>{rowItems}</View>
      )}

      {data.caption ? (
        <Text style={[styles.caption, captionStyle, { color: MOCK.secondary }]}>{data.caption}</Text>
      ) : null}

      {data.action ? (
        <>
          <View style={[styles.divider, { backgroundColor: MOCK.divider }]} />
          <View
            style={[styles.actionButton, planFinanceSecondaryButtonStyle(), { borderColor: palette.border }]}
            accessibilityRole="button"
            accessibilityLabel={data.action.label}
          >
            <Text style={[styles.actionText, { color: palette.text, fontFamily: aiWidgetFonts.label }]}>
              {data.action.label}
            </Text>
          </View>
        </>
      ) : null}
    </WidgetCardShell>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  listScroll: {
    maxHeight: MOCK.listMaxHeight,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    gap: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minWidth: 0,
  },
  categoryName: {
    flex: 1,
    minWidth: 0,
  },
  amount: {
    flexShrink: 1,
    maxWidth: '55%',
    textAlign: 'right',
    minWidth: 0,
  },
  barTrack: {
    width: '100%',
    height: MOCK.barHeight,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  caption: {
    marginTop: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    minHeight: 1,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
  },
  actionText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
});

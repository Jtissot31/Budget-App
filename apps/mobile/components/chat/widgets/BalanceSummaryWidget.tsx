import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { spacing } from '@/constants/theme';
import type { BalanceSummaryCardData } from '@/types/aiWidgets';
import {
  AI_WIDGET_RADIUS,
  aiWidgetAmountTypography,
  aiWidgetFonts,
  aiWidgetTypography,
  useAIWidgetColors,
} from './theme';
import { WidgetCardShell } from './WidgetCardShell';

type Props = {
  data: BalanceSummaryCardData;
};

function formatValueLabel(value: string): string {
  return value.replace(/ /g, '\u00A0');
}

function resolveTrendPositive(data: BalanceSummaryCardData): boolean {
  if (typeof data.positive === 'boolean') return data.positive;
  const trimmed = data.trend_label?.trim() ?? '';
  if (trimmed.startsWith('-') || trimmed.startsWith('−')) return false;
  return true;
}

export function BalanceSummaryWidget({ data }: Props) {
  const palette = useAIWidgetColors();
  const trendPositive = resolveTrendPositive(data);
  const trendColor = trendPositive ? palette.green : palette.red;
  const trendWellBg = trendPositive ? palette.successMuted : palette.dangerMuted;

  return (
    <WidgetCardShell style={styles.shell}>
      <Text
        style={[
          styles.title,
          aiWidgetTypography.eyebrow,
          { color: palette.textMuted, fontFamily: aiWidgetFonts.label },
        ]}
      >
        {data.label.toUpperCase()}
      </Text>

      <Text
        style={[aiWidgetTypography.value, styles.amount, { color: palette.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {formatValueLabel(data.value_label)}
      </Text>

      <View style={styles.footerRow}>
        {data.trend_label ? (
          <View style={[styles.trendPill, { backgroundColor: trendWellBg }]}>
            <Text
              style={[
                aiWidgetAmountTypography('caption'),
                styles.trendText,
                { color: trendColor },
              ]}
              numberOfLines={2}
            >
              {data.trend_label}
            </Text>
          </View>
        ) : (
          <View style={styles.trendSpacer} />
        )}

        {data.action ? (
          <View
            style={[styles.actionButton, { borderColor: palette.border, backgroundColor: palette.track }]}
            accessibilityRole="button"
            accessibilityLabel={data.action.label}
          >
            <AppIcon family="material-community" name="chevron-right" size={18} color={palette.textMuted} />
          </View>
        ) : null}
      </View>
    </WidgetCardShell>
  );
}

const ACTION_BUTTON_SIZE = 36;

const styles = StyleSheet.create({
  shell: {
    gap: spacing.sm,
  },
  title: {
    marginBottom: spacing.xs,
  },
  amount: {
    marginBottom: spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  trendPill: {
    flex: 1,
    alignSelf: 'flex-start',
    borderRadius: AI_WIDGET_RADIUS,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  trendText: {
    fontSize: 12,
    lineHeight: 16,
  },
  trendSpacer: {
    flex: 1,
  },
  actionButton: {
    width: ACTION_BUTTON_SIZE,
    height: ACTION_BUTTON_SIZE,
    borderRadius: ACTION_BUTTON_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

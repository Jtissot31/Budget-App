import { StyleSheet, Text, View } from 'react-native';
import {
  interMediumText,
  interRegularText,
  interSemiboldText,
  radius,
  spacing,
} from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import type { SummaryRow } from './types';

type Props = {
  title?: string;
  rows: SummaryRow[];
};

function accentColor(accent: SummaryRow['accent'], colors: ReturnType<typeof useAppTheme>['colors']) {
  switch (accent) {
    case 'positive':
      return colors.primary;
    case 'negative':
      return colors.danger;
    default:
      return colors.text;
  }
}

export function SummaryCard({ title, rows }: Props) {
  const { colors, isLight } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.containerBackground,
          borderColor: colors.containerBorder,
        },
      ]}
    >
      {title ? (
        <Text style={[styles.title, { color: colors.textMuted }, interMediumText]}>{title}</Text>
      ) : null}
      {rows.map((row, index) => (
        <View
          key={`${row.label}-${index}`}
          style={[
            styles.row,
            index < rows.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <Text style={[styles.label, { color: colors.textMuted }, interRegularText]}>{row.label}</Text>
          <Text
            style={[
              styles.value,
              { color: accentColor(row.accent, colors) },
              interSemiboldText,
            ]}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  title: {
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
  },
  label: {
    fontSize: 13,
    flex: 1,
  },
  value: {
    fontSize: 14,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
});

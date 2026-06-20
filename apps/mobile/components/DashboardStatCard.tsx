import { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import {
  ICON_WELL_SIZE,
  interMediumText,
  moneyAmountTypography,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  label?: string;
  labelNode?: ReactNode;
  value: string;
  valueColor?: string;
  subtitle?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  valueStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function DashboardStatCard({
  label,
  labelNode,
  value,
  valueColor,
  subtitle,
  icon,
  trailing,
  valueStyle,
  style,
  compact = false,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const muted = colors.textMuted;
  const iconWellBg = isLight ? colors.surfaceElevated : colors.input;

  return (
    <View style={[styles.row, compact && styles.rowCompact, style]}>
      {icon ? (
        <View
          style={[
            styles.iconWell,
            {
              backgroundColor: iconWellBg,
              borderColor: colors.border,
            },
          ]}
        >
          {icon}
        </View>
      ) : null}
      <View style={styles.copy}>
        {labelNode ?? (
          <Text style={[styles.label, { color: muted }]} numberOfLines={1}>
            {label}
          </Text>
        )}
        <Text
          style={[
            compact ? styles.valueCompact : styles.value,
            moneyAmountTypography(compact ? { tier: 'row' } : { tier: 'stat' }),
            { color: valueColor ?? colors.text },
            valueStyle,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {value}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

type LegendProps = {
  color: string;
  label: string;
  value: string;
  valueColor?: string;
};

export function DashboardStatLegendItem({ color, label, value, valueColor }: LegendProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.legendItem}>
      <View style={styles.legendHeader}>
        <View style={[styles.legendSwatch, { backgroundColor: color }]} />
        <Text style={[styles.legendLabel, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <Text
        style={[
          styles.legendValue,
          moneyAmountTypography({ tier: 'row' }),
          { color: valueColor ?? colors.text },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
    minWidth: 0,
  },
  rowCompact: {
    flex: 1,
    minWidth: 0,
  },
  iconWell: {
    width: ICON_WELL_SIZE,
    height: ICON_WELL_SIZE,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    ...typographyKit.eyebrow,
    fontSize: typography.micro - 1,
    letterSpacing: 0.8,
  },
  value: {
    marginTop: 1,
  },
  valueCompact: {
    marginTop: 1,
  },
  subtitle: {
    ...interMediumText,
    fontSize: typography.micro,
    lineHeight: typography.micro + 3,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  trailing: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    flexShrink: 0,
    justifyContent: 'flex-end',
  },
  legendItem: {
    gap: 4,
  },
  legendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    ...typographyKit.microUpper,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  legendValue: {
    paddingLeft: 14,
  },
});

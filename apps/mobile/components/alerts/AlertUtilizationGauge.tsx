import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { moneyAmountTypography, spacing, typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  /** Utilization 0–100+ (ring capped at 100 visually). */
  percent: number;
  size?: number;
  strokeWidth?: number;
  fillColor: string;
  trackColor: string;
  /** Optional caption under the percent (e.g. « utilisé »). */
  caption?: string;
  /** Optional secondary line under the ring (e.g. remaining margin). */
  footerLabel?: string;
  footerValue?: string;
  footerColor?: string;
};

/**
 * Lightweight circular utilization gauge for alert detail heroes.
 * SVG stroke ring — no animation deps; theme colors passed by the caller.
 */
export function AlertUtilizationGauge({
  percent,
  size = 168,
  strokeWidth = 14,
  fillColor,
  trackColor,
  caption = 'utilisé',
  footerLabel,
  footerValue,
  footerColor,
}: Props) {
  const { colors } = useAppTheme();
  const clamped = Math.max(0, Math.min(percent, 100));
  const displayPct = Math.round(percent);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <View style={styles.root} accessibilityRole="image" accessibilityLabel={`${displayPct} pour cent utilisé`}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={fillColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        </Svg>
        <View style={styles.hub} pointerEvents="none">
          <Text
            style={[
              moneyAmountTypography({ tier: 'stat' }),
              styles.percent,
              { color: fillColor },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {displayPct} %
          </Text>
          <Text style={[styles.caption, { color: colors.textMuted }]}>{caption}</Text>
        </View>
      </View>

      {footerLabel || footerValue ? (
        <View style={styles.footer}>
          {footerLabel ? (
            <Text style={[styles.footerLabel, { color: colors.textMuted }]}>{footerLabel}</Text>
          ) : null}
          {footerValue ? (
            <Text
              style={[
                moneyAmountTypography({ tier: 'row' }),
                styles.footerValue,
                { color: footerColor ?? colors.text },
              ]}
              numberOfLines={1}
            >
              {footerValue}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.md,
  },
  hub: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.lg,
  },
  percent: {
    letterSpacing: -1,
    textAlign: 'center',
  },
  caption: {
    ...typographyKit.metaMedium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: 2,
  },
  footerLabel: {
    ...typographyKit.metaMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  footerValue: {
    letterSpacing: -0.4,
  },
});

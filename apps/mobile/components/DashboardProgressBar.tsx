import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  /** Fill percentage 0–100. */
  pct: number;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  marginTop?: number;
};

/** Dashboard-style progress track — pill radius, theme border track. */
export function DashboardProgressBar({
  pct,
  color,
  height = 4,
  style,
  marginTop = spacing.sm,
}: Props) {
  const { colors } = useAppTheme();
  const fillColor = color ?? colors.primary;
  const widthPct = Math.min(Math.max(pct, 0), 100);

  return (
    <View style={[styles.track, { height, marginTop, backgroundColor: colors.border }, style]}>
      <View style={[styles.fill, { width: `${widthPct}%`, backgroundColor: fillColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});

import { StyleSheet, View } from 'react-native';
import { colors as defaultColors, PROGRESS_BAR_TRACK_HEIGHT, radius } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  progress: number;
  color?: string;
  height?: number;
  fillOpacity?: number;
  trackColor?: string;
};

export function ProgressBar({
  progress,
  color,
  height = PROGRESS_BAR_TRACK_HEIGHT,
  fillOpacity = 1,
  trackColor,
}: Props) {
  const { colors } = useAppTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  const fillColor = color ?? colors.primary;
  const trackRadius = height / 2;
  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: trackRadius, backgroundColor: trackColor ?? colors.border },
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            backgroundColor: fillColor,
            opacity: fillOpacity,
            borderRadius: trackRadius,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: defaultColors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.sm,
  },
});

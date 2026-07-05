import { StyleSheet, View } from 'react-native';
import { colors as defaultColors, PROGRESS_BAR_TRACK_HEIGHT, radius } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  progress: number;
  color?: string;
  height?: number;
  fillOpacity?: number;
};

export function ProgressBar({
  progress,
  color,
  height = PROGRESS_BAR_TRACK_HEIGHT,
  fillOpacity = 1,
}: Props) {
  const { colors } = useAppTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  const fillColor = color ?? colors.primary;
  const trackRadius = height / 2;
  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: trackRadius, backgroundColor: 'rgba(255,255,255,0.08)' },
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

import { StyleSheet, View } from 'react-native';
import { colors as defaultColors, PROGRESS_BAR_TRACK_HEIGHT, radius } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  progress: number;
  color?: string;
};

export function ProgressBar({ progress, color }: Props) {
  const { colors } = useAppTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  const fillColor = color ?? colors.primary;
  return (
    <View style={[styles.track, { backgroundColor: colors.border }]}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: fillColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: PROGRESS_BAR_TRACK_HEIGHT,
    backgroundColor: defaultColors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.sm,
  },
});

import { StyleSheet, View } from 'react-native';
import { colors as defaultColors, PROGRESS_BAR_TRACK_HEIGHT, radius } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  progress: number;
  color?: string;
  height?: number;
};

export function ProgressBar({ progress, color, height = PROGRESS_BAR_TRACK_HEIGHT }: Props) {
  const { colors } = useAppTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  const fillColor = color ?? colors.primary;
  return (
    <View style={[styles.track, { height, backgroundColor: 'rgba(255,255,255,0.08)' }]}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: fillColor }]} />
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

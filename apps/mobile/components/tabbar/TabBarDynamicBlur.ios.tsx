import { BlurView } from 'expo-blur';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export type DynamicBlurTone = 'neutral' | 'accentGreen';

type Props = {
  isLight: boolean;
  cornerRadius: number;
  style?: StyleProp<ViewStyle>;
  /** Default `neutral` (nav pill). `accentGreen` = translucent green glass FABs. */
  tone?: DynamicBlurTone;
  /** Android SemBlur only — ignored on iOS. */
  minRefreshMs?: number;
  live?: boolean;
};

const BLUR_INTENSITY = 52;

/**
 * iOS nav / FAB background — UIVisualEffect via expo-blur (no Android dimezis path).
 */
export function TabBarDynamicBlur({
  isLight,
  cornerRadius,
  style,
  tone = 'neutral',
}: Props) {
  const accent = tone === 'accentGreen';
  const wash = accent
    ? isLight
      ? 'rgba(34, 197, 94, 0.08)'
      : 'rgba(34, 197, 94, 0.1)'
    : isLight
      ? 'rgba(255, 255, 255, 0.14)'
      : 'rgba(12, 12, 14, 0.16)';
  const rim = accent
    ? isLight
      ? 'rgba(255, 255, 255, 0.55)'
      : 'rgba(255, 255, 255, 0.28)'
    : isLight
      ? 'rgba(255, 255, 255, 0.4)'
      : 'rgba(255, 255, 255, 0.12)';

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { borderRadius: cornerRadius, overflow: 'hidden' },
        style,
      ]}
    >
      <BlurView
        intensity={BLUR_INTENSITY}
        tint={isLight ? 'systemUltraThinMaterialLight' : 'systemUltraThinMaterialDark'}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { borderRadius: cornerRadius, backgroundColor: wash },
        ]}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: cornerRadius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: rim,
          },
        ]}
      />
    </View>
  );
}

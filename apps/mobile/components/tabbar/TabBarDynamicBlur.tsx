/**
 * Shared fallback for TabBarDynamicBlur (non-ios / non-android odd platforms).
 * Platform files win in Metro:
 * - TabBarDynamicBlur.android.tsx — tint / SemBlur only (crash-safe Expo Go)
 * - TabBarDynamicBlur.ios.tsx — expo-blur
 *
 * Do not add BlurView or experimental blur methods here.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export type DynamicBlurTone = 'neutral' | 'accentGreen';

type Props = {
  isLight: boolean;
  cornerRadius: number;
  style?: StyleProp<ViewStyle>;
  /** Default `neutral` (nav + FABs). `accentGreen` = faint tint only. */
  tone?: DynamicBlurTone;
  /** Android SemBlur only — ignored here. */
  minRefreshMs?: number;
  live?: boolean;
};

export function TabBarDynamicBlur({
  isLight,
  cornerRadius,
  style,
  tone = 'neutral',
}: Props) {
  const accent = tone === 'accentGreen';
  const wash = accent
    ? isLight
      ? 'rgba(34, 197, 94, 0.1)'
      : 'rgba(34, 197, 94, 0.12)'
    : isLight
      ? 'rgba(255, 255, 255, 0.82)'
      : 'rgba(12, 12, 14, 0.78)';
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
        StyleSheet.absoluteFill,
        { borderRadius: cornerRadius, overflow: 'hidden' },
        style,
      ]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: cornerRadius, backgroundColor: wash },
        ]}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
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

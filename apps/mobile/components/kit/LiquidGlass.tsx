/**
 * LiquidGlass — iOS-style « liquid glass » surface that renders the same on every device.
 *
 * Live backdrop blur is not reliable on Android (Expo Go crashes on dimezis / hardware
 * bitmaps, SemBlur is Samsung + dev-build only, and nothing can sample behind a Modal
 * window). So the glass *material* is drawn instead, which is what makes it read as glass:
 *   1. translucent frosted body
 *   2. diagonal specular sheen (top-left light)
 *   3. bright rim, strongest along the top edge
 *   4. soft inner shade at the bottom + drop shadow for depth
 * On iOS a real BlurView sits underneath as a bonus.
 */
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  children?: ReactNode;
  /** Corner radius — pass size / 2 for a circle. */
  radius: number;
  style?: StyleProp<ViewStyle>;
};

export function LiquidGlass({ children, radius, style }: Props) {
  const { isLight } = useAppTheme();

  const body = isLight ? 'rgba(255, 255, 255, 0.62)' : 'rgba(255, 255, 255, 0.10)';
  const rim = isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.30)';
  const rimShadow = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.06)';
  const sheen = isLight
    ? (['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0)'] as const)
    : (['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)'] as const);
  const shade = isLight
    ? (['rgba(0,0,0,0)', 'rgba(0,0,0,0.06)'] as const)
    : (['rgba(0,0,0,0)', 'rgba(0,0,0,0.22)'] as const);

  return (
    <View style={[styles.shadow, { borderRadius: radius }, style]}>
      <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]} pointerEvents="none">
        {Platform.OS === 'ios' ? (
          <BlurView intensity={40} tint={isLight ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
        ) : null}
        {/* 1. frosted body */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: body }]} />
        {/* 2. specular sheen from the top-left */}
        <LinearGradient
          colors={sheen}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* 4a. inner shade toward the bottom */}
        <LinearGradient colors={shade} start={{ x: 0.5, y: 0.45 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* 3. rim: full hairline + brighter top arc */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              borderWidth: 1,
              borderColor: rimShadow,
              borderTopColor: rim,
              borderLeftColor: rim,
            },
          ]}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // 4b. drop shadow — iOS shadow; Android elevation needs a (near-transparent) fill to cast.
  shadow: {
    backgroundColor: Platform.OS === 'android' ? 'rgba(0,0,0,0.01)' : 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  clip: { overflow: 'hidden' },
});

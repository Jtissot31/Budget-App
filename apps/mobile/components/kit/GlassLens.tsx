/**
 * GlassLens — real « liquid glass » that works the same on Android (incl. Expo Go) and iOS.
 *
 * Live blur views are unreliable on Android and cannot see behind a Modal window, so the
 * glass refracts a *screenshot* instead: `captureBackdrop()` grabs the screen once (half
 * resolution) when an overlay opens; each lens then shows the part of that image directly
 * beneath it, magnified like a lens, lightly frosted (`Image.blurRadius`, native everywhere)
 * and tinted to stay on-theme. Depth comes from an edge vignette, a faint glint and a soft
 * shadow — no white outline. Without a snapshot it falls back to a dark glass fill.
 */
import type { ReactNode } from 'react';
import { Dimensions, Image, PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { captureScreen } from 'react-native-view-shot';
import { useAppTheme } from '@/lib/themeContext';

export type GlassBackdrop = { uri: string; width: number; height: number };

/** Screenshot of the current screen in window coordinates, or null if capture fails. */
export async function captureBackdrop(): Promise<GlassBackdrop | null> {
  try {
    const { width, height } = Dimensions.get('window');
    // Half the physical resolution is plenty: the lens frosts and magnifies anyway.
    const scale = PixelRatio.get() / 2;
    const uri = await captureScreen({
      format: 'jpg',
      quality: 0.7,
      result: 'tmpfile',
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    });
    return { uri, width, height };
  } catch {
    return null;
  }
}

type Props = {
  backdrop: GlassBackdrop | null;
  /** Lens centre in window coordinates (where the glass sits on screen). */
  center: { x: number; y: number } | null;
  width: number;
  height: number;
  radius: number;
  /** 1 = flat frosted glass, > 1 = lens. */
  magnification?: number;
  blur?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function GlassLens({
  backdrop,
  center,
  width,
  height,
  radius,
  magnification = 1.25,
  blur = 2,
  children,
  style,
}: Props) {
  const { isLight } = useAppTheme();
  const tint = isLight ? 'rgba(255,255,255,0.28)' : 'rgba(12,12,16,0.38)';
  const fallback = isLight ? 'rgba(255,255,255,0.86)' : 'rgba(30,30,36,0.92)';
  const edge = isLight ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.42)';

  return (
    <View style={[styles.shadow, { width, height, borderRadius: radius }, style]}>
      <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius, backgroundColor: fallback }]} pointerEvents="none">
        {backdrop && center ? (
          <Image
            source={{ uri: backdrop.uri }}
            blurRadius={blur}
            // Fades in while the bubbles are still springing — no visible pop.
            fadeDuration={200}
            style={{
              position: 'absolute',
              width: backdrop.width * magnification,
              height: backdrop.height * magnification,
              left: width / 2 - center.x * magnification,
              top: height / 2 - center.y * magnification,
            }}
          />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
        {/* Edge vignette (top/bottom + left/right) — the lens « thickness ». */}
        <LinearGradient colors={[edge, 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', edge]} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={[edge, 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', edge]}
          locations={[0, 0.3, 0.7, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Faint glint where light hits the curved top — no outline. */}
        <View
          style={[
            styles.glint,
            {
              width: width * 0.46,
              height: Math.max(4, height * 0.16),
              left: width * 0.16,
              top: height * 0.1,
              borderRadius: height,
              backgroundColor: isLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.10)',
            },
          ]}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  clip: { overflow: 'hidden' },
  glint: { position: 'absolute', transform: [{ rotate: '-12deg' }] },
});

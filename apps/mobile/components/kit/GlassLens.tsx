/**
 * GlassLens — « liquid glass » that works the same on Android (incl. Expo Go) and iOS.
 *
 * Live blur views are unreliable on Android and cannot see behind a Modal window, so the
 * glass refracts a *screenshot* instead: `captureBackdrop()` grabs the screen once when an
 * overlay opens; each lens then shows the part of that image directly beneath it, magnified
 * (lens) or heavily blurred (frosted), with a light theme tint. No outline, no fake glint.
 * Without a snapshot it falls back to a plain dark / light glass fill.
 */
import type { ReactNode } from 'react';
import { Dimensions, Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { captureScreen } from 'react-native-view-shot';
import { useAppTheme } from '@/lib/themeContext';

/** Snapshot laid out in screen coordinates (`width` = screen width, `height` keeps the image ratio). */
export type GlassBackdrop = { uri: string; width: number; height: number };

function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => Image.getSize(uri, (width, height) => resolve({ width, height }), reject));
}

/** Screenshot of the current screen, or null if capture fails. */
export async function captureBackdrop(): Promise<GlassBackdrop | null> {
  try {
    // Capture at the device's native size: forcing window dimensions squashes the image on
    // edge-to-edge Android (status + nav bars) and every lens then samples the wrong spot.
    const uri = await captureScreen({ format: 'jpg', quality: 0.6, result: 'tmpfile' });
    const pixels = await imageSize(uri);
    const screenWidth = Dimensions.get('screen').width;
    return { uri, width: screenWidth, height: screenWidth * (pixels.height / pixels.width) };
  } catch {
    return null;
  }
}

type Props = {
  backdrop: GlassBackdrop | null;
  /** Lens centre in screen coordinates (measureInWindow inside a status-bar-translucent Modal). */
  center: { x: number; y: number } | null;
  width: number;
  height: number;
  radius: number;
  /** > 1 = lens; 1 = flat. */
  magnification?: number;
  blur?: number;
  /** Extra theme tint on top (0..1) — raise it for text legibility. */
  tintStrength?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function GlassLens({
  backdrop,
  center,
  width,
  height,
  radius,
  magnification = 1.2,
  blur = 1,
  tintStrength = 0.12,
  children,
  style,
}: Props) {
  const { isLight } = useAppTheme();
  // Graphite glass in dark mode — clearly raised above the dimmed screen, still see-through.
  const tint = isLight ? `rgba(255,255,255,${tintStrength + 0.35})` : `rgba(72,72,82,${Math.min(0.92, 0.42 + tintStrength)})`;
  const sheen = isLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.12)';
  const fallback = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(38,38,44,0.95)';

  return (
    <View style={[styles.shadow, { width, height, borderRadius: radius }, style]}>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius, backgroundColor: backdrop ? 'transparent' : fallback }]}
      >
        {backdrop && center ? (
          <Image
            source={{ uri: backdrop.uri }}
            blurRadius={blur}
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
        {/* Soft light wash in the upper half — a fill, not an outline. */}
        <LinearGradient colors={[sheen, 'rgba(255,255,255,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={StyleSheet.absoluteFill} />
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
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  clip: { overflow: 'hidden' },
});

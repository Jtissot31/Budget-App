import { useEffect, useState, memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import {
  isSamsungLiquidGlassAvailable,
  SamsungLiquidGlassView,
} from 'samsung-liquid-glass';

export type DynamicBlurTone = 'neutral' | 'accentGreen';

type Props = {
  isLight: boolean;
  cornerRadius: number;
  style?: StyleProp<ViewStyle>;
  /** Default `neutral` (nav + FABs). `accentGreen` kept for rare tinted glass. */
  tone?: DynamicBlurTone;
  /**
   * Live SemBlur sample cadence. Default ~48ms (coordinator floors waves ~32ms).
   */
  minRefreshMs?: number;
  /**
   * Live updating blur (nav + FABs). Coordinator batches all live views in one wave.
   */
  live?: boolean;
};

const SAMSUNG_RADIUS = 90;
/** Live sample cadence — continuous native loop + region capture. */
const LIVE_REFRESH_MS = 48;

function rgbaToHexOverlay(r: number, g: number, b: number, a: number): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(a * 255)}${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function isExpoGoRuntime(): boolean {
  return isRunningInExpoGo() || Constants.appOwnership === 'expo';
}

function shouldUseSamsungBlur(): boolean {
  // Expo Go: tint only — never dimezis / expo-blur (hardware-bitmap crash).
  if (isExpoGoRuntime()) return false;
  // Dev Client / prebuild: mount SemBlur whenever the native module is in the APK.
  // Do not gate on isSupported() — that probe can false-negative on One UI 7/8.
  return isSamsungLiquidGlassAvailable();
}

/**
 * Android floating-nav / FAB background.
 * Expo Go: dense translucent tint only — never expo-blur / dimezis BlurView
 * (avoids "software rendering doesn't support hardware bitmap").
 * Dev Client / prebuild APK on Samsung: SemBlur via samsung-liquid-glass.
 * Non-Samsung custom builds: native view no-ops to a tint — do not enable dimezis here.
 */
function TabBarDynamicBlurImpl({
  isLight,
  cornerRadius,
  style,
  tone = 'neutral',
  minRefreshMs,
  live = true,
}: Props) {
  const [useSamsung, setUseSamsung] = useState(shouldUseSamsungBlur);
  useEffect(() => {
    setUseSamsung(shouldUseSamsungBlur());
  }, []);

  const accent = tone === 'accentGreen';
  const liveCapture = live;
  const refreshMs = minRefreshMs ?? LIVE_REFRESH_MS;

  // Dense tint in Expo Go — no blur sampling; must stay opaque enough to read icons.
  // FABs use neutral by default (no green fill plate).
  const wash = accent
    ? isLight
      ? 'rgba(34, 197, 94, 0.82)'
      : 'rgba(34, 197, 94, 0.72)'
    : isLight
      ? 'rgba(255, 255, 255, 0.82)'
      : 'rgba(12, 12, 14, 0.78)';
  const rim = accent
    ? isLight
      ? 'rgba(255, 255, 255, 0.55)'
      : 'rgba(255, 255, 255, 0.28)'
    : isLight
      ? 'rgba(0, 0, 0, 0.12)'
      : 'rgba(255, 255, 255, 0.2)';
  // SemBlur overlay — keep green extremely light if accent is requested; FABs use neutral.
  const samsungOverlay = accent
    ? rgbaToHexOverlay(34, 197, 94, isLight ? 0.06 : 0.08)
    : isLight
      ? rgbaToHexOverlay(255, 255, 255, 0.16)
      : rgbaToHexOverlay(12, 12, 14, 0.14);
  // Extra wash on top of SemBlur — transparent for neutral so glass shows through.
  // Accent keeps a faint tint only (not a solid green disk).
  const samsungWash = accent
    ? isLight
      ? 'rgba(34, 197, 94, 0.06)'
      : 'rgba(34, 197, 94, 0.08)'
    : 'transparent';

  // Always clip to cornerRadius (pill / circle) so FABs never show a square plate.
  const clipBlur = true;

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: cornerRadius, overflow: clipBlur ? 'hidden' : 'visible' },
        style,
      ]}
    >
      {useSamsung ? (
        <SamsungLiquidGlassView
          radius={SAMSUNG_RADIUS}
          overlayColor={samsungOverlay}
          cornerRadius={cornerRadius}
          minRefreshMs={refreshMs}
          live={liveCapture}
          enabled
          style={[StyleSheet.absoluteFill, { borderRadius: cornerRadius }]}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: cornerRadius, backgroundColor: wash },
          ]}
        />
      )}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: cornerRadius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: rim,
            backgroundColor: useSamsung ? samsungWash : 'transparent',
          },
        ]}
      />
    </View>
  );
}

export const TabBarDynamicBlur = memo(TabBarDynamicBlurImpl);

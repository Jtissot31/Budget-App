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
  /** Default `neutral` (nav pill). `accentGreen` = translucent green glass FABs. */
  tone?: DynamicBlurTone;
  /**
   * SemBlur PixelCopy cadence. Nav stays live; FABs use a slower refresh so
   * multiple glass surfaces do not fight for hide→PixelCopy→show waves.
   */
  minRefreshMs?: number;
};

const SAMSUNG_RADIUS = 90;
/** Live scroll-following blur for the floating tab pill. */
const NAV_REFRESH_MS = 180;
/** Slower FAB refresh — cuts flicker when stacked with the nav SemBlur. */
const FAB_REFRESH_MS = 500;

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
}: Props) {
  const [useSamsung, setUseSamsung] = useState(shouldUseSamsungBlur);
  useEffect(() => {
    setUseSamsung(shouldUseSamsungBlur());
  }, []);

  const accent = tone === 'accentGreen';
  const refreshMs = minRefreshMs ?? (accent ? FAB_REFRESH_MS : NAV_REFRESH_MS);

  // Dense tint in Expo Go — no blur sampling; must stay opaque enough to read icons.
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
      ? 'rgba(255, 255, 255, 0.4)'
      : 'rgba(255, 255, 255, 0.12)';
  const samsungOverlay = accent
    ? rgbaToHexOverlay(34, 197, 94, isLight ? 0.22 : 0.28)
    : isLight
      ? rgbaToHexOverlay(255, 255, 255, 0.16)
      : rgbaToHexOverlay(12, 12, 14, 0.14);
  const samsungWash = accent
    ? isLight
      ? 'rgba(34, 197, 94, 0.18)'
      : 'rgba(34, 197, 94, 0.22)'
    : isLight
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(12, 12, 14, 0.14)';

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={[
        StyleSheet.absoluteFillObject,
        { borderRadius: cornerRadius, overflow: useSamsung ? 'visible' : 'hidden' },
        style,
      ]}
    >
      {useSamsung ? (
        <SamsungLiquidGlassView
          radius={SAMSUNG_RADIUS}
          overlayColor={samsungOverlay}
          cornerRadius={cornerRadius}
          minRefreshMs={refreshMs}
          enabled
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: cornerRadius, backgroundColor: wash },
          ]}
        />
      )}
      <View
        style={[
          StyleSheet.absoluteFillObject,
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

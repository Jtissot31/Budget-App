import { requireOptionalNativeModule, requireNativeViewManager } from 'expo-modules-core';
import Constants from 'expo-constants';
import React from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';

type SamsungLiquidGlassProps = {
  radius?: number;
  /** Android Color.parseColor string, e.g. `#570C0C0E` */
  overlayColor?: string;
  cornerRadius?: number;
  enabled?: boolean;
  /**
   * Min ms between live PixelCopy refreshes for this view.
   * Nav pill ~140; FABs ~450 (shared coordinator wave is still ≥140ms).
   */
  minRefreshMs?: number;
  style?: StyleProp<ViewStyle>;
};

type SamsungLiquidGlassModule = {
  isSupported?: () => boolean;
};

let NativeView: React.ComponentType<SamsungLiquidGlassProps> | null = null;
let NativeModule: SamsungLiquidGlassModule | null = null;

function isExpoGoRuntime(): boolean {
  // Expo Go ships no custom native modules. Dev Client / prebuild: appOwnership is null.
  return Constants.appOwnership === 'expo';
}

function loadNative() {
  if (Platform.OS !== 'android') return;
  if (isExpoGoRuntime()) {
    NativeModule = null;
    NativeView = null;
    return;
  }
  if (NativeView && NativeModule) return;
  try {
    NativeModule = requireOptionalNativeModule<SamsungLiquidGlassModule>('SamsungLiquidGlass');
    if (NativeModule) {
      NativeView = requireNativeViewManager('SamsungLiquidGlass');
    }
  } catch {
    NativeModule = null;
    NativeView = null;
  }
}

/** True when the Dev Client / prebuild APK includes the SemBlur view (never in Expo Go). */
export function isSamsungLiquidGlassAvailable(): boolean {
  if (Platform.OS !== 'android') return false;
  if (isExpoGoRuntime()) return false;
  loadNative();
  return NativeModule != null && NativeView != null;
}

/** True when running a custom Android binary that includes SemBlur One UI glass. */
export function isSamsungLiquidGlassSupported(): boolean {
  if (!isSamsungLiquidGlassAvailable()) return false;
  try {
    if (typeof NativeModule?.isSupported === 'function') {
      return NativeModule.isSupported() === true;
    }
  } catch {
    // Native probe failed — still mount the view; apply() is a no-op off Samsung.
  }
  return true;
}

export function SamsungLiquidGlassView(props: SamsungLiquidGlassProps) {
  loadNative();
  if (!NativeView) return null;
  return <NativeView {...props} />;
}

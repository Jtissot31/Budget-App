/**
 * Shared floating action button — same live dynamic blur as the tab pill
 * (`TabBarDynamicBlur`: SemBlur / expo-blur / Expo Go tint). No solid green plate —
 * glass/blur shows through the circular disc; glyph uses theme text color.
 * Subtle theme-aware hairline outline for edge readability over blur.
 * Android: elevation 0 so SemBlur can sample content behind the disc.
 */
import { useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { TabBarDynamicBlur } from '@/components/tabbar/TabBarDynamicBlur';
import {
  TRANSACTIONS_FAB_GLOW_BLUR,
  TRANSACTIONS_FAB_SIZE,
} from '@/constants/fabStyles';
import { floatingGlassButtonPressed } from '@/constants/floatingGlassButton';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityState?: AccessibilityState;
  style?: StyleProp<ViewStyle>;
  /** Disc diameter — defaults to Historique / Agenda primary FAB (54). */
  size?: number;
  /**
   * Visual tone for rim/wash. Prefer `neutral` so blur shows through without a
   * green fill disk; glyph color comes from children.
   */
  tone?: 'accentGreen' | 'neutral';
};

export function GlassFab({
  children,
  onPress,
  accessibilityLabel,
  accessibilityState,
  style,
  size = TRANSACTIONS_FAB_SIZE,
  tone = 'neutral',
}: Props) {
  const { colors, isLight } = useAppTheme();
  const [pressed, setPressed] = useState(false);
  const cornerRadius = size / 2;
  // Theme border + soft light/dark rim so the circle stays readable over live blur.
  const outlineColor = isLight
    ? 'rgba(0, 0, 0, 0.14)'
    : colors.containerBorder || 'rgba(255, 255, 255, 0.22)';

  // NativeWind's Pressable interop spreads `style` with `{...style}`. A function
  // has no enumerable keys, so that becomes `{}` and the full-width tab host
  // stretches the button into a short bar. Keep this an array of plain objects.
  const discStyle: ViewStyle = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    maxWidth: size,
    maxHeight: size,
    borderRadius: cornerRadius,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    alignSelf: 'flex-end',
    // SemBlur samples empty pixels if the disc is elevated offscreen.
    elevation: Platform.OS === 'android' ? 0 : TRANSACTIONS_FAB_GLOW_BLUR.elevation,
    // Clip blur/tint to the circular disc — no square plate around the FAB.
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: TRANSACTIONS_FAB_GLOW_BLUR.shadowOffset,
          shadowOpacity: TRANSACTIONS_FAB_GLOW_BLUR.shadowOpacity,
          shadowRadius: TRANSACTIONS_FAB_GLOW_BLUR.shadowRadius,
        }
      : null),
  };

  return (
    <Pressable
      pointerEvents="auto"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={[styles.shell, discStyle, style, pressed ? floatingGlassButtonPressed : null]}
    >
      <View
        pointerEvents="none"
        collapsable={false}
        renderToHardwareTextureAndroid={false}
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: cornerRadius,
            overflow: 'hidden',
          },
        ]}
      >
        <TabBarDynamicBlur
          isLight={isLight}
          cornerRadius={cornerRadius}
          tone={tone}
          // Same live SemBlur pipeline as the tab bar (coordinator batches waves).
          live
        />
      </View>
      {/* Dedicated outline ring above blur — hairline stays crisp on Android. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: cornerRadius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: outlineColor,
          },
        ]}
      />
      <View pointerEvents="none" style={styles.content}>
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  content: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * Shared floating action button — same dynamic blur material as the tab pill
 * (`TabBarDynamicBlur`: SemBlur / expo-blur / Expo Go tint), green-tinted glass.
 * Android: elevation 0 so SemBlur can sample content behind the disc.
 */
import type { ReactNode } from 'react';
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
  /** Green accent glass (default) or neutral liquid glass. */
  tone?: 'accentGreen' | 'neutral';
};

export function GlassFab({
  children,
  onPress,
  accessibilityLabel,
  accessibilityState,
  style,
  size = TRANSACTIONS_FAB_SIZE,
  tone = 'accentGreen',
}: Props) {
  const { isLight } = useAppTheme();
  const cornerRadius = size / 2;
  const blurTone = tone === 'accentGreen' ? 'accentGreen' : 'neutral';

  return (
    <Pressable
      pointerEvents="auto"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={({ pressed }) => [
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: cornerRadius,
          // SemBlur samples empty pixels if the disc is elevated offscreen.
          elevation: Platform.OS === 'android' ? 0 : TRANSACTIONS_FAB_GLOW_BLUR.elevation,
          overflow: Platform.OS === 'android' ? 'visible' : 'hidden',
          ...(Platform.OS === 'ios'
            ? {
                shadowColor: tone === 'accentGreen' ? '#22C55E' : '#000',
                shadowOffset: TRANSACTIONS_FAB_GLOW_BLUR.shadowOffset,
                shadowOpacity: TRANSACTIONS_FAB_GLOW_BLUR.shadowOpacity,
                shadowRadius: TRANSACTIONS_FAB_GLOW_BLUR.shadowRadius,
              }
            : null),
        },
        style,
        pressed && floatingGlassButtonPressed,
      ]}
    >
      <View
        pointerEvents="none"
        collapsable={false}
        renderToHardwareTextureAndroid={false}
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: cornerRadius,
            overflow: Platform.OS === 'android' ? 'visible' : 'hidden',
          },
        ]}
      >
        <TabBarDynamicBlur isLight={isLight} cornerRadius={cornerRadius} tone={blurTone} />
      </View>
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

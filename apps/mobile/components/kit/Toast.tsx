/**
 * App-wide confirmation toast — slides down from the top, auto-dismisses.
 *
 * Mount `<ToastHost />` once (root layout); call `showToast({...})` from anywhere
 * (e.g. after saving a transaction) for instant, rewarding feedback.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

export type ToastOptions = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Accent for the icon disc (defaults to green). */
  tone?: string;
  durationMs?: number;
};

type Listener = (toast: ToastOptions & { id: number }) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function showToast(options: ToastOptions) {
  const toast = { ...options, id: nextId++ };
  listeners.forEach((listener) => listener(toast));
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const progress = useSharedValue(0);
  const latestId = useRef(0);

  useEffect(() => {
    const listener: Listener = (next) => {
      latestId.current = next.id;
      setToast(next);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = toast.id;
    const clear = () => {
      if (latestId.current === id) setToast(null);
    };
    progress.set(0);
    progress.set(
      withSequence(
        withSpring(1, { damping: 16, stiffness: 220 }),
        withDelay(
          toast.durationMs ?? 2200,
          withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => {
            if (done) runOnJS(clear)();
          }),
        ),
      ),
    );
  }, [progress, toast]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (progress.value - 1) * 40 }, { scale: 0.96 + progress.value * 0.04 }],
  }));

  if (!toast) return null;
  const tone = toast.tone ?? colors.accentGreen;

  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + 8 }]}>
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor: colors.modalSurface ?? colors.containerBackground, borderColor: colors.containerBorder },
          animated,
        ]}
      >
        <View style={[styles.iconDisc, { backgroundColor: `${tone}26` }]}>
          <AppIcon family="ionicons" name={toast.icon ?? 'checkmark'} size={18} color={tone} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {toast.title}
          </Text>
          {toast.subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {toast.subtitle}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000, elevation: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 18,
    maxWidth: 420,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  iconDisc: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  copy: { flexShrink: 1, minWidth: 0 },
  title: { ...typographyKit.metaSemibold, fontSize: 14 },
  subtitle: { ...typographyKit.metaMedium, fontSize: 12, marginTop: 1 },
});

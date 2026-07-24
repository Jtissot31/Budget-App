import { Tabs, usePathname, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { AppGuidedTour } from '@/components/onboarding/AppGuidedTour';
import { useAppTheme } from '@/lib/themeContext';

const MAIN_TAB_PATHS = ['/', '/transactions', '/goals', '/accounts', '/budgets'] as const;

const SWIPE_MIN_DISTANCE = 58;
const SWIPE_MIN_VELOCITY = 520;
const SWIPE_SETTLE_MS = 210;
const SWIPE_DRAG_FACTOR = 0.34;
const SWIPE_EXIT_FACTOR = 0.32;

export default function TabLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const activeTabIndex = MAIN_TAB_PATHS.findIndex((path) => path === pathname);

  const completeSwipe = useCallback(
    (direction: 1 | -1) => {
      if (activeTabIndex === -1) return;

      const nextIndex = activeTabIndex + direction;
      const nextPath = MAIN_TAB_PATHS[nextIndex];
      if (!nextPath) return;

      router.navigate(nextPath);
      translateX.value = direction * width;
      translateX.value = withTiming(0, {
        duration: SWIPE_SETTLE_MS,
        easing: Easing.out(Easing.cubic),
      });
    },
    [activeTabIndex, router, translateX, width],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(translateX.value);
    const scale = interpolate(distance, [0, width], [1, 0.985], Extrapolation.CLAMP);
    const opacity = interpolate(distance, [0, width], [1, 0.92], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ translateX: translateX.value }, { scale }],
    };
  });

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-30, 30])
        .failOffsetY([-22, 22])
        .onUpdate(({ translationX }) => {
          if (activeTabIndex === -1) return;
          const atFirst = activeTabIndex === 0;
          const atLast = activeTabIndex === MAIN_TAB_PATHS.length - 1;
          const blocked = (translationX > 0 && atFirst) || (translationX < 0 && atLast);
          translateX.value = blocked ? translationX * 0.08 : translationX * SWIPE_DRAG_FACTOR;
        })
        .onEnd(({ translationX, translationY, velocityX }) => {
          const horizontalIntent = Math.abs(translationX) > Math.abs(translationY) * 1.2;
          const reachedDistance = Math.abs(translationX) >= SWIPE_MIN_DISTANCE;
          const reachedVelocity = Math.abs(velocityX) >= SWIPE_MIN_VELOCITY;
          const direction = translationX < 0 ? 1 : -1;
          const nextIndex = activeTabIndex + direction;
          const canNavigate = activeTabIndex !== -1 && nextIndex >= 0 && nextIndex < MAIN_TAB_PATHS.length;

          if (!horizontalIntent || (!reachedDistance && !reachedVelocity) || !canNavigate) {
            translateX.value = withTiming(0, {
              duration: 220,
              easing: Easing.out(Easing.cubic),
            });
            return;
          }

          translateX.value = withTiming(direction === 1 ? -width * SWIPE_EXIT_FACTOR : width * SWIPE_EXIT_FACTOR, {
            duration: SWIPE_SETTLE_MS,
            easing: Easing.out(Easing.cubic),
          }, () => {
            runOnJS(completeSwipe)(direction);
          });
        }),
    [activeTabIndex, completeSwipe, translateX, width],
  );

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Animated.View
          style={[styles.container, { backgroundColor: colors.background }, animatedStyle]}
        >
          <Tabs
            tabBar={(props) => <FloatingTabBar {...props} />}
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              transitionSpec: {
                animation: 'timing',
                config: { duration: 180 },
              },
              sceneStyle: { backgroundColor: colors.background },
              tabBarShowLabel: false,
              tabBarStyle: { display: 'none' },
            }}
          >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="transactions" />
            <Tabs.Screen name="goals" options={{ title: 'Plan financier' }} />
            <Tabs.Screen name="accounts" options={{ title: 'Portefeuille' }} />
            <Tabs.Screen name="budgets" />
            <Tabs.Screen name="widgets" options={{ title: 'Galerie widgets', href: null }} />
            <Tabs.Screen name="settings" />
          </Tabs>
        </Animated.View>
        <AppGuidedTour />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

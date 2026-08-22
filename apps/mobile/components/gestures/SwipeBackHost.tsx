import { type ReactNode, useCallback, useEffect, useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  isSwipeBackBlockedPath,
  consumeSwipeBackNavigationSlot,
  resolveSwipeBackDecision,
  shouldCommitSwipeBack,
} from '@/lib/gestures/swipeBackDecision';
import { isSwipeBackExcluded } from '@/lib/gestures/swipeBackExclusion';

const SWIPE_BACK_SETTLE_MS = 220;
const SWIPE_BACK_EXIT_MS = 200;

type Props = {
  children: ReactNode;
};

/**
 * Android full-width swipe-right → go back for non-tab stack routes.
 * iOS keeps the native stack interactive pop (`gestureEnabled` /
 * `fullScreenGestureEnabled` on the root Stack). Root tabs are blocked.
 */
export function SwipeBackHost({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const translateX = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const enabledSV = useSharedValue(0);
  const isNavigating = useSharedValue(false);
  const screenWidth = useSharedValue(width);

  useEffect(() => {
    screenWidth.value = width;
  }, [screenWidth, width]);

  useEffect(() => {
    const allowed = Platform.OS === 'android' && !isSwipeBackBlockedPath(pathname);
    enabledSV.value = allowed ? 1 : 0;
    translateX.value = 0;
    isNavigating.value = false;
  }, [enabledSV, isNavigating, pathname, translateX]);

  const navigateBack = useCallback(() => {
    if (!consumeSwipeBackNavigationSlot()) {
      translateX.value = 0;
      isNavigating.value = false;
      return;
    }
    if (router.canGoBack()) {
      router.back();
    }
    translateX.value = 0;
    isNavigating.value = false;
  }, [isNavigating, router, translateX]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(Platform.OS === 'android')
        .manualActivation(true)
        .onTouchesDown((event) => {
          'worklet';
          const touch = event.allTouches[0];
          touchStartX.value = touch?.absoluteX ?? 0;
          touchStartY.value = touch?.absoluteY ?? 0;
        })
        .onTouchesMove((event, state) => {
          'worklet';
          if (enabledSV.value !== 1 || isNavigating.value || isSwipeBackExcluded()) {
            state.fail();
            return;
          }
          const touch = event.allTouches[0];
          if (!touch) return;
          const dx = touch.absoluteX - touchStartX.value;
          const dy = touch.absoluteY - touchStartY.value;
          const decision = resolveSwipeBackDecision(dx, dy);
          if (decision === 'activate') {
            state.activate();
          } else if (decision === 'reject') {
            state.fail();
          }
        })
        .onUpdate((event) => {
          'worklet';
          if (isNavigating.value) return;
          translateX.value = Math.max(0, event.translationX);
        })
        .onEnd((event) => {
          'worklet';
          if (isNavigating.value) return;
          const dx = Math.max(0, event.translationX);
          if (shouldCommitSwipeBack(dx, event.velocityX)) {
            isNavigating.value = true;
            translateX.value = withTiming(
              screenWidth.value,
              { duration: SWIPE_BACK_EXIT_MS, easing: Easing.out(Easing.cubic) },
              (finished) => {
                if (finished) {
                  runOnJS(navigateBack)();
                } else {
                  isNavigating.value = false;
                  translateX.value = 0;
                }
              },
            );
            return;
          }
          translateX.value = withTiming(0, {
            duration: SWIPE_BACK_SETTLE_MS,
            easing: Easing.out(Easing.cubic),
          });
        })
        .onFinalize((_, success) => {
          'worklet';
          if (!success && !isNavigating.value) {
            translateX.value = withTiming(0, {
              duration: SWIPE_BACK_SETTLE_MS,
              easing: Easing.out(Easing.cubic),
            });
          }
        }),
    [
      enabledSV,
      isNavigating,
      navigateBack,
      screenWidth,
      touchStartX,
      touchStartY,
      translateX,
    ],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (Platform.OS !== 'android') {
    return <>{children}</>;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.host, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});

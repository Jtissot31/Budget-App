import { Tabs, usePathname, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { AppBottomTabBar } from '@/components/BottomNavBar';
import { useAppTheme } from '@/lib/themeContext';

/**
 * Main bottom-nav routes only, in bar order: Home, Activity, Budget, Agenda, Balance.
 * Settings stays in the Tabs navigator for deep links but is excluded from swipe.
 *
 * Root-tab swipe moves between these paths (or no-ops at the ends). Detail /
 * sheet swipe-back is owned elsewhere and deliberately blocked on these paths
 * via `isSwipeBackBlockedPath`.
 */
const MAIN_TAB_PATHS = ['/', '/transactions', '/budgets', '/goals', '/accounts'] as const;

const SWIPE_MIN_DISTANCE = 56;
const SWIPE_MIN_VELOCITY = 520;

export default function TabLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const { colors } = useAppTheme();
  const activeTabIndex = MAIN_TAB_PATHS.findIndex((path) => path === pathname);

  const navigateBySwipe = useCallback(
    (direction: 1 | -1) => {
      if (activeTabIndex === -1) return;
      const nextPath = MAIN_TAB_PATHS[activeTabIndex + direction];
      if (!nextPath) return;
      // Navigator owns the scene transition (`animation: 'shift'`). No outer
      // translateX choreography — that used to delay navigate by ~210ms and
      // fight the tab fade, which read as stutter.
      router.navigate(nextPath);
    },
    [activeTabIndex, router],
  );

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        // Claim only clear horizontal intent so vertical lists keep scrolling.
        .activeOffsetX([-28, 28])
        .failOffsetY([-20, 20])
        .onEnd(({ translationX, translationY, velocityX }) => {
          'worklet';
          if (activeTabIndex === -1) return;

          const horizontalIntent = Math.abs(translationX) > Math.abs(translationY) * 1.15;
          const reachedDistance = Math.abs(translationX) >= SWIPE_MIN_DISTANCE;
          const reachedVelocity = Math.abs(velocityX) >= SWIPE_MIN_VELOCITY;
          if (!horizontalIntent || (!reachedDistance && !reachedVelocity)) return;

          const direction: 1 | -1 = translationX < 0 ? 1 : -1;
          const nextIndex = activeTabIndex + direction;
          // Home right-swipe and Balance left-swipe: nothing (never pop / exit).
          if (nextIndex < 0 || nextIndex >= MAIN_TAB_PATHS.length) return;

          runOnJS(navigateBySwipe)(direction);
        }),
    [activeTabIndex, navigateBySwipe],
  );

  const tabs = (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Tabs
        tabBar={(props) => <AppBottomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          // Default is already lazy; keep explicit so adjacent heavy hubs
          // (SQLite + charts) do not mount until first visit.
          lazy: true,
          animation: 'fade',
          transitionSpec: {
            animation: 'timing',
            config: { duration: 180 },
          },
          sceneStyle: { backgroundColor: colors.background },
          tabBarShowLabel: false,
          // Dock overlays the scene. The slot is only as tall as the tab row
          // (no default fill, no FAB spacer). zIndex keeps it above the scene on web.
          tabBarStyle: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
            overflow: 'visible',
            zIndex: 50,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Accueil' }} />
        <Tabs.Screen name="transactions" options={{ title: 'Activité' }} />
        <Tabs.Screen name="budgets" options={{ title: 'Budget' }} />
        <Tabs.Screen name="goals" options={{ title: 'Agenda' }} />
        <Tabs.Screen
          name="accounts"
          options={{ title: 'Wallet', animation: 'none' }}
        />
        <Tabs.Screen name="settings" />
      </Tabs>
    </View>
  );

  // Web: skip GestureDetector — its stacking context isolates CSS backdrop-filter
  // so the pill reads as frost tint with no live blur of scrolling content.
  if (Platform.OS === 'web') {
    return tabs;
  }

  return <GestureDetector gesture={swipeGesture}>{tabs}</GestureDetector>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

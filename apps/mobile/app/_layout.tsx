import 'react-native-gesture-handler';
/** Install web SQLite error guards before boot UI / LogBox mounts. */
import '@/lib/db';
import { Redirect, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { loadAsync as loadFontAsync } from 'expo-font';
import { useEffect, useState } from 'react';
import { InteractionManager, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AppBackgroundGradient } from '@/components/AppBackgroundGradient';
import { RootErrorBoundary } from '@/components/RootErrorBoundary';
import { ensureDbReady } from '@/lib/init';
import {
  isOnboardingCompleted,
  subscribeOnboardingCompleted,
} from '@/lib/onboarding';
import { preloadVectorIconFonts } from '@/lib/preloadVectorIconFonts';
import { useAppFonts } from '@/lib/useAppFonts';
import { ThemeProvider, useAppTheme } from '@/lib/themeContext';
import { configureSystemTypographyDefaults, configureTypographyDefaults } from '@/lib/typographyDefaults';
import { fontFamilies } from '@/constants/theme';

/** Safety cap only — Stack renders immediately; fonts/DB run in the background. */
const BOOTSTRAP_MAX_MS = 0;

configureTypographyDefaults();
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootErrorBoundary>
        <ThemeProvider>
          <ThemedRootShell />
        </ThemeProvider>
      </RootErrorBoundary>
    </GestureHandlerRootView>
  );
}

function ThemedRootShell() {
  const { colors } = useAppTheme();

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}>
      <RootLayoutContent />
    </SafeAreaProvider>
  );
}

function RootLayoutContent() {
  const { colors, statusBarStyle } = useAppTheme();
  const [ready, setReady] = useState(true);
  /** null = still resolving; true = show intro before tabs. */
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  // Critical path fonts only — DM Mono is receipt/articles-only (deferred).
  const [fontsLoaded, fontError] = useAppFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    preloadVectorIconFonts();
    console.log('[Boot] layout mount — Stack visible immediately');
    SplashScreen.hideAsync().catch(() => {});
    void (async () => {
      try {
        // Settings are readable as soon as SQLite opens — don't wait for demo seed.
        const done = await isOnboardingCompleted();
        setNeedsOnboarding(!done);
      } catch (error) {
        console.warn('[Boot] onboarding gate failed', error);
        setNeedsOnboarding(false);
      }
    })();
    void (async () => {
      try {
        await ensureDbReady();
        console.log('[Boot] database ready');
      } catch (error) {
        console.warn('[Boot] database init failed', error);
      }
    })();
    const unsub = subscribeOnboardingCompleted((done) => {
      setNeedsOnboarding(!done);
    });
    const idle = InteractionManager.runAfterInteractions(() => {
      void loadFontAsync({
        DMMono_400Regular,
        DMMono_500Medium,
      }).catch((error: unknown) => {
        console.warn('[Boot] deferred DM Mono load failed', error);
      });
    });
    const timer = setTimeout(() => {
      console.log('[Boot] bootstrap safety tick');
      setReady(true);
    }, BOOTSTRAP_MAX_MS);
    return () => {
      unsub();
      idle.cancel();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      configureTypographyDefaults();
      return;
    }
    if (fontError) {
      configureSystemTypographyDefaults();
    }
  }, [fontsLoaded, fontError]);

  if (!ready || needsOnboarding === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppBackgroundGradient />
        <StatusBar style={statusBarStyle} backgroundColor={colors.background} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={statusBarStyle} backgroundColor={colors.background} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppBackgroundGradient />
        <View style={{ flex: 1, zIndex: 1 }}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: 'transparent' },
              headerTransparent: true,
              headerTintColor: colors.text,
              headerTitleStyle: {
                fontFamily: fontFamilies.bold,
                fontWeight: 'normal',
                fontSize: 17,
              },
              animation: 'fade_from_bottom',
              animationDuration: 250,
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="onboarding"
              options={{
                headerShown: false,
                gestureEnabled: false,
                animation: 'fade',
              }}
            />
            <Stack.Screen
              name="add-transaction"
              options={{
                headerShown: false,
                presentation: 'transparentModal',
                animation: 'fade_from_bottom',
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <Stack.Screen name="account-detail" options={{ headerShown: false }} />
            <Stack.Screen name="merchant-detail" options={{ headerShown: false }} />
            <Stack.Screen name="contact-detail" options={{ headerShown: false }} />
            <Stack.Screen name="merchant-receipts" options={{ headerShown: false }} />
            <Stack.Screen name="wealth-asset-detail" options={{ headerShown: false }} />
            <Stack.Screen name="loan-detail" options={{ headerShown: false }} />
            <Stack.Screen name="stock" options={{ headerShown: false }} />
            <Stack.Screen name="transaction-detail" options={{ headerShown: false }} />
            <Stack.Screen name="wealth-asset-transactions" options={{ headerShown: false }} />
            <Stack.Screen name="goal-detail" options={{ headerShown: false }} />
            <Stack.Screen name="savings-goal-transactions" options={{ headerShown: false }} />
            <Stack.Screen name="budget-category-transactions" options={{ headerShown: false }} />
            <Stack.Screen name="savings-goals" options={{ headerShown: false }} />
            <Stack.Screen name="transactions-insights" options={{ headerShown: false }} />
            <Stack.Screen name="paycheck-allocation" options={{ headerShown: false }} />
            <Stack.Screen name="lucide-icons" options={{ headerShown: false }} />
            <Stack.Screen name="plans" options={{ headerShown: false }} />
            <Stack.Screen name="scan" options={{ title: 'Scanner', presentation: 'modal' }} />
            <Stack.Screen name="ai-chat" options={{ headerShown: false }} />
            <Stack.Screen name="ai-advisor" options={{ headerShown: false }} />
            <Stack.Screen name="fyn-chat" options={{ headerShown: false }} />
            <Stack.Screen name="alert-center" options={{ headerShown: false }} />
            <Stack.Screen name="alert-detail" options={{ headerShown: false }} />
          </Stack>
          {needsOnboarding ? <Redirect href="/onboarding" /> : null}
        </View>
      </View>
    </>
  );
}

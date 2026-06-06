import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { AppBackgroundGradient } from '@/components/AppBackgroundGradient';
import { ensureDbReady } from '@/lib/init';
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
      <ThemeProvider>
        <ThemedRootShell />
      </ThemeProvider>
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
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    console.log('[Boot] layout mount — Stack visible immediately');
    SplashScreen.hideAsync().catch(() => {});
    void (async () => {
      try {
        await ensureDbReady();
        console.log('[Boot] database ready');
      } catch (error) {
        console.warn('[Boot] database init failed', error);
      }
    })();
    const timer = setTimeout(() => {
      console.log('[Boot] bootstrap safety tick');
      setReady(true);
    }, BOOTSTRAP_MAX_MS);
    return () => clearTimeout(timer);
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

  if (!ready) {
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
            <Stack.Screen name="merchant-receipts" options={{ headerShown: false }} />
            <Stack.Screen name="wealth-asset-detail" options={{ headerShown: false }} />
            <Stack.Screen name="wealth-asset-transactions" options={{ headerShown: false }} />
            <Stack.Screen name="savings-goal-transactions" options={{ headerShown: false }} />
            <Stack.Screen name="budget-category-transactions" options={{ headerShown: false }} />
            <Stack.Screen name="scan" options={{ title: 'Scanner', presentation: 'modal' }} />
            <Stack.Screen
              name="ai-chat"
              options={{
                headerShown: false,
                presentation: 'fullScreenModal',
                animation: 'none',
                gestureEnabled: true,
                contentStyle: { flex: 1, backgroundColor: 'transparent' },
              }}
            />
          </Stack>
        </View>
      </View>
    </>
  );
}

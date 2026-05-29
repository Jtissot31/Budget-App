import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
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
import { configureTypographyDefaults } from '@/lib/typographyDefaults';
import { fontFamilies } from '@/constants/theme';

const STARTUP_TIMEOUT_MS = 3500;

configureTypographyDefaults();

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
  const [ready, setReady] = useState(false);
  const { colors, statusBarStyle } = useAppTheme();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => {
      if (mounted) setReady(true);
    }, STARTUP_TIMEOUT_MS);

    ensureDbReady()
      .catch((error) => {
        console.warn('Database initialization failed', error);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (mounted) setReady(true);
      });

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  if (!ready || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <AppBackgroundGradient />
        <ActivityIndicator size="large" color={colors.primary} />
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
            <Stack.Screen name="budget-categories" options={{ headerShown: false }} />
            <Stack.Screen name="account-detail" options={{ headerShown: false }} />
            <Stack.Screen name="merchant-detail" options={{ headerShown: false }} />
            <Stack.Screen name="wealth-asset-detail" options={{ headerShown: false }} />
            <Stack.Screen name="wealth-asset-transactions" options={{ headerShown: false }} />
            <Stack.Screen name="savings-goal-transactions" options={{ headerShown: false }} />
            <Stack.Screen name="budget-category-transactions" options={{ headerShown: false }} />
            <Stack.Screen name="recurring-payments" options={{ headerShown: false }} />
            <Stack.Screen name="savings-goals" options={{ headerShown: false }} />
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

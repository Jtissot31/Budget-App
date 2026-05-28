import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ensureDbReady } from '@/lib/init';
import { ThemeProvider, useAppTheme } from '@/lib/themeContext';
import { configureTypographyDefaults } from '@/lib/typographyDefaults';

const STARTUP_TIMEOUT_MS = 3500;

configureTypographyDefaults();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootLayoutContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutContent() {
  const [ready, setReady] = useState(false);
  const { colors, statusBarStyle } = useAppTheme();

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

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <StatusBar style={statusBarStyle} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '800', fontSize: 17 },
          contentStyle: { backgroundColor: colors.background },
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
        <Stack.Screen name="ai-chat" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </>
  );
}

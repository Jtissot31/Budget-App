import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { darkGhostCardShadow, ghostThemes, lightGhostCardShadow, type GhostTokens } from '@/constants/ghostUi';
import {
  themeColors,
  type AppColors,
  type ThemePreference,
} from '@/constants/theme';
import { getThemePreference, setThemePreference } from '@/lib/settings';

type ThemeContextValue = {
  mode: ThemePreference;
  isLight: boolean;
  colors: AppColors;
  ghost: GhostTokens;
  ghostCardShadow: typeof darkGhostCardShadow | typeof lightGhostCardShadow;
  statusBarStyle: 'light' | 'dark';
  setMode: (mode: ThemePreference) => Promise<void>;
  toggleLightMode: (enabled: boolean) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemePreference>('dark');

  useEffect(() => {
    let active = true;
    getThemePreference().then((storedMode) => {
      if (active) setModeState(storedMode);
    });
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback(async (nextMode: ThemePreference) => {
    setModeState(nextMode);
    await setThemePreference(nextMode);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const isLight = mode === 'light';
    return {
      mode,
      isLight,
      colors: themeColors[mode],
      ghost: ghostThemes[mode],
      ghostCardShadow: isLight ? lightGhostCardShadow : darkGhostCardShadow,
      statusBarStyle: isLight ? 'dark' : 'light',
      setMode,
      toggleLightMode: (enabled) => setMode(enabled ? 'light' : 'dark'),
    };
  }, [mode, setMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return context;
}

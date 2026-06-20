import { useMemo } from 'react';
import { DASHBOARD_VALUE_GREEN, DASHBOARD_VALUE_RED, spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

/** Square generative UI tokens — merged with app theme for light/dark. */
export const AI_WIDGET_RADIUS = 0;

export const aiWidgetTokensDark = {
  background: '#0E0E10',
  surface: '#1C1C1F',
  green: DASHBOARD_VALUE_GREEN,
  red: DASHBOARD_VALUE_RED,
  textMuted: '#666666',
  track: '#08090B',
} as const;

export type AIWidgetColors = {
  background: string;
  surface: string;
  green: string;
  red: string;
  text: string;
  textMuted: string;
  track: string;
  warning: string;
  info: string;
  padding: number;
};

export function useAIWidgetColors(): AIWidgetColors {
  const { colors, isLight } = useAppTheme();

  return useMemo(() => {
    if (isLight) {
      return {
        background: colors.background,
        surface: colors.cardBackground,
        green: colors.accentGreen,
        red: colors.danger,
        text: colors.text,
        textMuted: colors.textSecondary,
        track: colors.surfaceElevated,
        warning: colors.warning,
        info: colors.primary,
        padding: spacing.lg,
      };
    }

    return {
      background: aiWidgetTokensDark.background,
      surface: aiWidgetTokensDark.surface,
      green: aiWidgetTokensDark.green,
      red: aiWidgetTokensDark.red,
      text: colors.text,
      textMuted: aiWidgetTokensDark.textMuted,
      track: aiWidgetTokensDark.track,
      warning: colors.warning,
      info: colors.accentGreen,
      padding: spacing.lg,
    };
  }, [colors, isLight]);
}

/** DM font families for generative widgets (loaded in app/_layout.tsx). */
export const aiWidgetFonts = {
  title: 'DMSerifDisplay_400Regular',
  label: 'DMSans_500Medium',
  labelRegular: 'DMSans_400Regular',
  mono: 'DMMono_500Medium',
  monoRegular: 'DMMono_400Regular',
} as const;

import { useMemo } from 'react';
import { DASHBOARD_VALUE_GREEN } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

export type AIChatColors = {
  background: string;
  surface: string;
  primary: string;
  text: string;
  textMuted: string;
  border: string;
  userBubble: string;
  userBubbleText: string;
  aiBubble: string;
  aiBubbleShadow: string;
  aiBubbleShadowOpacity: number;
  sendMuted: string;
};

export function useAIChatColors(): AIChatColors {
  const { colors, isLight } = useAppTheme();

  return useMemo(() => {
    const accent = isLight ? colors.primary : DASHBOARD_VALUE_GREEN;

    return {
      background: colors.background,
      surface: colors.input,
      primary: accent,
      text: colors.text,
      textMuted: colors.textSecondary,
      border: colors.border,
      userBubble: DASHBOARD_VALUE_GREEN,
      userBubbleText: colors.background,
      aiBubble: colors.containerBackground,
      aiBubbleShadow: isLight ? '#0f172a' : '#000000',
      aiBubbleShadowOpacity: isLight ? 0.08 : 0.16,
      sendMuted: colors.textMuted,
    };
  }, [colors, isLight]);
}

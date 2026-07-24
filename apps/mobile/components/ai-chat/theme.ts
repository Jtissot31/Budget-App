import { useMemo } from 'react';
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
  /** Icon/text color on top of a `primary` (green) surface. */
  onAccent: string;
  aiBubble: string;
  sendMuted: string;
};

export function useAIChatColors(): AIChatColors {
  const { colors } = useAppTheme();

  return useMemo(
    () => ({
      background: colors.background,
      surface: colors.surfaceElevated,
      primary: colors.primary,
      text: colors.text,
      textMuted: colors.textSecondary,
      border: colors.border,
      userBubble: colors.surfaceElevated,
      userBubbleText: colors.text,
      onAccent: colors.background,
      aiBubble: colors.surface,
      sendMuted: colors.textMuted,
    }),
    [colors],
  );
}

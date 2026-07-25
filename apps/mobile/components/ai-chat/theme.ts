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

/** Claude.ai-style Fyn chat palette (dark surface + green user bubbles). */
const FYN_CHAT_DARK = {
  background: '#0E0E10',
  surface: '#1F1F23',
  primary: '#4ADE80',
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.45)',
  border: 'rgba(255,255,255,0.12)',
  userBubble: '#4ADE80',
  userBubbleText: '#0A0A0A',
  onAccent: '#0A0A0A',
  aiBubble: '#28282E',
  sendMuted: 'rgba(255,255,255,0.35)',
} as const;

export function useAIChatColors(): AIChatColors {
  const { colors, isLight } = useAppTheme();

  return useMemo(() => {
    if (!isLight) {
      return { ...FYN_CHAT_DARK };
    }

    return {
      background: colors.background,
      surface: colors.surfaceElevated,
      primary: colors.primary,
      text: colors.text,
      textMuted: colors.textSecondary,
      border: colors.border,
      userBubble: colors.primary,
      userBubbleText: '#0A0A0A',
      onAccent: '#0A0A0A',
      aiBubble: colors.surface,
      sendMuted: colors.textMuted,
    };
  }, [colors, isLight]);
}

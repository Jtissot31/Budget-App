import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { spacing } from '@/constants/theme';
import {
  AI_WIDGET_RADIUS,
  aiWidgetFonts,
  aiWidgetTypography,
  useAIWidgetColors,
} from './theme';

type Props = {
  label?: string;
  /** Override eyebrow tint — optional override. */
  labelColor?: string;
  caption?: string;
  children: ReactNode;
  style?: ViewStyle;
};

export function WidgetCardShell({ label, caption, children, style }: Props) {
  const palette = useAIWidgetColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          padding: palette.padding,
        },
        style,
      ]}
    >
      {label ? (
        <Text
          style={[
            styles.eyebrow,
            aiWidgetTypography.eyebrow,
            { color: palette.textMuted, fontFamily: aiWidgetFonts.label },
          ]}
        >
          {label.toUpperCase()}
        </Text>
      ) : null}
      {children}
      {caption ? (
        <Text
          style={[
            styles.caption,
            aiWidgetTypography.caption,
            { color: palette.textMuted, fontFamily: aiWidgetFonts.labelRegular },
          ]}
        >
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: AI_WIDGET_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  eyebrow: {
    marginBottom: spacing.xs,
  },
  caption: {
    marginTop: spacing.xs,
  },
});

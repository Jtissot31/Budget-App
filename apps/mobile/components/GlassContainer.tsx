import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { radius as themeRadius } from '@/constants/theme';
import { useAppTheme } from '../lib/themeContext';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  borderRadius?: number;
  /** Optional fill override — defaults to theme card surface */
  innerBackgroundColor?: string;
  innerStyle?: StyleProp<ViewStyle>;
  /** Kept for API compatibility — ignored */
  outlineColors?: readonly string[];
};

/** Solid card surface — flat fill, no border, no shadow. */
export function GlassContainer({
  children,
  style,
  padding = 16,
  borderRadius = themeRadius.card,
  innerBackgroundColor,
  innerStyle,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const fillColor =
    innerBackgroundColor ?? (isLight ? colors.cardBackground : colors.cardBackground);

  return (
    <View
      style={[
        {
          borderRadius,
          backgroundColor: fillColor,
          padding,
        },
        innerStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}

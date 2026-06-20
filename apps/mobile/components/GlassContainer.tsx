import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { containerSurfaceStyle, radius as themeRadius } from '@/constants/theme';
import { useAppTheme } from '../lib/themeContext';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  borderRadius?: number;
  /** Optional fill override — defaults to theme container surface */
  innerBackgroundColor?: string;
  innerStyle?: StyleProp<ViewStyle>;
  /** Kept for API compatibility — ignored */
  outlineColors?: readonly string[];
};

/** Solid card surface — low-fund alert shell (fill + 1px outline). */
export function GlassContainer({
  children,
  style,
  padding = 16,
  borderRadius = themeRadius.card,
  innerBackgroundColor,
  innerStyle,
}: Props) {
  const { isLight } = useAppTheme();
  const surface = containerSurfaceStyle(isLight);
  const fillColor = innerBackgroundColor ?? surface.backgroundColor;

  const shellStyle = [
    {
      borderRadius,
      backgroundColor: fillColor,
      borderWidth: surface.borderWidth,
      borderColor: surface.borderColor,
      padding,
    },
    style,
  ];

  if (innerStyle) {
    return (
      <View style={shellStyle}>
        <View style={innerStyle}>{children}</View>
      </View>
    );
  }

  return <View style={shellStyle}>{children}</View>;
}

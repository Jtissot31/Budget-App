import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { radius as themeRadius } from '@/constants/theme';
import { useAppTheme } from '../lib/themeContext';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  borderRadius?: number;
  /** Optional fill override — defaults to theme glass background */
  innerBackgroundColor?: string;
  innerStyle?: StyleProp<ViewStyle>;
  /** Kept for API compatibility — ignored */
  outlineColors?: readonly string[];
};

/** Tinted glass card — transparent fill + 1px border, no blur, no overflow clip. */
export function GlassContainer({
  children,
  style,
  padding = 16,
  borderRadius = themeRadius.md,
  innerBackgroundColor,
  innerStyle,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const fillColor =
    innerBackgroundColor ?? (isLight ? colors.glassBackground : colors.surfaceSolid);

  return (
    <View
      style={[
        {
          borderRadius,
          backgroundColor: fillColor,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          padding,
        },
        innerStyle,
        style,
      ]}
      pointerEvents="box-none"
    >
      {children}
    </View>
  );
}

import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { GlassContainer } from '@/components/GlassContainer';
import { radius, spacing } from '@/constants/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  padding?: number;
  borderRadius?: number;
  innerBackgroundColor?: string;
  variant?: 'card' | 'flat';
};

export function SurfaceCard({
  children,
  style,
  innerStyle,
  padding = spacing.lg,
  borderRadius = radius.card,
  innerBackgroundColor,
  variant = 'card',
}: Props) {
  return (
    <GlassContainer
      style={style}
      innerStyle={innerStyle}
      padding={padding}
      borderRadius={borderRadius}
      innerBackgroundColor={innerBackgroundColor}
      variant={variant}
    >
      {children}
    </GlassContainer>
  );
}

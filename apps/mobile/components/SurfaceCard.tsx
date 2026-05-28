import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { GlassContainer } from '@/components/GlassContainer';
import { radius, spacing } from '@/constants/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  padding?: number;
  innerBackgroundColor?: string;
};

export function SurfaceCard({
  children,
  style,
  innerStyle,
  padding = spacing.lg,
  innerBackgroundColor,
}: Props) {
  return (
    <GlassContainer
      style={style}
      innerStyle={innerStyle}
      padding={padding}
      borderRadius={radius.xxl}
      innerBackgroundColor={innerBackgroundColor}
    >
      {children}
    </GlassContainer>
  );
}

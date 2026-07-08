import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SurfaceCard } from '@/components/SurfaceCard';
import { radius } from '@/constants/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  padding?: number;
  innerBackgroundColor?: string;
  variant?: 'card' | 'flat';
};

/** Dashboard card surface — SurfaceCard with standard radius.card (18px). */
export function DashboardCard({
  children,
  style,
  innerStyle,
  padding,
  innerBackgroundColor,
  variant = 'card',
}: Props) {
  return (
    <SurfaceCard
      style={style}
      innerStyle={innerStyle}
      padding={padding}
      borderRadius={radius.card}
      innerBackgroundColor={innerBackgroundColor}
      variant={variant}
    >
      {children}
    </SurfaceCard>
  );
}

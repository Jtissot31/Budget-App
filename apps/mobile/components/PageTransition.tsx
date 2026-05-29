import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '@/lib/themeContext';

type PageTransitionProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Static flex wrapper — stack navigator handles route transitions; no Reanimated parent on scroll views. */
export function PageTransition({ children, style }: PageTransitionProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, style]} collapsable={false}>
      {children}
    </View>
  );
}

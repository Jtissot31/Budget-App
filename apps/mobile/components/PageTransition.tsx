import type { ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { PAGE_PADDING_HORIZONTAL } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type PageTransitionProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Static flex wrapper — stack navigator handles route transitions.
 * Web: horizontal margin on an inner shell (RN Web ignores scroll contentContainerStyle padding).
 */
export function PageTransition({ children, style }: PageTransitionProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, style]} collapsable={false}>
      {Platform.OS === 'web' ? (
        <View style={{ flex: 1, marginHorizontal: PAGE_PADDING_HORIZONTAL, minWidth: 0 }}>
          {children}
        </View>
      ) : (
        children
      )}
    </View>
  );
}

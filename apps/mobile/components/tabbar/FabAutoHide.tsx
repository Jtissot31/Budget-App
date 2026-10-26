import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useFabScrollVisible } from '@/lib/fabScrollVisibility';

/**
 * Overlay that fades + slides its absolutely-positioned FABs out while the list scrolls down.
 * Fills its parent; pass `style` (e.g. `justifyContent: 'flex-end'`) to keep children where the
 * parent's own flow had put them.
 */
export function FabAutoHide({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const visible = useFabScrollVisible();
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: 180 }),
    transform: [{ translateY: withTiming(visible ? 0 : 24, { duration: 180 }) }],
  }));
  return (
    <Animated.View pointerEvents={visible ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill, style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

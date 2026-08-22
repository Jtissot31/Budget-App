import { type ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { swipeBackExclusionCount } from '@/lib/gestures/swipeBackExclusion';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Wrap horizontal ScrollViews / carousels so a rightward swipe scrolls the
 * child instead of triggering the app-wide swipe-back gesture.
 */
export function SwipeBackExclusion({ children, style }: Props) {
  return (
    <View
      collapsable={false}
      style={style}
      onTouchStart={() => {
        swipeBackExclusionCount.value += 1;
      }}
      onTouchEnd={() => {
        swipeBackExclusionCount.value = Math.max(0, swipeBackExclusionCount.value - 1);
      }}
      onTouchCancel={() => {
        swipeBackExclusionCount.value = Math.max(0, swipeBackExclusionCount.value - 1);
      }}
    >
      {children}
    </View>
  );
}

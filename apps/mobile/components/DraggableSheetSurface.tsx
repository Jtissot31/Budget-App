import { ReactNode, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import {
  useDraggableSheetGesture,
  type SheetSnap,
} from '@/lib/sheet/useDraggableSheetGesture';

type Props = {
  onClose: () => void;
  sheetHeight: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  initialSnap?: SheetSnap;
  /**
   * When true, expects the caller to drive `scrollY` via `scrollHandler`
   * (or keep content non-scrolling). Default false = drag mainly from the grabber zone.
   */
  trackScroll?: boolean;
};

/**
 * Drag chrome for sheets that keep their own Modal / layout / ScrollView.
 * Wrap the sheet panel; keep a grabber in the top ~56px. Drag down collapses/dismisses;
 * drag up expands from the mid detent.
 */
export function DraggableSheetSurface({
  onClose,
  sheetHeight,
  style,
  children,
  initialSnap = 'expanded',
  trackScroll = false,
}: Props) {
  const { panGesture, sheetAnimatedStyle, resetSheetPosition } = useDraggableSheetGesture({
    onClose,
    sheetHeight,
    initialSnap,
    // Without a wired scroll handler, only the handle zone should own vertical drag.
    scrollable: trackScroll,
  });

  useEffect(() => {
    resetSheetPosition(initialSnap);
  }, [initialSnap, resetSheetPosition]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[style, sheetAnimatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}

export { useDraggableSheetGesture };
export type { SheetSnap };

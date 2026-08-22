import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  Dimensions,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import Animated, { type AnimatedScrollViewProps } from 'react-native-reanimated';
import { GestureDetector, type GestureType } from 'react-native-gesture-handler';
import {
  SHEET_HANDLE_DRAG_ZONE_HEIGHT,
  useDraggableSheetGesture,
  type SheetSnap,
} from '@/lib/sheet/useDraggableSheetGesture';
import {
  formSheetKeyboardClampedHeight,
  formSheetPanelStyle,
  useFormSheetHost,
  useFormSheetKeyboardInset,
} from '@/lib/sheet/formSheetScroll';

type ScrollApi = {
  scrollNativeGesture: GestureType;
  scrollHandler: AnimatedScrollViewProps['onScroll'];
  trackScroll: boolean;
};

const DraggableSheetScrollContext = createContext<ScrollApi | null>(null);

type Props = {
  onClose: () => void;
  sheetHeight: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  initialSnap?: SheetSnap;
  /**
   * When true, content can drag-to-dismiss at scroll top (wire via
   * `DraggableSheetScrollView`). Default false = pan only from the grabber
   * zone so form ScrollViews scroll freely on Android.
   */
  trackScroll?: boolean;
  /**
   * When false, do not force `height: sheetHeight` (rare — prefer fixed height
   * so Android ScrollViews get a bounded viewport).
   */
  boundHeight?: boolean;
  /**
   * Animate translateY from off-screen on mount. Default false — form Modals use
   * `animationType="slide"`; a second off-screen translate leaves only the header
   * peeking. Set true only for `animationType="none"` / embedded presenters.
   */
  animateOpen?: boolean;
  /**
   * When false, skip Android keyboard height clamping (rare). Default true —
   * required so flex-end sheets stay on-screen when adjustResize shrinks the root.
   */
  keyboardAware?: boolean;
};

/**
 * Drag chrome for sheets that keep their own Modal / layout / ScrollView.
 * Wrap the sheet panel; keep a grabber in the top ~56px.
 *
 * Forms: leave `trackScroll` false (default) and put content in
 * `DraggableSheetScrollView` (or any ScrollView) — pan won't steal vertical pans.
 *
 * Android keyboard: prefer wrapping the Modal body in `FormSheetModalBody` so we
 * fit the measured host without shrinking chrome by IME inset (`pan` + stable
 * panel height). Clear fields via scroll padding. Never enable KAV padding on
 * Android around this surface — double-shift pushes the sheet off-screen.
 */
export function DraggableSheetSurface({
  onClose,
  sheetHeight,
  style,
  children,
  initialSnap = 'expanded',
  trackScroll = false,
  boundHeight = true,
  animateOpen = false,
  keyboardAware = true,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;
  const keyboardInset = useFormSheetKeyboardInset();
  const host = useFormSheetHost();
  const effectiveSheetHeight = useMemo(() => {
    if (!keyboardAware) return sheetHeight;
    // Prefer host context max when present — already accounts for screen vs window resize.
    if (host && host.maxSheetHeight > 0) {
      return Math.min(sheetHeight, host.maxSheetHeight);
    }
    return formSheetKeyboardClampedHeight(
      sheetHeight,
      host?.windowHeight ?? windowHeight,
      host?.keyboardInset ?? keyboardInset,
      host?.hostHeight,
      screenHeight,
    );
  }, [host, keyboardAware, keyboardInset, screenHeight, sheetHeight, windowHeight]);

  const handleOnly = !trackScroll;
  const { panGesture, scrollNativeGesture, scrollHandler, sheetAnimatedStyle, resetSheetPosition } =
    useDraggableSheetGesture({
      onClose,
      sheetHeight: effectiveSheetHeight,
      initialSnap,
      // trackScroll → pull-to-dismiss at top; otherwise handle-only (forms).
      scrollable: trackScroll,
      handleOnly,
      animateOpen,
      // Forms must not park on a mid detent that hides the body.
      enableCollapsedSnap: trackScroll,
    });

  useEffect(() => {
    resetSheetPosition(initialSnap, { animate: animateOpen });
  }, [animateOpen, initialSnap, resetSheetPosition]);

  const scrollApi: ScrollApi = {
    scrollNativeGesture,
    scrollHandler,
    trackScroll,
  };

  return (
    <DraggableSheetScrollContext.Provider value={scrollApi}>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            boundHeight ? formSheetPanelStyle(effectiveSheetHeight) : styles.unbounded,
            style,
            sheetAnimatedStyle,
          ]}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </DraggableSheetScrollContext.Provider>
  );
}

/**
 * ScrollView coordinated with the parent `DraggableSheetSurface` pan gesture.
 * Always prefer this over RN `ScrollView` inside draggable sheets on Android.
 */
export const DraggableSheetScrollView = forwardRef<Animated.ScrollView, AnimatedScrollViewProps>(
  function DraggableSheetScrollView({ style, contentContainerStyle, onScroll, ...rest }, ref) {
    const api = useContext(DraggableSheetScrollContext);

    const scrollView = (
      <Animated.ScrollView
        ref={ref}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        {...rest}
        style={[styles.scroll, style]}
        contentContainerStyle={contentContainerStyle}
        onScroll={api?.trackScroll ? api.scrollHandler : onScroll}
      />
    );

    if (!api) {
      return scrollView;
    }

    return <GestureDetector gesture={api.scrollNativeGesture}>{scrollView}</GestureDetector>;
  },
);

/** Invisible hit target matching the pan handle zone — optional chrome helper. */
export function DraggableSheetHandleSlot({ children }: { children?: ReactNode }) {
  return <View style={styles.handleSlot}>{children}</View>;
}

export { useDraggableSheetGesture, SHEET_HANDLE_DRAG_ZONE_HEIGHT };
export type { SheetSnap };

const styles = StyleSheet.create({
  unbounded: {
    overflow: 'hidden',
    flexDirection: 'column',
    width: '100%',
    maxHeight: '100%',
    flexGrow: 0,
    flexShrink: 0,
  },
  scroll: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    alignSelf: 'stretch',
  },
  handleSlot: {
    height: SHEET_HANDLE_DRAG_ZONE_HEIGHT,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

export type DraggableSheetScrollViewProps = ComponentProps<typeof DraggableSheetScrollView>;

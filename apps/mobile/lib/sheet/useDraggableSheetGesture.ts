import { useCallback, useMemo, useRef } from 'react';
import {
  Easing,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';

export type SheetSnap = 'expanded' | 'collapsed';

export const SHEET_DISMISS_DRAG_DISTANCE = 96;
export const SHEET_DISMISS_VELOCITY = 650;
export const SHEET_DISMISS_ANIMATION_MS = 240;
export const SHEET_SNAP_ANIMATION_MS = 220;
/** Open settle from off-screen — pairs with Modal `animationType="none"`. */
export const SHEET_OPEN_ANIMATION_MS = 260;
/** Top strip (handle + padding) — always draggable even when nested lists scroll. */
export const SHEET_HANDLE_DRAG_ZONE_HEIGHT = 56;

type Options = {
  onClose: () => void;
  /** Measured / fixed sheet height used for dismiss animation + snap math. */
  sheetHeight: number;
  /**
   * translateY when partially presented. Defaults to ~38% of sheet height
   * so drag-up can re-expand from a mid detent.
   */
  collapsedOffset?: number;
  initialSnap?: SheetSnap;
  /** When true, content drag-to-dismiss only fires if scroll is at top. */
  scrollable?: boolean;
};

/**
 * Shared vertical sheet gesture: drag down to collapse/dismiss, drag up to expand.
 * Pair `panGesture` with `scrollNativeGesture` + `scrollHandler` when the sheet owns a ScrollView.
 */
export function useDraggableSheetGesture({
  onClose,
  sheetHeight,
  collapsedOffset: collapsedOffsetProp,
  initialSnap = 'expanded',
  scrollable = true,
}: Options) {
  const collapsedOffset = Math.max(
    72,
    Math.min(
      collapsedOffsetProp ?? Math.round(sheetHeight * 0.38),
      Math.round(sheetHeight * 0.55),
    ),
  );

  const translateY = useSharedValue(sheetHeight);
  const dragStartY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const isDismissing = useSharedValue(false);
  const closeEmittedRef = useRef(false);

  const resetSheetPosition = useCallback(
    (snap: SheetSnap = initialSnap, options?: { animate?: boolean }) => {
      closeEmittedRef.current = false;
      isDismissing.value = false;
      scrollY.value = 0;
      const target = snap === 'collapsed' ? collapsedOffset : 0;
      if (options?.animate === false) {
        translateY.value = target;
        return;
      }
      // Start fully off-screen, then ease up — fluid sheet open without bounce.
      translateY.value = sheetHeight;
      translateY.value = withTiming(target, {
        duration: SHEET_OPEN_ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
      });
    },
    [collapsedOffset, initialSnap, isDismissing, scrollY, sheetHeight, translateY],
  );

  const requestClose = useCallback(() => {
    if (closeEmittedRef.current) return;
    closeEmittedRef.current = true;
    onClose();
  }, [onClose]);

  const finishDismiss = useCallback(() => {
    requestClose();
  }, [requestClose]);

  const scrollNativeGesture = useMemo(() => Gesture.Native(), []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-6, 6])
        .failOffsetX([-28, 28])
        .simultaneousWithExternalGesture(scrollNativeGesture)
        .onBegin(() => {
          'worklet';
          dragStartY.value = translateY.value;
        })
        .onUpdate((event) => {
          'worklet';
          if (isDismissing.value) return;

          const inHandleZone = event.y <= SHEET_HANDLE_DRAG_ZONE_HEIGHT;
          const atScrollTop = scrollable && scrollY.value <= 0.5;
          const draggingDown = event.translationY > 0;
          const draggingUp = event.translationY < 0;

          // Handle always wins. With tracked scroll: pull-down only at top. Pull-up expands from mid.
          const canDrag =
            inHandleZone ||
            (draggingDown && atScrollTop) ||
            (draggingUp && dragStartY.value > 0);
          if (!canDrag) return;

          const next = dragStartY.value + event.translationY;
          // Rubber-band slightly above expanded, never above -24.
          if (next < 0) {
            translateY.value = next * 0.35;
            return;
          }
          translateY.value = next;
        })
        .onEnd((event) => {
          'worklet';
          if (isDismissing.value) return;

          const inHandleZone = event.y <= SHEET_HANDLE_DRAG_ZONE_HEIGHT;
          const atScrollTop = scrollable && scrollY.value <= 0.5;
          const canSettleFromContent = inHandleZone || atScrollTop || dragStartY.value > 0;

          if (!canSettleFromContent) {
            if (translateY.value < 0) {
              translateY.value = withTiming(0, {
                duration: SHEET_SNAP_ANIMATION_MS,
                easing: Easing.out(Easing.cubic),
              });
            }
            return;
          }

          const projected =
            translateY.value + Math.max(-80, Math.min(event.velocityY * 0.12, 160));
          const dismissByDistance = translateY.value > SHEET_DISMISS_DRAG_DISTANCE + collapsedOffset * 0.35;
          const dismissByVelocity =
            event.velocityY > SHEET_DISMISS_VELOCITY && translateY.value > collapsedOffset * 0.25;
          const pastCollapsedTowardDismiss = projected > collapsedOffset + SHEET_DISMISS_DRAG_DISTANCE * 0.55;

          if (dismissByDistance || dismissByVelocity || pastCollapsedTowardDismiss) {
            isDismissing.value = true;
            translateY.value = withTiming(
              sheetHeight,
              { duration: SHEET_DISMISS_ANIMATION_MS, easing: Easing.out(Easing.cubic) },
              (finished) => {
                if (finished) {
                  runOnJS(finishDismiss)();
                }
              },
            );
            return;
          }

          const mid = collapsedOffset * 0.5;
          const target = projected < mid ? 0 : collapsedOffset;
          translateY.value = withTiming(target, {
            duration: SHEET_SNAP_ANIMATION_MS,
            easing: Easing.out(Easing.cubic),
          });
        }),
    [
      collapsedOffset,
      dragStartY,
      finishDismiss,
      isDismissing,
      scrollNativeGesture,
      scrollY,
      scrollable,
      sheetHeight,
      translateY,
    ],
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(translateY.value, 0) }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.max(translateY.value, 0) / (sheetHeight * 0.45), 1);
    return { opacity: 1 - progress * 0.55 };
  });

  return {
    panGesture,
    scrollNativeGesture,
    scrollHandler,
    sheetAnimatedStyle,
    backdropAnimatedStyle,
    resetSheetPosition,
    requestClose,
    translateY,
    collapsedOffset,
  };
}

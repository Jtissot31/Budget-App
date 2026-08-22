/**
 * Shared vertical sheet gesture + horizontal swipe-right dismiss.
 * Pair `panGesture` with `scrollNativeGesture` + `scrollHandler` when the sheet owns a ScrollView.
 *
 * Pan uses manual activation so it does not win over nested ScrollViews on Android.
 * Horizontal dismiss shares the same `onClose` path as vertical drag-to-dismiss.
 *
 * KEYBOARD / HEIGHT STABILITY — do not regress
 * --------------------------------------------
 * `sheetHeight` often shrinks when the IME opens (Android adjustResize + clamp).
 * Callers wire `useEffect(() => resetSheetPosition(...), [resetSheetPosition])`.
 * If `resetSheetPosition` identity depends on `sheetHeight`, the open animation
 * re-fires (translateY → off-screen → up) and the form vanishes behind the keyboard.
 * Keep height in shared values; only recreate `resetSheetPosition` when open
 * policy (`animateOpen` / `initialSnap`) changes.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions } from 'react-native';
import {
  Easing,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import {
  resolveSwipeBackDecision,
  shouldCommitSwipeBack,
} from '@/lib/gestures/swipeBackDecision';
import { isSwipeBackExcluded } from '@/lib/gestures/swipeBackExclusion';

export type SheetSnap = 'expanded' | 'collapsed';

export const SHEET_DISMISS_DRAG_DISTANCE = 96;
export const SHEET_DISMISS_VELOCITY = 650;
export const SHEET_DISMISS_ANIMATION_MS = 240;
export const SHEET_SNAP_ANIMATION_MS = 220;
/** Open settle from off-screen — pairs with Modal `animationType="none"`. */
export const SHEET_OPEN_ANIMATION_MS = 260;
/** Top strip (handle + padding) — always draggable even when nested lists scroll. */
export const SHEET_HANDLE_DRAG_ZONE_HEIGHT = 56;
/** Vertical movement before deciding pan vs scroll (px). */
const SHEET_PAN_ACTIVATION_DISTANCE = 6;
const SHEET_HORIZONTAL_EXIT_MS = 200;

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
  /**
   * When true, content drag-to-dismiss only fires if scroll is at top
   * (requires wiring `scrollHandler` + `scrollNativeGesture` on the ScrollView).
   */
  scrollable?: boolean;
  /**
   * When true, vertical pan only activates from the top handle strip.
   * Use for form sheets that own their own ScrollView — prevents RNGH Pan from
   * stealing Android scroll touches across the whole sheet.
   */
  handleOnly?: boolean;
  /**
   * When true (default), open by animating translateY from off-screen.
   * Pair with Modal `animationType="none"` / embedded routes.
   * When false, sit at the snap immediately — required for Modal `animationType="slide"`
   * forms (otherwise the sheet stays translated off-screen and only the header peeks).
   */
  animateOpen?: boolean;
  /**
   * When false, drag settles only to fully expanded or dismiss — no mid detent.
   * Default false for handle-only form sheets; true when a collapsed snap is useful.
   */
  enableCollapsedSnap?: boolean;
  /** When false, disable rightward swipe-to-dismiss (rare). Default true. */
  enableHorizontalDismiss?: boolean;
};

export function useDraggableSheetGesture({
  onClose,
  sheetHeight,
  collapsedOffset: collapsedOffsetProp,
  initialSnap = 'expanded',
  scrollable = true,
  handleOnly = false,
  animateOpen = true,
  enableCollapsedSnap = !handleOnly,
  enableHorizontalDismiss = true,
}: Options) {
  const collapsedOffset = Math.max(
    72,
    Math.min(
      collapsedOffsetProp ?? Math.round(sheetHeight * 0.38),
      Math.round(sheetHeight * 0.55),
    ),
  );

  const initialTranslate =
    initialSnap === 'collapsed' ? collapsedOffset : animateOpen ? sheetHeight : 0;

  const translateY = useSharedValue(initialTranslate);
  const translateX = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchAbsStartX = useSharedValue(0);
  const touchAbsStartY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const isDismissing = useSharedValue(false);
  const screenWidth = useSharedValue(Dimensions.get('window').width);
  /** Live sheet metrics for worklets — updated without recreating reset callbacks. */
  const sheetHeightSV = useSharedValue(sheetHeight);
  const collapsedOffsetSV = useSharedValue(collapsedOffset);
  const closeEmittedRef = useRef(false);

  useEffect(() => {
    sheetHeightSV.value = sheetHeight;
  }, [sheetHeight, sheetHeightSV]);

  useEffect(() => {
    collapsedOffsetSV.value = collapsedOffset;
  }, [collapsedOffset, collapsedOffsetSV]);

  const resetSheetPosition = useCallback(
    (snap: SheetSnap = initialSnap, options?: { animate?: boolean }) => {
      closeEmittedRef.current = false;
      isDismissing.value = false;
      scrollY.value = 0;
      translateX.value = 0;
      const target = snap === 'collapsed' ? collapsedOffsetSV.value : 0;
      const shouldAnimate = options?.animate ?? animateOpen;
      if (!shouldAnimate) {
        translateY.value = target;
        return;
      }
      // Start fully off-screen, then ease up — fluid sheet open without bounce.
      translateY.value = sheetHeightSV.value;
      translateY.value = withTiming(target, {
        duration: SHEET_OPEN_ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
      });
    },
    [
      animateOpen,
      collapsedOffsetSV,
      initialSnap,
      isDismissing,
      scrollY,
      sheetHeightSV,
      translateX,
      translateY,
    ],
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

  const verticalPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .failOffsetX([-28, 28])
        .simultaneousWithExternalGesture(scrollNativeGesture)
        .onTouchesDown((event) => {
          'worklet';
          touchStartY.value = event.allTouches[0]?.y ?? 0;
          touchStartX.value = event.allTouches[0]?.x ?? 0;
        })
        .onTouchesMove((event, state) => {
          'worklet';
          const touch = event.allTouches[0];
          if (!touch) return;

          const dy = touch.y - touchStartY.value;
          const dx = touch.x - touchStartX.value;

          // Yield to horizontal swipe-back when it clearly dominates.
          if (enableHorizontalDismiss && resolveSwipeBackDecision(dx, dy) === 'activate') {
            state.fail();
            return;
          }

          if (Math.abs(dy) < SHEET_PAN_ACTIVATION_DISTANCE) return;

          const inHandleZone = touchStartY.value <= SHEET_HANDLE_DRAG_ZONE_HEIGHT;

          // Form sheets: never compete with ScrollView outside the grabber.
          if (handleOnly) {
            if (inHandleZone) {
              state.activate();
            } else {
              state.fail();
            }
            return;
          }

          if (!scrollable) {
            if (inHandleZone) {
              state.activate();
            } else {
              state.fail();
            }
            return;
          }

          const atScrollTop = scrollY.value <= 0.5;
          const draggingDown = dy > 0;
          const draggingUp = dy < 0;
          const canActivate =
            inHandleZone ||
            (draggingDown && atScrollTop) ||
            (draggingUp && translateY.value > 0);

          if (canActivate) {
            state.activate();
          } else {
            // Let the nested Native / ScrollView own the vertical pan.
            state.fail();
          }
        })
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

          // handleOnly: activation already restricted to the grabber — track the whole gesture.
          const canDrag =
            handleOnly ||
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
          const canSettleFromContent =
            inHandleZone || handleOnly || atScrollTop || dragStartY.value > 0;

          if (!canSettleFromContent) {
            if (translateY.value < 0) {
              translateY.value = withTiming(0, {
                duration: SHEET_SNAP_ANIMATION_MS,
                easing: Easing.out(Easing.cubic),
              });
            }
            return;
          }

          const height = sheetHeightSV.value;
          const collapsed = collapsedOffsetSV.value;
          const projected =
            translateY.value + Math.max(-80, Math.min(event.velocityY * 0.12, 160));
          const dismissByDistance = translateY.value > SHEET_DISMISS_DRAG_DISTANCE + collapsed * 0.35;
          const dismissByVelocity =
            event.velocityY > SHEET_DISMISS_VELOCITY && translateY.value > collapsed * 0.25;
          const pastCollapsedTowardDismiss = projected > collapsed + SHEET_DISMISS_DRAG_DISTANCE * 0.55;

          // Form sheets: dismiss or fully expand — never park on a mid detent that hides the body.
          if (!enableCollapsedSnap) {
            const shouldDismiss =
              translateY.value > SHEET_DISMISS_DRAG_DISTANCE ||
              (event.velocityY > SHEET_DISMISS_VELOCITY && translateY.value > 40);
            if (shouldDismiss) {
              isDismissing.value = true;
              translateY.value = withTiming(
                height,
                { duration: SHEET_DISMISS_ANIMATION_MS, easing: Easing.out(Easing.cubic) },
                (finished) => {
                  if (finished) {
                    runOnJS(finishDismiss)();
                  }
                },
              );
              return;
            }
            translateY.value = withTiming(0, {
              duration: SHEET_SNAP_ANIMATION_MS,
              easing: Easing.out(Easing.cubic),
            });
            return;
          }

          if (dismissByDistance || dismissByVelocity || pastCollapsedTowardDismiss) {
            isDismissing.value = true;
            translateY.value = withTiming(
              height,
              { duration: SHEET_DISMISS_ANIMATION_MS, easing: Easing.out(Easing.cubic) },
              (finished) => {
                if (finished) {
                  runOnJS(finishDismiss)();
                }
              },
            );
            return;
          }

          const mid = collapsed * 0.5;
          const target = projected < mid ? 0 : collapsed;
          translateY.value = withTiming(target, {
            duration: SHEET_SNAP_ANIMATION_MS,
            easing: Easing.out(Easing.cubic),
          });
        }),
    [
      collapsedOffsetSV,
      dragStartY,
      enableCollapsedSnap,
      enableHorizontalDismiss,
      finishDismiss,
      handleOnly,
      isDismissing,
      scrollNativeGesture,
      scrollY,
      scrollable,
      sheetHeightSV,
      touchStartX,
      touchStartY,
      translateY,
    ],
  );

  const horizontalPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enableHorizontalDismiss)
        .manualActivation(true)
        .onTouchesDown((event) => {
          'worklet';
          const touch = event.allTouches[0];
          touchAbsStartX.value = touch?.absoluteX ?? 0;
          touchAbsStartY.value = touch?.absoluteY ?? 0;
        })
        .onTouchesMove((event, state) => {
          'worklet';
          if (isDismissing.value || isSwipeBackExcluded()) {
            state.fail();
            return;
          }
          const touch = event.allTouches[0];
          if (!touch) return;
          const dx = touch.absoluteX - touchAbsStartX.value;
          const dy = touch.absoluteY - touchAbsStartY.value;
          const decision = resolveSwipeBackDecision(dx, dy);
          if (decision === 'activate') {
            state.activate();
          } else if (decision === 'reject') {
            state.fail();
          }
        })
        .onUpdate((event) => {
          'worklet';
          if (isDismissing.value) return;
          translateX.value = Math.max(0, event.translationX);
        })
        .onEnd((event) => {
          'worklet';
          if (isDismissing.value) return;
          const dx = Math.max(0, event.translationX);
          if (shouldCommitSwipeBack(dx, event.velocityX)) {
            isDismissing.value = true;
            translateX.value = withTiming(
              screenWidth.value,
              { duration: SHEET_HORIZONTAL_EXIT_MS, easing: Easing.out(Easing.cubic) },
              (finished) => {
                if (finished) {
                  runOnJS(finishDismiss)();
                } else {
                  isDismissing.value = false;
                  translateX.value = 0;
                }
              },
            );
            return;
          }
          translateX.value = withTiming(0, {
            duration: SHEET_SNAP_ANIMATION_MS,
            easing: Easing.out(Easing.cubic),
          });
        })
        .onFinalize((_, success) => {
          'worklet';
          if (!success && !isDismissing.value) {
            translateX.value = withTiming(0, {
              duration: SHEET_SNAP_ANIMATION_MS,
              easing: Easing.out(Easing.cubic),
            });
          }
        }),
    [
      enableHorizontalDismiss,
      finishDismiss,
      isDismissing,
      screenWidth,
      touchAbsStartX,
      touchAbsStartY,
      translateX,
    ],
  );

  const panGesture = useMemo(
    () =>
      enableHorizontalDismiss
        ? Gesture.Race(horizontalPanGesture, verticalPanGesture)
        : verticalPanGesture,
    [enableHorizontalDismiss, horizontalPanGesture, verticalPanGesture],
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: Math.max(translateY.value, 0) },
    ],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    const height = Math.max(sheetHeightSV.value, 1);
    const progressY = Math.min(Math.max(translateY.value, 0) / (height * 0.45), 1);
    const progressX = Math.min(Math.max(translateX.value, 0) / (screenWidth.value * 0.45), 1);
    const progress = Math.max(progressY, progressX);
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
    translateX,
    collapsedOffset,
  };
}

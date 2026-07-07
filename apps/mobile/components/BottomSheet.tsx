import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  StyleProp,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { radius, spacing, typography, type AppColors } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Inline control shown at the trailing edge of the title row (ex. pencil). */
  titleAccessory?: ReactNode;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  /** Merged after default scroll `content` padding (e.g. tighter gutters, safe-area-aware). */
  scrollContentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * When false, children render in a flex column inside the sheet instead of `ScrollView`
   * (use for nested `FlatList` / virtualization).
   */
  scrollable?: boolean;
};

const DISMISS_DRAG_DISTANCE = 96;
const DISMISS_VELOCITY = 650;
const DISMISS_ANIMATION_MS = 240;
const SPRING_BACK_MS = 200;
/** Top strip (handle + padding) — always draggable even when nested lists scroll. */
const HANDLE_DRAG_ZONE_HEIGHT = 56;

export function BottomSheet({
  visible,
  onClose,
  title,
  titleAccessory,
  children,
  sheetStyle,
  scrollContentContainerStyle,
  scrollable = true,
}: Props) {
  const { colors } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);

  /** Fixed viewport share so flex + `FlatList` layouts measure reliably outside `ScrollView`. */
  const sheetFixedHeight = Math.min(windowHeight * 0.88, windowHeight);

  const translateY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const isDismissing = useSharedValue(false);
  const closeEmittedRef = useRef(false);
  const wasVisibleRef = useRef(false);

  const resetSheetPosition = useCallback(() => {
    translateY.value = 0;
    scrollY.value = 0;
    isDismissing.value = false;
  }, [isDismissing, scrollY, translateY]);

  const requestClose = useCallback(() => {
    if (closeEmittedRef.current) return;
    closeEmittedRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      closeEmittedRef.current = false;
      resetSheetPosition();
    }
    wasVisibleRef.current = visible;
  }, [visible, resetSheetPosition]);

  const finishDismiss = useCallback(() => {
    requestClose();
  }, [requestClose]);

  const scrollNativeGesture = useMemo(() => Gesture.Native(), []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(6)
        .failOffsetX([-28, 28])
        .simultaneousWithExternalGesture(scrollNativeGesture)
        .onUpdate((event) => {
          'worklet';
          if (isDismissing.value) return;

          const inHandleZone = event.y <= HANDLE_DRAG_ZONE_HEIGHT;
          const canDrag =
            inHandleZone || (scrollable && scrollY.value <= 0.5);
          if (canDrag && event.translationY > 0) {
            translateY.value = event.translationY;
          }
        })
        .onEnd((event) => {
          'worklet';
          if (isDismissing.value) return;

          const inHandleZone = event.y <= HANDLE_DRAG_ZONE_HEIGHT;
          const canDismiss =
            inHandleZone || (scrollable && scrollY.value <= 0.5);
          const shouldDismiss =
            canDismiss &&
            (event.translationY > DISMISS_DRAG_DISTANCE || event.velocityY > DISMISS_VELOCITY);

          if (shouldDismiss) {
            isDismissing.value = true;
            translateY.value = withTiming(
              sheetFixedHeight,
              { duration: DISMISS_ANIMATION_MS, easing: Easing.out(Easing.cubic) },
              (finished) => {
                if (finished) {
                  runOnJS(finishDismiss)();
                }
              },
            );
            return;
          }

          if (translateY.value > 0) {
            translateY.value = withTiming(0, {
              duration: SPRING_BACK_MS,
              easing: Easing.out(Easing.cubic),
            });
          }
        }),
    [finishDismiss, isDismissing, scrollNativeGesture, scrollY, scrollable, sheetFixedHeight, translateY],
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(translateY.value / (sheetFixedHeight * 0.45), 1);
    return { opacity: 1 - progress * 0.55 };
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={requestClose}>
      <GestureHandlerRootView style={styles.modalRoot}>
        <View style={styles.overlay}>
          <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Fermer" />
          </Animated.View>

          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.sheet,
                !scrollable && { height: sheetFixedHeight },
                sheetStyle,
                sheetAnimatedStyle,
              ]}
            >
              <View style={styles.handleHitArea}>
                <View style={styles.handle} />
              </View>
              {title ? (
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={2}>
                    {title}
                  </Text>
                  {titleAccessory}
                </View>
              ) : null}
              {scrollable ? (
                <GestureDetector gesture={scrollNativeGesture}>
                  <Animated.ScrollView
                    style={styles.scroll}
                    contentContainerStyle={[styles.content, scrollContentContainerStyle]}
                    showsVerticalScrollIndicator={false}
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                    bounces
                  >
                    {children}
                  </Animated.ScrollView>
                </GestureDetector>
              ) : (
                <View style={[styles.nonScrollBody, scrollContentContainerStyle]}>
                  {children}
                </View>
              )}
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    modalRoot: {
      flex: 1,
    },
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'transparent',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      maxHeight: '88%',
      backgroundColor: colors.containerBackground,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      borderTopWidth: 1,
      borderColor: colors.containerBorder,
      paddingBottom: spacing.xl,
      overflow: 'hidden',
    },
    handleHitArea: {
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      height: HANDLE_DRAG_ZONE_HEIGHT,
      marginTop: 0,
      marginBottom: 0,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      marginTop: -spacing.sm,
    },
    title: {
      flex: 1,
      minWidth: 0,
      color: colors.text,
      fontSize: typography.dashboardGreeting,
      fontWeight: '700',
    },
    scroll: { maxHeight: '100%' },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    nonScrollBody: { flex: 1, minHeight: 0 },
  });
}

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  StyleProp,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typography, type AppColors } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import {
  FORM_SHEET_HANDLE_HIT_HEIGHT,
  formSheetKeyboardClampedHeight,
  useFormSheetKeyboardInset,
  useFormSheetScrollToTop,
} from '@/lib/sheet/formSheetScroll';
import {
  SHEET_SNAP_ANIMATION_MS,
  useDraggableSheetGesture,
  type SheetSnap,
} from '@/lib/sheet/useDraggableSheetGesture';

type SharedProps = {
  onClose: () => void;
  title?: string;
  /** Inline control shown at the trailing edge of the title row (ex. pencil). */
  titleAccessory?: ReactNode;
  /**
   * Sticky chrome above the scroll body (icon + title + actions).
   * Stays visible while content scrolls — avoids Android clip when returning to top.
   */
  header?: ReactNode;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  /** Merged after default scroll `content` padding (e.g. tighter gutters, safe-area-aware). */
  scrollContentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * When false, children render in a flex column inside the sheet instead of `ScrollView`
   * (use for nested `FlatList` / virtualization).
   */
  scrollable?: boolean;
  /** Start mid-height (`collapsed`) or full (`expanded`). Default expanded. */
  initialSnap?: SheetSnap;
  /**
   * Share of the window height occupied by the sheet. Default `0.88`.
   * Use a small ratio for compact sheets (ex. `1 / 3` for la dictée vocale) — below 0.5
   * the mid detent is disabled so a drag down dismisses instead of half-hiding the body.
   */
  heightRatio?: number;
  /** Optional custom handle node; default pill grabber. */
  handle?: ReactNode;
  /** Hide built-in title row when the caller renders its own header. */
  hideTitleRow?: boolean;
};

type ModalProps = SharedProps & {
  visible: boolean;
  /** When true, skip RN Modal (caller is already a transparent route / outer Modal). */
  embedded?: false;
};

type EmbeddedProps = SharedProps & {
  visible?: boolean;
  embedded: true;
};

export type BottomSheetProps = ModalProps | EmbeddedProps;

/**
 * Unified bottom sheet chrome: grabber + vertical drag (up = expand, down = collapse/dismiss).
 * Use `embedded` for transparentModal routes (e.g. add-transaction) that already own the backdrop.
 *
 * Android edge-to-edge: Modal uses `statusBarTranslucent` + `navigationBarTranslucent` so the
 * sheet surface paints under the system nav bar (no underlying screen peek-through).
 * Default `paddingBottom` includes `insets.bottom` inside the sheet so the same
 * `colors.background` fill covers the nav while content stays above it.
 */
export function BottomSheet(props: BottomSheetProps) {
  const {
    onClose,
    title,
    titleAccessory,
    header,
    children,
    sheetStyle,
    scrollContentContainerStyle,
    scrollable = true,
    initialSnap = 'expanded',
    heightRatio = 0.88,
    handle,
    hideTitleRow = false,
  } = props;
  const visible = props.embedded ? true : props.visible;
  const embedded = props.embedded === true;

  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;
  const keyboardInset = useFormSheetKeyboardInset();
  const styles = useMemo(() => createStyles(colors), [colors]);

  /** Fixed viewport share so flex + `FlatList` layouts measure reliably outside `ScrollView`. */
  const sheetFixedHeight = formSheetKeyboardClampedHeight(
    Math.round(Math.min(windowHeight * heightRatio, windowHeight)),
    windowHeight,
    keyboardInset,
    undefined,
    screenHeight,
  );
  const compact = heightRatio < 0.5;
  const bottomInset = Math.max(0, insets.bottom);
  const wasVisibleRef = useRef(false);
  const scrollRef = useRef<Animated.ScrollView>(null);
  // Sheets stay mounted between opens — always reopen at the top of the content.
  useFormSheetScrollToTop(scrollRef, Boolean(visible));
  /** Skip mounting heavy body while closed; keep briefly on dismiss for gesture finish. */
  const [bodyMounted, setBodyMounted] = useState(embedded || Boolean(visible));
  if (!embedded && visible && !bodyMounted) {
    setBodyMounted(true);
  }
  const sheetChildren = embedded || bodyMounted ? children : null;

  /** Animate height when `heightRatio` changes mid-open (ex. voice dictée → récap). */
  const animatedHeight = useSharedValue(sheetFixedHeight);
  useEffect(() => {
    animatedHeight.value = withTiming(sheetFixedHeight, {
      duration: SHEET_SNAP_ANIMATION_MS,
    });
  }, [animatedHeight, sheetFixedHeight]);

  const heightAnimatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
    maxHeight: animatedHeight.value,
  }));

  const {
    panGesture,
    scrollNativeGesture,
    scrollHandler,
    sheetAnimatedStyle,
    backdropAnimatedStyle,
    resetSheetPosition,
    requestClose,
  } = useDraggableSheetGesture({
    onClose,
    sheetHeight: sheetFixedHeight,
    initialSnap,
    scrollable,
    enableCollapsedSnap: !compact,
  });

  useEffect(() => {
    if (embedded) {
      resetSheetPosition(initialSnap);
      return;
    }
    if (visible && !wasVisibleRef.current) {
      resetSheetPosition(initialSnap);
    }
    wasVisibleRef.current = visible;
    if (!visible) {
      const timer = setTimeout(() => setBodyMounted(false), 280);
      return () => clearTimeout(timer);
    }
  }, [embedded, initialSnap, resetSheetPosition, visible]);

  const sheetBody = (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.sheet,
          // Inset pads *inside* the opaque sheet so background still covers the nav bar.
          // Callers may override via `sheetStyle` (ex. voice sheet → 0 + content padding).
          { paddingBottom: spacing.xl + bottomInset },
          heightAnimatedStyle,
          sheetStyle,
          sheetAnimatedStyle,
        ]}
      >
        <View style={styles.handleHitArea}>
          {handle ?? <View style={styles.handle} />}
        </View>
        {title && !hideTitleRow ? (
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            {titleAccessory}
          </View>
        ) : null}
        {header ? <View style={styles.headerSlot}>{header}</View> : null}
        {scrollable ? (
          <GestureDetector gesture={scrollNativeGesture}>
            <Animated.ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={[styles.content, scrollContentContainerStyle]}
              showsVerticalScrollIndicator={false}
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              bounces
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              contentInsetAdjustmentBehavior="never"
            >
              {sheetChildren}
            </Animated.ScrollView>
          </GestureDetector>
        ) : (
          <View style={[styles.nonScrollBody, scrollContentContainerStyle]}>{sheetChildren}</View>
        )}
      </Animated.View>
    </GestureDetector>
  );

  if (embedded) {
    return (
      <GestureHandlerRootView style={styles.modalRoot}>
        <View style={styles.overlay}>
          <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Fermer" />
          </Animated.View>
          {sheetBody}
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      // Android edge-to-edge: Dialog window must draw under system bars or the Activity
      // (Transactions list) peeks through the 3-button nav bar under a transparent Modal.
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={requestClose}
    >
      <GestureHandlerRootView style={styles.modalRoot}>
        <View style={styles.overlay}>
          <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Fermer" />
          </Animated.View>
          {sheetBody}
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
      // Opaque canvas — containerBackground is glass (Budget Proto); sheets must not show through.
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      borderTopWidth: 1,
      borderColor: colors.containerBorder,
      overflow: 'hidden',
    },
    handleHitArea: {
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      // Visual chrome only — gesture zone remains SHEET_HANDLE_DRAG_ZONE_HEIGHT (56) in useDraggableSheetGesture.
      height: FORM_SHEET_HANDLE_HIT_HEIGHT,
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
    headerSlot: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    // flexShrink + minHeight:0 — Android maxHeight% alone lets content expand and clip the top.
    scroll: {
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
    },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    nonScrollBody: { flex: 1, minHeight: 0 },
  });
}

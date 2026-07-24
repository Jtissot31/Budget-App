import { ReactNode, useEffect, useMemo, useRef } from 'react';
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
import Animated from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { radius, spacing, typography, type AppColors } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import {
  SHEET_HANDLE_DRAG_ZONE_HEIGHT,
  useDraggableSheetGesture,
  type SheetSnap,
} from '@/lib/sheet/useDraggableSheetGesture';

type SharedProps = {
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
  /** Start mid-height (`collapsed`) or full (`expanded`). Default expanded. */
  initialSnap?: SheetSnap;
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
 */
export function BottomSheet(props: BottomSheetProps) {
  const {
    onClose,
    title,
    titleAccessory,
    children,
    sheetStyle,
    scrollContentContainerStyle,
    scrollable = true,
    initialSnap = 'expanded',
    handle,
    hideTitleRow = false,
  } = props;
  const visible = props.embedded ? true : props.visible;
  const embedded = props.embedded === true;

  const { colors } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);

  /** Fixed viewport share so flex + `FlatList` layouts measure reliably outside `ScrollView`. */
  const sheetFixedHeight = Math.min(windowHeight * 0.88, windowHeight);
  const wasVisibleRef = useRef(false);

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
  }, [embedded, initialSnap, resetSheetPosition, visible]);

  const sheetBody = (
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
        {scrollable ? (
          <GestureDetector gesture={scrollNativeGesture}>
            <Animated.ScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.content, scrollContentContainerStyle]}
              showsVerticalScrollIndicator={false}
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              bounces
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </Animated.ScrollView>
          </GestureDetector>
        ) : (
          <View style={[styles.nonScrollBody, scrollContentContainerStyle]}>{children}</View>
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
    <Modal visible={visible} animationType="none" transparent onRequestClose={requestClose}>
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
      height: SHEET_HANDLE_DRAG_ZONE_HEIGHT,
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

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  FORM_SHEET_TOP_MARGIN,
  clampFormSheetKeyboardInset,
  formSheetMaxHeight,
} from '@/lib/sheet/formSheetKeyboardMath';
import { FORM_SHEET_CHROME_HEIGHT } from '@/lib/sheet/formSheetChrome';

export {
  FORM_SHEET_HOST_RESIZE_EPSILON,
  FORM_SHEET_MIN_VISIBLE_HEIGHT,
  FORM_SHEET_STABLE_ANDROID_PANEL_HEIGHT,
  FORM_SHEET_TOP_MARGIN,
  clampFormSheetKeyboardInset,
  formSheetDragHeight,
  formSheetHostAlreadyResized,
  formSheetKeyboardClampedHeight,
  formSheetMaxHeight,
} from '@/lib/sheet/formSheetKeyboardMath';

export {
  FORM_SHEET_CHROME_HEIGHT,
  FORM_SHEET_CONTENT_PADDING_TOP,
  FORM_SHEET_HANDLE_HIT_HEIGHT,
  FormSheetChromeHeader,
  formSheetChromeStyles,
  formSheetCloseButtonStyle,
  formSheetContentPaddingTopStyle,
  formSheetHandleHitStyle,
  formSheetHandlePillStyle,
  formSheetHeaderRowStyle,
  formSheetTitleStyle,
} from '@/lib/sheet/formSheetChrome';

/** Extra inset so sticky save / last chips clear the sheet edge + home indicator. */
export const FORM_SHEET_SCROLL_BOTTOM_EXTRA = 160;

type FormSheetHostValue = {
  hostHeight: number;
  windowHeight: number;
  keyboardInset: number;
  maxSheetHeight: number;
};

const FormSheetHostContext = createContext<FormSheetHostValue | null>(null);

export type { FormSheetHostValue };

export function useFormSheetHost(): FormSheetHostValue | null {
  return useContext(FormSheetHostContext);
}

/**
 * Bottom padding for add-form sheet ScrollViews.
 * Safe-area alone (~20–34) is not enough — Android APK clips the last options.
 *
 * Pass `keyboardInset` on Android so fields clear the IME **without** shrinking
 * the sheet panel (`FORM_SHEET_STABLE_ANDROID_PANEL_HEIGHT`).
 */
export function formSheetScrollPaddingBottom(
  safeBottom: number,
  keyboardInset = 0,
  windowHeight?: number,
): number {
  const edge = Math.max(safeBottom, 20);
  const base = edge + FORM_SHEET_SCROLL_BOTTOM_EXTRA;
  const inset =
    typeof windowHeight === 'number' && windowHeight > 0
      ? clampFormSheetKeyboardInset(keyboardInset, windowHeight)
      : Math.max(0, keyboardInset);
  if (!(inset > 0)) return base;
  // Stable panel: keyboard overlays the sheet — pad enough to scroll above IME.
  return Math.max(base, edge + inset + 12);
}

/**
 * ScrollView style inside a fixed-height sheet column.
 *
 * Prefer a parent with `height: sheetHeight` + column flex, then this `flex:1`
 * viewport. Avoid sizing the ScrollView to its content (Android then clips
 * instead of scrolling).
 */
export function formSheetScrollViewStyle(
  _sheetHeight?: number,
  _chromeHeight: number = FORM_SHEET_CHROME_HEIGHT,
): ViewStyle {
  return {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    alignSelf: 'stretch',
  };
}

/**
 * contentContainerStyle for form sheets.
 * Do NOT use flexGrow:1 — on Android it can make the ScrollView believe
 * content fits the viewport and disable scrolling when nested under gestures.
 */
export const formSheetScrollContentStyle: ViewStyle = {
  flexGrow: 0,
};

/**
 * Keyboard height for Android sheet clamping.
 *
 * Prefer `screenY` over `height` on edge-to-edge: the keyboard frame height can
 * disagree with how much of the window is actually covered.
 * iOS returns 0 — `FormSheetModalBody` / KAV padding already handles it.
 */
export function useFormSheetKeyboardInset(): number {
  const { height: windowHeight } = useWindowDimensions();
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const syncInset = (event: { endCoordinates?: { height?: number; screenY?: number } }) => {
      const coords = event.endCoordinates;
      if (!coords) {
        setInset(0);
        return;
      }
      const fromScreenY =
        typeof coords.screenY === 'number' ? Math.max(0, windowHeight - coords.screenY) : 0;
      const fromHeight = typeof coords.height === 'number' ? Math.max(0, coords.height) : 0;
      // Prefer the larger signal so under-counting does not leave the sheet too tall.
      // `formSheetMaxHeight` / `clampFormSheetKeyboardInset` cap over-counting.
      setInset(Math.max(fromScreenY, fromHeight));
    };

    const showSub = Keyboard.addListener('keyboardDidShow', syncInset);
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setInset(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [windowHeight]);

  return inset;
}

/**
 * ScrollView bottom padding using host / keyboard inset from context.
 * Prefer this inside `FormSheetModalBody` trees.
 */
export function useFormSheetScrollPaddingBottom(safeBottom: number): number {
  const { height: windowHeight } = useWindowDimensions();
  const host = useFormSheetHost();
  const fallbackInset = useFormSheetKeyboardInset();
  return formSheetScrollPaddingBottom(
    safeBottom,
    host?.keyboardInset ?? fallbackInset,
    host?.windowHeight ?? windowHeight,
  );
}

/**
 * Desired sheet height (ratio of window). Keyboard clamping happens in
 * `DraggableSheetSurface` / `BottomSheet` / `formSheetDragHeight` — keep a single
 * clamp path so inset is never applied twice with divergent host metrics.
 */
export function useFormSheetHeight(ratio = 0.92): number {
  const { height: windowHeight } = useWindowDimensions();
  return useMemo(() => {
    return Math.min(
      Math.round(windowHeight * ratio),
      Math.max(windowHeight - FORM_SHEET_TOP_MARGIN, 1),
    );
  }, [ratio, windowHeight]);
}

type FormSheetModalBodyProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Optional sync for transparentModal routes that size the sheet outside context. */
  onHostMetrics?: (metrics: FormSheetHostValue) => void;
};

/**
 * Flex-end host for Modal / transparentModal form sheets.
 *
 * - Measures itself (`onLayout`) so leftover `adjustResize` is respected
 * - Exposes max sheet height via context to `DraggableSheetSurface`
 * - Stable Android panel height — keyboard → scroll padding, not chrome shrink
 * - Enables `KeyboardAvoidingView` on **iOS only**
 *
 * Header chrome: use `FormSheetChromeHeader` (`formSheetChrome.ts`).
 */
export function FormSheetModalBody({ children, style, onHostMetrics }: FormSheetModalBodyProps) {
  const { height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;
  const keyboardInset = useFormSheetKeyboardInset();
  const [hostHeight, setHostHeight] = useState(windowHeight);

  useEffect(() => {
    // Window rotation / split-screen: keep host in sync before the next layout.
    setHostHeight((prev) => (prev > 0 ? prev : windowHeight));
  }, [windowHeight]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next > 0) setHostHeight(next);
  };

  const value = useMemo<FormSheetHostValue>(() => {
    const maxSheetHeight = formSheetMaxHeight({
      windowHeight,
      hostHeight,
      keyboardInset,
      screenHeight,
    });
    return { hostHeight, windowHeight, keyboardInset, maxSheetHeight };
  }, [hostHeight, keyboardInset, screenHeight, windowHeight]);

  useEffect(() => {
    onHostMetrics?.(value);
  }, [onHostMetrics, value]);

  const body = createElement(
    View,
    { style: [formSheetModalBodyStyles.host, style], onLayout },
    createElement(FormSheetHostContext.Provider, { value }, children),
  );

  if (Platform.OS === 'ios') {
    return createElement(
      KeyboardAvoidingView,
      { behavior: 'padding', style: formSheetModalBodyStyles.host },
      body,
    );
  }

  // Android: never wrap in KeyboardAvoidingView — see ANDROID FORM-SHEET KEYBOARD RULE.
  return body;
}

const formSheetModalBodyStyles = {
  host: {
    flex: 1,
    justifyContent: 'flex-end',
  } satisfies ViewStyle,
};

/** Minimal surface of `ScrollView` / `Animated.ScrollView` needed to reset the offset. */
export type FormSheetScrollTarget = {
  scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => void;
};

export function scrollFormSheetToTop(ref: RefObject<FormSheetScrollTarget | null>): void {
  ref.current?.scrollTo({ y: 0, animated: false });
}

/**
 * Pins a form sheet ScrollView to the top of its content every time it opens.
 *
 * Two offsets have to be undone: a sheet kept mounted across opens retains its
 * previous scroll offset, and Android scrolls to the focused input when the
 * keyboard resizes the window. The retries cover layout that settles a few frames
 * after `open` flips.
 */
export function useFormSheetScrollToTop<T extends FormSheetScrollTarget>(
  ref: RefObject<T | null>,
  open: boolean,
): void {
  useEffect(() => {
    if (!open) return;

    scrollFormSheetToTop(ref);
    const frame = requestAnimationFrame(() => scrollFormSheetToTop(ref));
    const timers = [120, 320].map((delay) =>
      setTimeout(() => scrollFormSheetToTop(ref), delay),
    );

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, [open, ref]);
}

/**
 * Sheet panel shell: fixed height so children ScrollViews get a bounded viewport.
 *
 * `maxHeight: '100%'` is a safety net when Android resizes the parent before the
 * keyboard inset listener fires — the panel must not outgrow a flex-end host.
 */
export function formSheetPanelStyle(sheetHeight: number): ViewStyle {
  return {
    height: sheetHeight,
    maxHeight: '100%',
    width: '100%',
    overflow: 'hidden',
    flexDirection: 'column',
    // Parent is often `justifyContent: 'flex-end'` — never let the panel shrink to chrome.
    flexGrow: 0,
    flexShrink: 0,
  };
}

/**
 * Pure keyboard / sheet height math (no React Native imports — unit-testable).
 *
 * ANDROID FORM-SHEET KEYBOARD RULE — do not regress
 * -------------------------------------------------
 * Prefer `android.softwareKeyboardLayoutMode: "pan"` in `app.json` so the Modal
 * host keeps a stable height when the IME opens (S25 / Expo Go).
 *
 * Sheet **chrome height must stay stable**: do not shrink the panel by IME inset.
 * Clear focused fields with ScrollView `paddingBottom` (`formSheetScrollPaddingBottom`)
 * only — never also enable `KeyboardAvoidingView` behavior/padding/height on Android
 * for these sheets (double-shift pushes the panel off-screen).
 *
 * If the host somehow still shrinks (`adjustResize` leftover), size the panel to the
 * measured host — that is fitting the viewport, not an extra keyboard subtract.
 *
 * iOS keeps `KeyboardAvoidingView behavior="padding"` inside `FormSheetModalBody`.
 */

/** Gap kept above a form sheet panel (`add-transaction`, `add-budget-category`). */
export const FORM_SHEET_TOP_MARGIN = 88;

/**
 * Minimum on-screen sheet height when the keyboard is open.
 * Never force a panel taller than the visible band above the IME.
 */
export const FORM_SHEET_MIN_VISIBLE_HEIGHT = 240;

/**
 * How much shorter the measured host must be vs window height before we treat
 * Android `adjustResize` as already applied.
 */
export const FORM_SHEET_HOST_RESIZE_EPSILON = 48;

/**
 * Guardrail: form sheets keep a stable panel height on Android.
 * Keyboard clearance = scroll padding only (see `formSheetScrollPaddingBottom`).
 */
export const FORM_SHEET_STABLE_ANDROID_PANEL_HEIGHT = true;

/**
 * Cap raw IME inset so scroll padding never demands absurd values.
 * Kept for callers that pad content; not used to shrink the sheet panel.
 */
export function clampFormSheetKeyboardInset(
  rawInset: number,
  windowHeight: number,
  minVisibleSheetHeight: number = FORM_SHEET_MIN_VISIBLE_HEIGHT,
): number {
  if (!(rawInset > 0) || !(windowHeight > 0)) return 0;
  const maxInset = Math.max(0, windowHeight - minVisibleSheetHeight - FORM_SHEET_TOP_MARGIN);
  return Math.min(rawInset, maxInset);
}

/**
 * True when the flex host is already shorter than the window — typical signal
 * that Android `adjustResize` shrank the Modal root.
 */
export function formSheetHostAlreadyResized(
  hostHeight: number,
  windowHeight: number,
  epsilon: number = FORM_SHEET_HOST_RESIZE_EPSILON,
): boolean {
  if (!(hostHeight > 0) || !(windowHeight > 0)) return false;
  return hostHeight < windowHeight - epsilon;
}

/**
 * Hard ceiling for a flex-end form sheet.
 *
 * Stable-height mode (`FORM_SHEET_STABLE_ANDROID_PANEL_HEIGHT`): never subtract
 * IME inset from the panel — only fit the measured host / window − top margin.
 * Pass `screenHeight` when available to detect window shrink under adjustResize.
 */
export function formSheetMaxHeight(args: {
  windowHeight: number;
  hostHeight?: number;
  /** Ignored for panel height when stable mode is on — use for scroll padding only. */
  keyboardInset?: number;
  screenHeight?: number;
  /** Override stable mode (tests / rare). Default = FORM_SHEET_STABLE_ANDROID_PANEL_HEIGHT. */
  stablePanelHeight?: boolean;
}): number {
  const windowHeight = Math.max(1, Math.round(args.windowHeight));
  const host =
    typeof args.hostHeight === 'number' && args.hostHeight > 0
      ? Math.round(args.hostHeight)
      : windowHeight;
  const stable = args.stablePanelHeight ?? FORM_SHEET_STABLE_ANDROID_PANEL_HEIGHT;
  const frameResized =
    formSheetHostAlreadyResized(host, windowHeight) ||
    (typeof args.screenHeight === 'number' &&
      args.screenHeight > 0 &&
      formSheetHostAlreadyResized(windowHeight, Math.round(args.screenHeight)));

  let ceiling = host;
  if (stable) {
    // Fit host / visible window only — do not shrink chrome by keyboard inset.
    if (!frameResized) {
      ceiling = Math.min(ceiling, windowHeight - FORM_SHEET_TOP_MARGIN);
    }
  } else {
    const inset = frameResized
      ? 0
      : clampFormSheetKeyboardInset(args.keyboardInset ?? 0, windowHeight);
    if (inset > 0) {
      ceiling = Math.min(ceiling, windowHeight - inset - FORM_SHEET_TOP_MARGIN);
    } else if (!frameResized) {
      ceiling = Math.min(ceiling, windowHeight - FORM_SHEET_TOP_MARGIN);
    }
  }

  return Math.max(FORM_SHEET_MIN_VISIBLE_HEIGHT, Math.round(ceiling));
}

/**
 * Clamp a desired sheet height so it never exceeds the space inside the host /
 * above the top margin (and optionally above the keyboard when stable mode is off).
 */
export function formSheetKeyboardClampedHeight(
  desiredSheetHeight: number,
  windowHeight: number,
  keyboardInset = 0,
  hostHeight?: number,
  screenHeight?: number,
  stablePanelHeight?: boolean,
): number {
  const desired = Math.max(1, Math.round(desiredSheetHeight));
  const maxH = formSheetMaxHeight({
    windowHeight,
    hostHeight,
    keyboardInset,
    screenHeight,
    stablePanelHeight,
  });
  return Math.min(desired, maxH);
}

/**
 * Height for a form sheet panel: ratio of window, capped by host / top margin.
 * Does not shrink when the keyboard opens (stable Android panel height).
 */
export function formSheetDragHeight(
  windowHeight: number,
  keyboardInset = 0,
  hostHeight?: number,
  screenHeight?: number,
): number {
  const bounded = Math.min(windowHeight * 0.92, windowHeight - FORM_SHEET_TOP_MARGIN);
  return formSheetKeyboardClampedHeight(
    bounded,
    windowHeight,
    keyboardInset,
    hostHeight,
    screenHeight,
  );
}

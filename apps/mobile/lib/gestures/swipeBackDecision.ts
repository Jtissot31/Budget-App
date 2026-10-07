/**
 * Direction discrimination for the app-wide « swipe vers la droite = retour ».
 *
 * Pure math with no imports so it can be inlined in a Reanimated worklet and
 * unit tested under node (see `swipeBackDecision.test.ts`).
 */

/** Rightward travel (dp) required before the back gesture may claim the touch. */
export const SWIPE_BACK_ACTIVATION_DX = 16;
/**
 * |dx| must exceed this multiple of |dy| to activate. Strict on purpose: the
 * gesture is full-width, so ordinary vertical list scrolling must never win it.
 */
export const SWIPE_BACK_AXIS_DOMINANCE = 2;
/** Vertical travel (dp) that hands the touch to a scroll view for good. */
export const SWIPE_BACK_VERTICAL_ABORT_DY = 12;
/** Leftward travel (dp) that rejects the gesture — back is rightward only. */
export const SWIPE_BACK_LEFTWARD_ABORT_DX = 12;
/** Rightward travel (dp) that confirms navigation when the finger lifts. */
export const SWIPE_BACK_COMMIT_DX = 72;
/** Horizontal velocity (dp/s) that confirms navigation on a short flick. */
export const SWIPE_BACK_COMMIT_VELOCITY = 620;
/** Minimum travel still required when committing by velocity. */
export const SWIPE_BACK_FLICK_MIN_DX = 24;
/** Minimum gap between consecutive back navigations (screens). */
export const SWIPE_BACK_DEBOUNCE_MS = 480;

export type SwipeBackDecision = 'activate' | 'reject' | 'undecided';

/**
 * Single-shot verdict for a moving touch, given travel since touch-down.
 * `undecided` means keep waiting — the caller must not claim the touch yet.
 */
export function resolveSwipeBackDecision(dx: number, dy: number): SwipeBackDecision {
  'worklet';
  const absDy = dy < 0 ? -dy : dy;

  // Rightward and clearly dominant on the horizontal axis.
  if (dx >= SWIPE_BACK_ACTIVATION_DX && dx >= SWIPE_BACK_AXIS_DOMINANCE * absDy) {
    return 'activate';
  }
  // Vertical intent → the scroll view owns this touch.
  if (absDy >= SWIPE_BACK_VERTICAL_ABORT_DY) {
    return 'reject';
  }
  // Leftward intent → never a back gesture.
  if (dx <= -SWIPE_BACK_LEFTWARD_ABORT_DX) {
    return 'reject';
  }
  return 'undecided';
}

/** Whether a released swipe travelled / flicked far enough to navigate back. */
export function shouldCommitSwipeBack(dx: number, velocityX: number): boolean {
  'worklet';
  if (dx >= SWIPE_BACK_COMMIT_DX) return true;
  return velocityX >= SWIPE_BACK_COMMIT_VELOCITY && dx >= SWIPE_BACK_FLICK_MIN_DX;
}

let lastSwipeBackAt = 0;

/** Returns true once — callers must not navigate when false (debounce double-pop). */
export function consumeSwipeBackNavigationSlot(now = Date.now()): boolean {
  if (now - lastSwipeBackAt < SWIPE_BACK_DEBOUNCE_MS) return false;
  lastSwipeBackAt = now;
  return true;
}

/** Test helper — reset debounce between assertions. */
export function resetSwipeBackNavigationSlot() {
  lastSwipeBackAt = 0;
}

/**
 * Root tab routes are not dismissible — `(tabs)/_layout` already owns a
 * horizontal swipe to move between tabs, and popping a root tab would leave
 * the user on a blank stack.
 */
const SWIPE_BACK_BLOCKED_PATHS = [
  '/',
  '/transactions',
  '/accounts',
  '/budgets',
  '/goals',
  '/settings',
  '/onboarding',
];

export function isSwipeBackBlockedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return SWIPE_BACK_BLOCKED_PATHS.includes(normalized);
}

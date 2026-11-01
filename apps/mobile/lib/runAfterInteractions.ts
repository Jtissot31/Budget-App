/**
 * Replacement for `InteractionManager.runAfterInteractions`, removed in React Native 0.88.
 * Runs the task once the current frame and pending animations have had a chance to paint
 * (`requestIdleCallback` when available, otherwise after the next animation frame).
 */
export function runAfterInteractions(task: () => void): { cancel: () => void } {
  let cancelled = false;
  const run = () => {
    if (!cancelled) task();
  };
  const g = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof g.requestIdleCallback === 'function') {
    const id = g.requestIdleCallback(run, { timeout: 500 });
    return {
      cancel: () => {
        cancelled = true;
        g.cancelIdleCallback?.(id);
      },
    };
  }
  const frame = requestAnimationFrame(() => setTimeout(run, 0));
  return {
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    },
  };
}

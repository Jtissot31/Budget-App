import type { MutableRefObject } from 'react';
import { useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { useFocusEffect } from 'expo-router';

type RefreshOnFocusOptions = {
  /** Skip the focus callback on first mount (useEffect already loaded). */
  skipInitial?: boolean;
  /**
   * Minimum time between focus-driven refreshes (ms).
   * Avoids reloading Accueil/etc. when quickly switching tabs.
   */
  minIntervalMs?: number;
  /**
   * Run the refresh during the focus commit instead of after the transition.
   * Only for screens whose load is cheap and must be visible immediately.
   * @default false
   */
  immediate?: boolean;
};

/**
 * Upper bound on how long a deferred refresh waits for the transition to settle.
 * `runAfterInteractions` can stall if an animation handle leaks, so a timer races it.
 */
const DEFERRED_REFRESH_FALLBACK_MS = 240;

export function useRefreshOnFocus(
  refresh: () => void | Promise<void>,
  options?: RefreshOnFocusOptions,
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const skipInitialRef = useRef(options?.skipInitial ?? false);
  skipInitialRef.current = options?.skipInitial ?? false;
  const minIntervalMsRef = useRef(options?.minIntervalMs ?? 0);
  minIntervalMsRef.current = options?.minIntervalMs ?? 0;
  const immediateRef = useRef(options?.immediate ?? false);
  immediateRef.current = options?.immediate ?? false;
  const isFirstFocusRef = useRef(true);
  const lastRefreshAtRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (skipInitialRef.current && isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        // Treat mount load as the last refresh so quick tab hops don't reload.
        lastRefreshAtRef.current = Date.now();
        return;
      }
      isFirstFocusRef.current = false;

      const minIntervalMs = minIntervalMsRef.current;
      if (minIntervalMs > 0) {
        const now = Date.now();
        if (now - lastRefreshAtRef.current < minIntervalMs) {
          return;
        }
        lastRefreshAtRef.current = now;
      }

      if (immediateRef.current) {
        void refreshRef.current();
        return;
      }

      /**
       * Reads hit SQLite and rebuild derived series, so running them inside the focus
       * commit blocks the JS thread for the whole tab/stack transition. Waiting for the
       * transition to settle keeps the animation at frame rate; the screen shows its
       * previous data for those few frames.
       */
      let done = false;
      const run = () => {
        if (done) return;
        done = true;
        void refreshRef.current();
      };

      const interaction = InteractionManager.runAfterInteractions(run);
      const fallback = setTimeout(run, DEFERRED_REFRESH_FALLBACK_MS);

      return () => {
        // Leaving before the transition settled: drop the refresh entirely.
        done = true;
        interaction.cancel();
        clearTimeout(fallback);
      };
    }, []),
  );
}

/**
 * Scrolls the screen to the top whenever the route gains focus (tab or stack).
 * When `skipOnceRef` is provided and `ref.current === true`, skips one scroll
 * (e.g. returning from a stack overlay opened from this screen) and clears the ref.
 */
export function useScrollToTopOnFocus(
  scrollToTop: () => void,
  skipOnceRef?: MutableRefObject<boolean>,
) {
  useFocusEffect(
    useCallback(() => {
      if (skipOnceRef?.current) {
        skipOnceRef.current = false;
        return undefined;
      }

      scrollToTop();

      const frame = requestAnimationFrame(scrollToTop);

      return () => {
        cancelAnimationFrame(frame);
      };
    }, [scrollToTop, skipOnceRef]),
  );
}

import type { MutableRefObject } from 'react';
import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

type RefreshOnFocusOptions = {
  /** Skip the focus callback on first mount (useEffect already loaded). */
  skipInitial?: boolean;
  /**
   * Minimum time between focus-driven refreshes (ms).
   * Avoids reloading Accueil/etc. when quickly switching tabs.
   */
  minIntervalMs?: number;
};

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

      void refreshRef.current();
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

import type { MutableRefObject } from 'react';
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

export function useRefreshOnFocus(refresh: () => void | Promise<void>) {
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
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

import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';
import {
  notifyAppTourTargetLayout,
  registerAppTourTarget,
  type TourTargetRect,
} from '@/lib/appTourTargets';

function measureNode(node: View | null): Promise<TourTargetRect | null> {
  return new Promise((resolve) => {
    if (!node) {
      resolve(null);
      return;
    }
    // Wait a frame so flex / safe-area driven tab bar height is settled.
    requestAnimationFrame(() => {
      node.measureInWindow((x, y, width, height) => {
        if (!width || !height) {
          resolve(null);
          return;
        }
        resolve({ x, y, width, height });
      });
    });
  });
}

/**
 * Registers a view as an in-app tour spotlight target via measureInWindow.
 * Re-notifies the tour on every layout so tab bar holes track real bounds.
 */
export function useAppTourTarget(targetId: string | null | undefined) {
  const ref = useRef<View>(null);

  const measure = useCallback(() => measureNode(ref.current), []);

  useEffect(() => {
    if (!targetId) return;
    return registerAppTourTarget(targetId, measure);
  }, [measure, targetId]);

  const onLayout = useCallback(
    (_event?: LayoutChangeEvent) => {
      if (!targetId) return;
      notifyAppTourTargetLayout(targetId);
    },
    [targetId],
  );

  return { ref, onLayout };
}

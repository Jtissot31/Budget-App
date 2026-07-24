import { useEffect, useRef } from 'react';
import type { View } from 'react-native';
import {
  registerAppTourTarget,
  type TourTargetRect,
} from '@/lib/appTourTargets';

/**
 * Registers a view as an in-app tour spotlight target via measureInWindow.
 */
export function useAppTourTarget(targetId: string | null | undefined) {
  const ref = useRef<View>(null);

  useEffect(() => {
    if (!targetId) return;
    return registerAppTourTarget(targetId, () => {
      return new Promise<TourTargetRect | null>((resolve) => {
        const node = ref.current;
        if (!node) {
          resolve(null);
          return;
        }
        node.measureInWindow((x, y, width, height) => {
          if (!width || !height) {
            resolve(null);
            return;
          }
          resolve({ x, y, width, height });
        });
      });
    });
  }, [targetId]);

  return ref;
}

/**
 * Floating action buttons step aside while a list scrolls down (so they never sit on top of a
 * row's amount) and come back on the first scroll up or near the top.
 */
import { useSyncExternalStore } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const TOP_ZONE = 40;
const DIRECTION_THRESHOLD = 8;

let visible = true;
let lastY = 0;
const listeners = new Set<() => void>();

function setVisible(next: boolean) {
  if (next === visible) return;
  visible = next;
  listeners.forEach((fn) => fn());
}

export function reportFabScroll(event: NativeSyntheticEvent<NativeScrollEvent>): void {
  const y = event.nativeEvent.contentOffset.y;
  const dy = y - lastY;
  if (y <= TOP_ZONE) {
    setVisible(true);
    lastY = y;
  } else if (Math.abs(dy) >= DIRECTION_THRESHOLD) {
    setVisible(dy < 0);
    lastY = y;
  }
}

/** Call when the visible screen changes so a new tab never starts with its FABs hidden. */
export function resetFabScroll(): void {
  lastY = 0;
  setVisible(true);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useFabScrollVisible(): boolean {
  return useSyncExternalStore(subscribe, () => visible, () => true);
}

import { makeMutable } from 'react-native-reanimated';

/**
 * Shared exclusion counter for horizontal carousels / chip rows.
 * When > 0, swipe-back pans must fail so the child owns the touch.
 */
export const swipeBackExclusionCount = makeMutable(0);

export function beginSwipeBackExclusion() {
  'worklet';
  swipeBackExclusionCount.value += 1;
}

export function endSwipeBackExclusion() {
  'worklet';
  swipeBackExclusionCount.value = Math.max(0, swipeBackExclusionCount.value - 1);
}

export function isSwipeBackExcluded(): boolean {
  'worklet';
  return swipeBackExclusionCount.value > 0;
}

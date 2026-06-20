import * as Haptics from 'expo-haptics';
import { isHapticFeedbackEnabled } from '@/lib/settings';

export function tapHaptic() {
  if (!isHapticFeedbackEnabled()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function successHaptic() {
  if (!isHapticFeedbackEnabled()) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

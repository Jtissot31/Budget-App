import * as Haptics from 'expo-haptics';

export function tapHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function successHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

import { Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

/** Eagerly load vector icon fonts on web so Icon mounts don't fire uncaught loadAsync rejections. */
export function preloadVectorIconFonts(): void {
  if (Platform.OS !== 'web') return;

  void Promise.allSettled([
    Ionicons.loadFont().catch(() => undefined),
    MaterialCommunityIcons.loadFont().catch(() => undefined),
    MaterialIcons.loadFont().catch(() => undefined),
  ]);
}

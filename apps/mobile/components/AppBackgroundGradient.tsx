import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { appBackgroundGradientLight, DARK_CANVAS } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  style?: StyleProp<ViewStyle>;
};

/** Full-screen app canvas — solid charcoal (dark) or warm-grey gradient (light). */
export function AppBackgroundGradient({ style }: Props) {
  const { isLight } = useAppTheme();

  if (!isLight) {
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, styles.darkCanvas, style]}
      />
    );
  }

  const gradient = appBackgroundGradientLight;

  return (
    <LinearGradient
      pointerEvents="none"
      colors={[...gradient.colors]}
      locations={[...gradient.locations]}
      start={gradient.start}
      end={gradient.end}
      style={[StyleSheet.absoluteFillObject, style]}
    />
  );
}

const styles = StyleSheet.create({
  darkCanvas: {
    backgroundColor: DARK_CANVAS,
    zIndex: 0,
  },
});

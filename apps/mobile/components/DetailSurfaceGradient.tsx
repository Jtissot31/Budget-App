import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

const DARK_DETAIL_SURFACE_GRADIENT = [
  '#1E1E1E',
  '#1D1D1D',
  '#1C1C1C',
  '#1B1B1B',
  '#1A1A1A',
  '#191919',
  '#181818',
  '#171717',
  '#161616',
  '#151515',
  '#141414',
  '#131313',
];

const LIGHT_DETAIL_SURFACE_GRADIENT = [
  '#FFFFFF',
  '#FEFEFE',
  '#FDFDFD',
  '#FCFCFD',
  '#FBFCFC',
  '#FAFBFC',
  '#F9FAFB',
  '#F8F9FA',
  '#F7F8FA',
];

type Props = {
  isLight: boolean;
  style?: StyleProp<ViewStyle>;
};

export function DetailSurfaceGradient({ isLight, style }: Props) {
  const stops = isLight ? LIGHT_DETAIL_SURFACE_GRADIENT : DARK_DETAIL_SURFACE_GRADIENT;

  return (
    <View pointerEvents="none" style={[styles.surface, style]}>
      {stops.map((backgroundColor, index) => (
        <View key={`${backgroundColor}-${index}`} style={[styles.band, { backgroundColor }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    ...StyleSheet.absoluteFillObject,
  },
  band: {
    flex: 1,
  },
});

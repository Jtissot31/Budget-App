import { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { planFinanceCardHalo, planFinanceKit } from '@/constants/planFinanceKit';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Green accent halo — on by default for plan finance surfaces */
  halo?: boolean;
};

/** Plan finance card shell — #111 fill, hairline outline, optional green halo (matches PlanCard). */
export function PlanFinanceContainer({ children, style, halo = true }: Props) {
  const { colors, isLight } = useAppTheme();
  const haloTokens = isLight ? planFinanceCardHalo.light : planFinanceCardHalo.dark;

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: colors.containerBackground,
          borderColor: colors.containerBorder,
        },
        style,
      ]}
    >
      {halo ? (
        <View pointerEvents="none" style={styles.haloWrap}>
          <LinearGradient
            colors={[...haloTokens.corner]}
            locations={[...haloTokens.cornerLocations]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.9 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[...haloTokens.wash]}
            locations={[...haloTokens.washLocations]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: planFinanceKit.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  haloWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
});

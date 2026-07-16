import { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { planFinanceCardHalo, planFinanceContainerShellStyle } from '@/constants/planFinanceKit';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Charcoal lift halo — on by default for plan finance / portefeuille surfaces */
  halo?: boolean;
};

/**
 * Shared card shell for portefeuille + plan finance —
 * #111 fill, hairline outline, 13px radius, optional charcoal halo.
 *
 * Theme-kit name: **Onyx container** — import {@link OnyxContainer} for new work
 * (`components/OnyxContainer.tsx`). Tokens: `ONYX_CONTAINER` in `planFinanceKit`.
 *
 * Layout styles (`flexDirection`, `gap`, `padding`, …) must stay on this root so
 * row tiles (biens, prêts, suggestions) keep working — do not wrap children.
 */
export function PlanFinanceContainer({ children, style, halo = true }: Props) {
  const { colors, isLight } = useAppTheme();
  const haloTokens = isLight ? planFinanceCardHalo.light : planFinanceCardHalo.dark;

  return (
    <View style={[planFinanceContainerShellStyle(colors), styles.root, style]}>
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
  root: {
    position: 'relative',
  },
  /** Absolute only — no zIndex, so in-flow children paint above the halo. */
  haloWrap: {
    ...StyleSheet.absoluteFillObject,
  },
});

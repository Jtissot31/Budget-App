/**
 * FitText — single-line text that shrinks to fit its container instead of being cropped.
 *
 * Works on native and web (RN-web ignores `adjustsFontSizeToFit`): a hidden copy is
 * laid out at the base size to read its natural width, then the visible copy is
 * scaled by `available / natural`, floored at `minScale` (ellipsis beyond that).
 *
 * `useScreenScale` gives a gentle size multiplier from the window width so hero
 * numbers and titles look balanced on small and large phones alike.
 */
import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

/** Reference width the design was drawn at (logical px). */
const BASE_WIDTH = 390;

/** 0.9 on a 350px phone, 1 at 390px, up to 1.1 on large/foldable widths. */
export function useScreenScale(): number {
  const { width } = useWindowDimensions();
  return Math.min(1.1, Math.max(0.88, width / BASE_WIDTH));
}

type Props = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  /** Base font size before fitting (required so line-height scales too). */
  fontSize: number;
  lineHeight?: number;
  /** Smallest allowed scale; past it the text ellipsizes. */
  minScale?: number;
  /** Scale with the window width (heroes, page titles). */
  responsive?: boolean;
  align?: 'left' | 'right' | 'center';
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function FitText({
  children,
  style,
  fontSize,
  lineHeight,
  minScale = 0.6,
  responsive = false,
  align = 'left',
  containerStyle,
  accessibilityLabel,
}: Props) {
  const screen = useScreenScale();
  const base = responsive ? fontSize * screen : fontSize;
  const baseLine = lineHeight != null ? (responsive ? lineHeight * screen : lineHeight) : undefined;
  const [available, setAvailable] = useState(0);
  const [natural, setNatural] = useState(0);

  const scale =
    available > 0 && natural > 0 ? Math.max(minScale, Math.min(1, available / natural)) : 1;
  const size = Math.floor(base * scale * 10) / 10;
  const line = baseLine != null ? Math.ceil(baseLine * scale) : undefined;

  return (
    <View
      style={[styles.box, containerStyle]}
      onLayout={(e) => {
        const w = Math.floor(e.nativeEvent.layout.width);
        setAvailable((prev) => (prev === w ? prev : w));
      }}
    >
      {/* Measuring copy — natural width at base size, never visible. */}
      <View style={styles.measure} pointerEvents="none" aria-hidden>
        <Text
          style={[style, { fontSize: base, lineHeight: baseLine }, styles.noWrap]}
          onLayout={(e) => {
            const w = Math.ceil(e.nativeEvent.layout.width) + 1;
            setNatural((prev) => (prev === w ? prev : w));
          }}
          accessible={false}
        >
          {children}
        </Text>
      </View>
      <Text
        style={[style, { fontSize: size, lineHeight: line, textAlign: align }]}
        numberOfLines={1}
        ellipsizeMode="tail"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { minWidth: 0, alignSelf: 'stretch' },
  measure: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    top: 0,
    // Let the measuring copy grow past the container.
    width: 10000,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noWrap: { flexShrink: 0 },
});

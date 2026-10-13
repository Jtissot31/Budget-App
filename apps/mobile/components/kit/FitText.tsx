/**
 * FitText — single-line text that shrinks to fit its container instead of being cropped.
 *
 * Works on native and web (RN-web ignores `adjustsFontSizeToFit`): a hidden copy is
 * laid out at the base size to read its natural width, then the visible copy is
 * scaled by `available / natural`, floored at `minScale`; past that it wraps to a
 * second line instead of being cut.
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
  /** Base font size before fitting. Defaults to the `style` font size (14 if none). */
  fontSize?: number;
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
  align,
  containerStyle,
  accessibilityLabel,
}: Props) {
  const screen = useScreenScale();
  const flat = StyleSheet.flatten(style) ?? {};
  const fontSizeBase = fontSize ?? (typeof flat.fontSize === 'number' ? flat.fontSize : 14);
  const lineHeightBase = lineHeight ?? (typeof flat.lineHeight === 'number' ? flat.lineHeight : undefined);
  const base = responsive ? fontSizeBase * screen : fontSizeBase;
  const baseLine =
    lineHeightBase != null ? (responsive ? lineHeightBase * screen : lineHeightBase) : undefined;
  // Layout props belong on the wrapper so a FitText behaves like the Text it replaced in rows.
  const layout: ViewStyle = {};
  const textStyle: TextStyle = { ...(flat as TextStyle) };
  for (const key of LAYOUT_KEYS) {
    if (textStyle[key] !== undefined) {
      (layout as Record<string, unknown>)[key] = textStyle[key];
      delete textStyle[key];
    }
  }
  const [available, setAvailable] = useState(0);
  const [natural, setNatural] = useState(0);

  const ratio = available > 0 && natural > 0 ? available / natural : 1;
  const plain = typeof children === 'string' || typeof children === 'number' ? String(children) : '';
  const multiWord = /\S\s+\S/.test(plain);
  // Still too long at the smallest size: several words wrap onto a second line;
  // a single word keeps shrinking (never split mid-word, never cut with « … »).
  const wraps = ratio < minScale && multiWord;
  const floor = ratio < minScale && !multiWord ? HARD_MIN_SCALE : minScale;
  const scale = Math.max(floor, Math.min(1, ratio));
  const size = Math.floor(base * scale * 10) / 10;
  const line = baseLine != null ? Math.ceil(baseLine * scale) : undefined;

  return (
    <View
      style={[styles.box, layout, containerStyle]}
      onLayout={(e) => {
        const w = Math.floor(e.nativeEvent.layout.width);
        setAvailable((prev) => (prev === w ? prev : w));
      }}
    >
      {/* Measuring copy — natural width at base size, never visible. */}
      <View style={styles.measure} pointerEvents="none" aria-hidden>
        <Text
          style={[textStyle, { fontSize: base, lineHeight: baseLine }, styles.noWrap]}
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
        style={[textStyle, { fontSize: size, lineHeight: line, textAlign: align ?? flat.textAlign ?? 'left' }]}
        numberOfLines={wraps ? 2 : 1}
        ellipsizeMode="tail"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Text>
    </View>
  );
}

/** Last-resort scale for a single word that does not fit at `minScale`. */
const HARD_MIN_SCALE = 0.45;

/** Flex / box keys moved from the text style onto the wrapper. */
const LAYOUT_KEYS = [
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'width',
  'minWidth',
  'maxWidth',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'position',
  'top',
  'left',
  'right',
  'bottom',
] as const;

const styles = StyleSheet.create({
  box: { minWidth: 0, flexShrink: 1, alignSelf: 'stretch' },
  // In-flow but zero-height: gives the wrapper the text's natural width (so an
  // intrinsically sized parent never collapses), while the row lets the copy
  // overflow a narrower wrapper and still report its full width.
  measure: {
    height: 0,
    overflow: 'hidden',
    opacity: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noWrap: { flexShrink: 0 },
});

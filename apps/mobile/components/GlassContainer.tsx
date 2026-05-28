import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleProp, ViewStyle, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../lib/themeContext';

const RADIUS = 20;
const BORDER_PADDING = 1.5;

/** Below these dimensions, use subtle horizontal 2-stop outline (avoids C-shaped diagonal). */
const SMALL_WIDTH_THRESHOLD = 140;
const SMALL_HEIGHT_THRESHOLD = 72;

const DARK_GRADIENT = [
  'rgba(170,175,180,0.55)',
  'rgba(90,95,100,0.12)',
  'rgba(140,145,150,0.35)',
] as const;

/** Same stop indices / geometry as DARK_GRADIENT — darker edge, lighter fade (visible on light surfaces). */
const LIGHT_GRADIENT = [
  'rgba(75,80,88,0.55)',
  'rgba(255,255,255,0.12)',
  'rgba(110,115,125,0.35)',
] as const;

const DARK_GRADIENT_SMALL = [
  'rgba(140,145,150,0.4)',
  'rgba(130,135,140,0.35)',
] as const;

/** Same start/end as DARK_GRADIENT_SMALL — accent on the left stop, softer on the right. */
const LIGHT_GRADIENT_SMALL = [
  'rgba(90,95,105,0.4)',
  'rgba(240,242,248,0.35)',
] as const;

type OutlineConfig = {
  colors: string[];
  locations?: number[];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

function deriveOutlineGradient(baseColor: string): [string, string, string] {
  const match = baseColor.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)/);
  if (match) {
    const [, r, g, b] = match;
    return [
      `rgba(${r},${g},${b},0.55)`,
      `rgba(${r},${g},${b},0.12)`,
      `rgba(${r},${g},${b},0.35)`,
    ];
  }
  return [baseColor, baseColor, baseColor];
}

function deriveOutlineGradientSmall(baseColor: string): [string, string] {
  const match = baseColor.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)/);
  if (match) {
    const [, r, g, b] = match;
    return [`rgba(${r},${g},${b},0.4)`, `rgba(${r},${g},${b},0.35)`];
  }
  return [baseColor, baseColor];
}

function resolveOutlineConfig(
  isLight: boolean,
  isSmall: boolean,
  outlineColors?: readonly string[],
): OutlineConfig {
  if (isSmall) {
    if (outlineColors && outlineColors.length >= 2) {
      return {
        colors: [outlineColors[0], outlineColors[1]],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 },
      };
    }
    if (outlineColors && outlineColors.length >= 1) {
      const [a, b] = deriveOutlineGradientSmall(outlineColors[0]);
      return { colors: [a, b], start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
    }
    const colors = isLight ? [...LIGHT_GRADIENT_SMALL] : [...DARK_GRADIENT_SMALL];
    return { colors, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
  }

  if (outlineColors && outlineColors.length >= 3) {
    return {
      colors: [outlineColors[0], outlineColors[1], outlineColors[2]],
      locations: [0, 0.5, 1],
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    };
  }
  if (outlineColors && outlineColors.length >= 1) {
    const derived = deriveOutlineGradient(outlineColors[0]);
    return {
      colors: [...derived],
      locations: [0, 0.5, 1],
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    };
  }
  const colors = isLight ? [...LIGHT_GRADIENT] : [...DARK_GRADIENT];
  return {
    colors,
    locations: [0, 0.5, 1],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  };
}

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  borderRadius?: number;
  innerBackgroundColor?: string;
  innerStyle?: StyleProp<ViewStyle>;
  outlineColors?: readonly string[]; // keep for API compat but optional override
};

export function GlassContainer({
  children,
  style,
  padding = 16,
  borderRadius = RADIUS,
  innerBackgroundColor,
  innerStyle,
  outlineColors,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const innerRadius = Math.max(0, borderRadius - BORDER_PADDING);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  const measured = layout.width > 0 && layout.height > 0;
  const isSmall =
    measured &&
    (layout.width < SMALL_WIDTH_THRESHOLD || layout.height < SMALL_HEIGHT_THRESHOLD);

  const outline = useMemo(
    () => resolveOutlineConfig(isLight, isSmall, outlineColors),
    [isLight, isSmall, outlineColors],
  );

  const fillColor = innerBackgroundColor ?? colors.surfaceSolid;

  return (
    <LinearGradient
      colors={outline.colors}
      locations={outline.locations}
      start={outline.start}
      end={outline.end}
      onLayout={onLayout}
      style={[{ borderRadius, overflow: 'hidden' }, style]}
    >
      <View
        style={[
          {
            borderRadius: innerRadius,
            backgroundColor: fillColor,
            padding,
            overflow: 'hidden',
            margin: BORDER_PADDING,
            alignSelf: 'stretch',
            flexGrow: 1,
          },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

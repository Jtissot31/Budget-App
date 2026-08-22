/**
 * Compact Proto glass shortcut tiles (icon well + label).
 * Row = 2 equal columns; Grid = stacked rows (wrap); Carousel = horizontal peeking strip.
 */
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SwipeBackExclusion } from '@/components/gestures/SwipeBackExclusion';
import { AppIcon } from '@/components/icons/AppIcon';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import {
  ONYX_CONTAINER,
  onyxContainerCompactTilePaddingStyle,
  onyxContainerPressedStyle,
} from '@/constants/planFinanceKit';
import { ICON_WELL_SIZE, PAGE_PADDING_HORIZONTAL, radius, typographyKit } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export type ProtoShortcutItem = {
  key: string;
  label: string;
  subtitle?: string;
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  accessibilityLabel?: string;
  onPress: () => void;
};

/** Gap between tiles — reuse for vertical spacing when stacking rows into a grid. */
export const SHORTCUT_TILE_GAP = 10;
const TILE_GAP = SHORTCUT_TILE_GAP;
const TILE_INNER_GAP = 8;
const COPY_GAP = 2;
const LABEL_MAX_LINES = 2;
const SUBTITLE_MAX_LINES = 2;
/** Room for Plus Jakarta descenders (p, g, y) — tighter values clip mid-glyph. */
const LABEL_LINE_HEIGHT = 20;
const SUBTITLE_LINE_HEIGHT = 16;
const COMPACT_PAD = ONYX_CONTAINER.padding.compactTile;

function shortcutTileMinHeight(hasSubtitle: boolean): number {
  const textBlock =
    LABEL_LINE_HEIGHT * LABEL_MAX_LINES +
    (hasSubtitle ? COPY_GAP + SUBTITLE_LINE_HEIGHT * SUBTITLE_MAX_LINES : 0);
  return (
    COMPACT_PAD.paddingTop +
    COMPACT_PAD.paddingBottom +
    ICON_WELL_SIZE +
    TILE_INNER_GAP +
    textBlock
  );
}

/**
 * Accueil shortcut min size: Onyx compact padding + icon + two-line title + two-line subtitle.
 * Tiles may grow with wrapped copy; never use a fixed height that clips glyphs.
 */
export const SHORTCUT_TILE_HEIGHT = shortcutTileMinHeight(true);
/** ~1.65 tiles visible → carousel peek of the next card. */
const PEEK_VISIBLE = 1.65;

type TileProps = {
  item: ProtoShortcutItem;
  /** Fixed width for carousel; omit for flex row tiles. */
  style?: StyleProp<ViewStyle>;
};

export function ProtoShortcutTile({ item, style }: TileProps) {
  const { colors, isLight } = useAppTheme();
  const fixed = style != null;
  const minHeight = shortcutTileMinHeight(Boolean(item.subtitle));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      onPress={() => {
        tapHaptic();
        item.onPress();
      }}
      style={({ pressed }) => [
        styles.press,
        { minHeight },
        fixed ? style : styles.pressFlex,
        pressed && onyxContainerPressedStyle(),
      ]}
    >
      <ProtoGlassCard padding={0} style={[styles.card, onyxContainerCompactTilePaddingStyle()]}>
        <View style={[styles.iconWell, { backgroundColor: colors.iconWell }]}>
          <AppIcon
            family="ionicons"
            name={item.icon}
            size={16}
            color={isLight ? colors.text : colors.textSecondary}
          />
        </View>
        <View style={styles.copy}>
          <Text
            style={[styles.label, { color: colors.text }]}
            numberOfLines={LABEL_MAX_LINES}
            ellipsizeMode="tail"
          >
            {item.label}
          </Text>
          {item.subtitle ? (
            <Text
              style={[styles.subtitle, { color: colors.textMuted }]}
              numberOfLines={SUBTITLE_MAX_LINES}
              ellipsizeMode="tail"
            >
              {item.subtitle}
            </Text>
          ) : null}
        </View>
      </ProtoGlassCard>
    </Pressable>
  );
}

type RowProps = {
  items: readonly [ProtoShortcutItem, ProtoShortcutItem];
};

/** Exactly two equal-width Proto glass shortcuts. */
export function ProtoShortcutRow({ items }: RowProps) {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <ProtoShortcutTile key={item.key} item={item} />
      ))}
    </View>
  );
}

type GridProps = {
  items: readonly ProtoShortcutItem[];
};

/**
 * Accueil-style shortcut grid: two equal-width tiles per row, wrap, same gap token.
 * An odd last item stays half-width (spacer in the second column).
 */
export function ProtoShortcutGrid({ items }: GridProps) {
  const rows: ReactNode[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const first = items[i];
    const second = items[i + 1];
    if (!first) continue;
    if (second) {
      rows.push(
        <ProtoShortcutRow
          key={first.key}
          items={[first, second] as readonly [ProtoShortcutItem, ProtoShortcutItem]}
        />,
      );
    } else {
      rows.push(
        <View key={first.key} style={styles.row}>
          <ProtoShortcutTile item={first} />
          <View style={styles.pressFlex} />
        </View>,
      );
    }
  }

  return <View style={styles.grid}>{rows}</View>;
}

type CarouselProps = {
  items: readonly ProtoShortcutItem[];
};

/**
 * Horizontal sliding shortcuts — tiles sized so ~1.5–2 peek in the viewport.
 * Breaks out of page horizontal padding so scroll reaches the screen edge.
 */
export function ProtoShortcutCarousel({ items }: CarouselProps) {
  const { width } = useWindowDimensions();
  const available = width - PAGE_PADDING_HORIZONTAL * 2;
  const tileWidth = Math.round((available - TILE_GAP) / PEEK_VISIBLE);
  const snapInterval = tileWidth + TILE_GAP;

  return (
    <SwipeBackExclusion>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
      >
        {items.map((item) => (
          <ProtoShortcutTile key={item.key} item={item} style={{ width: tileWidth }} />
        ))}
      </ScrollView>
    </SwipeBackExclusion>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: TILE_GAP,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: TILE_GAP,
    width: '100%',
  },
  carousel: {
    marginHorizontal: -PAGE_PADDING_HORIZONTAL,
  },
  carouselContent: {
    gap: TILE_GAP,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  press: {
    minWidth: 0,
  },
  pressFlex: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    flex: 1,
    gap: TILE_INNER_GAP,
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  iconWell: {
    width: ICON_WELL_SIZE,
    height: ICON_WELL_SIZE,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    gap: COPY_GAP,
    flexShrink: 0,
    overflow: 'visible',
  },
  label: {
    ...typographyKit.metaSemibold,
    fontSize: 13,
    letterSpacing: -0.15,
    lineHeight: LABEL_LINE_HEIGHT,
    flexShrink: 0,
    includeFontPadding: false,
    overflow: 'visible',
  },
  subtitle: {
    ...typographyKit.metaMedium,
    fontSize: 11,
    letterSpacing: -0.1,
    lineHeight: SUBTITLE_LINE_HEIGHT,
    flexShrink: 0,
    includeFontPadding: false,
    overflow: 'visible',
  },
});

/** @deprecated Use ProtoShortcutRow — kept so stale ShortcutRow imports do not crash Hermes. */
export { ProtoShortcutRow as ShortcutRow, ProtoShortcutCarousel as ShortcutCarousel };

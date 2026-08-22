/**
 * Row of icon-only Onyx action tiles with the label rendered under the tile.
 * ≤4 items: equal-width flex row. More items: horizontal peeking strip (ProtoShortcutCarousel pattern).
 */
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
import { OnyxContainer } from '@/components/OnyxContainer';
import { onyxContainerPressedStyle } from '@/constants/planFinanceKit';
import { PAGE_PADDING_HORIZONTAL, spacing, typographyKit } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export type ProtoActionTileItem = {
  key: string;
  label: string;
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  accessibilityLabel?: string;
  onPress: () => void;
};

/** Match ProtoShortcutRow gap (Onyx listGap is for stacked cards). */
const TILE_GAP = 10;
/** Slightly wider than tall — keeps the glyph optically centered at row widths. */
const TILE_ASPECT_RATIO = 1.35;
const LABEL_LINE_HEIGHT = 15;
/** ~3.75 tiles visible → peek of the next card when scrolling. */
const PEEK_VISIBLE = 3.75;
const SCROLL_THRESHOLD = 4;

type TileProps = {
  item: ProtoActionTileItem;
  /** Fixed width for carousel; omit for flex row tiles. */
  style?: StyleProp<ViewStyle>;
};

function ProtoActionTile({ item, style }: TileProps) {
  const { colors } = useAppTheme();
  const fixed = style != null;

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
        fixed ? style : styles.pressFlex,
        pressed && onyxContainerPressedStyle(),
      ]}
    >
      <OnyxContainer style={styles.tile}>
        <AppIcon family="ionicons" name={item.icon} size={22} color={colors.text} />
      </OnyxContainer>
      <View style={styles.labelSlot}>
        <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={2}>
          {item.label}
        </Text>
      </View>
    </Pressable>
  );
}

export function ProtoActionTileRow({ items }: { items: readonly ProtoActionTileItem[] }) {
  const { width } = useWindowDimensions();
  const scrollable = items.length > SCROLL_THRESHOLD;

  if (!scrollable) {
    return (
      <View style={styles.row}>
        {items.map((item) => (
          <ProtoActionTile key={item.key} item={item} />
        ))}
      </View>
    );
  }

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
          <ProtoActionTile key={item.key} item={item} style={{ width: tileWidth }} />
        ))}
      </ScrollView>
    </SwipeBackExclusion>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
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
  },
  tile: {
    width: '100%',
    aspectRatio: TILE_ASPECT_RATIO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelSlot: {
    width: '100%',
    minHeight: LABEL_LINE_HEIGHT * 2,
    marginTop: spacing.sm,
  },
  label: {
    ...typographyKit.microMedium,
    lineHeight: LABEL_LINE_HEIGHT,
    textAlign: 'center',
  },
});

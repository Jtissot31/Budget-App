import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable as RNPressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  buildGlobalSearchList,
  buildLetterIndex,
  buildSubRegionList,
  getCachedCountryLetterIndex,
  getCachedCountryList,
  getCountryByCode,
  isCountryOnlyRegionId,
  normalizeSortLetter,
  parseRegionId,
  railOffsetForLetter,
  resolveLetterAtRailOffset,
  type CountryRegion,
  type IndexedListItem,
  type LetterIndex,
} from '@/constants/regions';
import {
  DASHBOARD_VALUE_GREEN,
  interBoldText,
  interMediumText,
  interSemiboldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { detectCountryRegion } from '@/lib/regionLocation';
import { tapHaptic } from '@/lib/haptics';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAppTheme } from '@/lib/themeContext';
import { UNIFORM_ROW_MIN_HEIGHT } from '@/lib/uniformGroupStyles';

type Props = {
  visible: boolean;
  selectedId: CountryRegion;
  onClose: () => void;
  onSelect: (id: CountryRegion) => void;
};

type ViewMode = 'countries' | 'regions';

type AlphabetIndexRailProps = {
  letters: string[];
  scrollAnchorLetter: string | null;
  onScrollToLetter: (letter: string, animated?: boolean) => void;
  onScrubbingChange?: (scrubbing: boolean) => void;
  colors: ReturnType<typeof useAppTheme>['colors'];
};

const BADGE_FADE_IN_MS = 110;
const BADGE_FADE_OUT_MS = 180;
/** iOS Contacts-style scrub badge — large, offset left of the touch rail. */
const LETTER_PREVIEW_SIZE = 56;
const LETTER_PREVIEW_OFFSET_X = 80;
const INDEX_RAIL_TOUCH_WIDTH = 36;
/** Reserved right column so list rows / footers never overlap the rail. */
const INDEX_RAIL_COLUMN_WIDTH = 48;
/** Letters shown downward from the active anchor on the scrub rail. */
const INDEX_RAIL_WINDOW_SIZE = 9;
const INDEX_RAIL_LETTER_GAP = 8;
const INDEX_RAIL_LETTER_SLOT_HEIGHT = 18;
const SHEET_HEIGHT_PERCENT = '92%';
const HEADER_BUTTON_SIZE = 44;
const HEADER_BUTTON_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
/** minHeight row; description adds one micro line + gap. */
const LIST_ROW_HEIGHT = UNIFORM_ROW_MIN_HEIGHT;
const LIST_ROW_HEIGHT_WITH_DESC = UNIFORM_ROW_MIN_HEIGHT + 18;
/** When list scroll offset is below this, rail anchor snaps back to the first letter. */
const LIST_TOP_ANCHOR_THRESHOLD = 12;

const EMPTY_LETTER_INDEX: LetterIndex = { letters: [], indexByLetter: {} };

type RegionPickerRowProps = {
  item: IndexedListItem;
  index: number;
  listLength: number;
  selectedId: CountryRegion;
  mode: ViewMode;
  borderColor: string;
  borderStrongColor: string;
  textColor: string;
  mutedColor: string;
  primaryColor: string;
  onSelectRegion: (regionId: CountryRegion) => void;
  onSelectCountry: (countryCode: string) => void;
};

const RegionPickerRow = memo(function RegionPickerRow({
  item,
  index,
  listLength,
  selectedId,
  mode,
  borderColor,
  borderStrongColor,
  textColor,
  mutedColor,
  primaryColor,
  onSelectRegion,
  onSelectCountry,
}: RegionPickerRowProps) {
  const selected = item.id === selectedId;
  const isLast = index === listLength - 1;
  const isSubRegionRow = item.kind === 'subRegion' || mode === 'regions';
  const onPress = isSubRegionRow
    ? () => onSelectRegion(item.id as CountryRegion)
    : () => onSelectCountry(item.id);

  const country = !isSubRegionRow ? getCountryByCode(item.id) : null;
  const hasSubRegions = Boolean(country?.regions?.length);

  return (
    <RNPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: borderColor,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.optionCopy}>
        <Text style={[styles.optionLabel, { color: textColor }]}>{item.label}</Text>
        {item.description ? (
          <Text style={[styles.optionDescription, { color: mutedColor }]}>{item.description}</Text>
        ) : null}
      </View>
      {selected ? (
        <Ionicons name="checkmark-circle" size={22} color={primaryColor} />
      ) : hasSubRegions ? (
        <Ionicons name="chevron-forward" size={18} color={mutedColor} />
      ) : (
        <View style={[styles.radio, { borderColor: borderStrongColor }]} />
      )}
    </RNPressable>
  );
});

function resolveDefaultRailAnchor(letters: string[]): string | null {
  if (!letters.length) return null;
  if (letters.includes('A')) return 'A';
  const firstFromA = letters.find((letter) => letter >= 'A');
  return firstFromA ?? letters[0];
}

function clampPreviewOffsetY(offsetY: number, railHeight: number): number {
  if (railHeight <= 0) return offsetY;
  const half = LETTER_PREVIEW_SIZE / 2;
  return Math.max(half, Math.min(offsetY, railHeight - half));
}

function findFirstVisibleIndexForOffset(
  offsetY: number,
  offsets: readonly number[],
): number {
  if (!offsets.length) return 0;

  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (offsets[mid] <= offsetY + 1) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

function AlphabetIndexRail({
  letters,
  scrollAnchorLetter,
  onScrollToLetter,
  onScrubbingChange,
  colors,
}: AlphabetIndexRailProps) {
  const railHeightRef = useRef(0);
  const lastScrolledLetterRef = useRef<string | null>(null);
  const [anchorLetter, setAnchorLetter] = useState<string | null>(() =>
    resolveDefaultRailAnchor(letters),
  );
  const [previewOffsetY, setPreviewOffsetY] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const badgeOpacity = useSharedValue(0);

  const clearScrubState = useCallback(() => {
    setIsScrubbing(false);
    onScrubbingChange?.(false);
  }, [onScrubbingChange]);

  const hidePreview = useCallback(() => {
    badgeOpacity.value = withTiming(0, { duration: BADGE_FADE_OUT_MS }, (finished) => {
      if (finished) {
        runOnJS(clearScrubState)();
      }
    });
  }, [badgeOpacity, clearScrubState]);

  const scrubAtOffset = useCallback(
    (offsetY: number, animated: boolean, phase: 'move' | 'end') => {
      const railHeight = railHeightRef.current;
      const letter = resolveLetterAtRailOffset(offsetY, railHeight, letters);
      if (!letter) return;

      const badgeY = clampPreviewOffsetY(
        railOffsetForLetter(letter, railHeight, letters),
        railHeight,
      );

      if (phase === 'move') {
        setIsScrubbing(true);
        onScrubbingChange?.(true);
        setAnchorLetter((prev) => (prev === letter ? prev : letter));
        setPreviewOffsetY(badgeY);
        badgeOpacity.value = withTiming(1, { duration: BADGE_FADE_IN_MS });
      } else {
        setAnchorLetter((prev) => (prev === letter ? prev : letter));
        setPreviewOffsetY(badgeY);
      }

      if (lastScrolledLetterRef.current !== letter) {
        lastScrolledLetterRef.current = letter;
        onScrollToLetter(letter, animated);
      }
    },
    [badgeOpacity, letters, onScrollToLetter, onScrubbingChange],
  );

  const handleRailLayout = useCallback((height: number) => {
    if (height > 0) {
      railHeightRef.current = height;
    }
  }, []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .hitSlop({ left: 4, right: 4, top: 0, bottom: 0 })
        .minDistance(0)
        .shouldCancelWhenOutside(true)
        .onBegin((event) => {
          runOnJS(scrubAtOffset)(event.y, false, 'move');
        })
        .onUpdate((event) => {
          runOnJS(scrubAtOffset)(event.y, false, 'move');
        })
        .onEnd((event) => {
          runOnJS(scrubAtOffset)(event.y, true, 'end');
        })
        .onFinalize(() => {
          runOnJS(hidePreview)();
        }),
    [hidePreview, scrubAtOffset],
  );

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ scale: 0.92 + badgeOpacity.value * 0.08 }],
  }));

  const lettersKey = letters.join('\0');

  useEffect(() => {
    if (!letters.length) {
      setAnchorLetter((prev) => (prev === null ? prev : null));
      return;
    }
    setAnchorLetter((prev) =>
      prev && letters.includes(prev) ? prev : resolveDefaultRailAnchor(letters),
    );
    // lettersKey tracks letters content; letters is read from the matching render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lettersKey]);

  useEffect(() => {
    if (isScrubbing || scrollAnchorLetter == null) return;
    if (!letters.includes(scrollAnchorLetter)) return;
    setAnchorLetter((prev) => (prev === scrollAnchorLetter ? prev : scrollAnchorLetter));
    lastScrolledLetterRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScrubbing, lettersKey, scrollAnchorLetter]);

  const visibleLetters = useMemo(() => {
    if (!letters.length || !anchorLetter) return [];
    const activeIdx = letters.indexOf(anchorLetter);
    if (activeIdx < 0) {
      return letters.slice(0, Math.min(letters.length, INDEX_RAIL_WINDOW_SIZE));
    }

    const start = activeIdx;
    const end = Math.min(letters.length - 1, activeIdx + INDEX_RAIL_WINDOW_SIZE - 1);
    return letters.slice(start, end + 1);
  }, [anchorLetter, letters]);

  const previewRight =
    LETTER_PREVIEW_OFFSET_X + (INDEX_RAIL_COLUMN_WIDTH - INDEX_RAIL_TOUCH_WIDTH) / 2;

  return (
    <View pointerEvents="box-none" style={styles.indexRailHost}>
      {isScrubbing && anchorLetter ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.letterPreview,
            {
              top: previewOffsetY - LETTER_PREVIEW_SIZE / 2,
              right: previewRight,
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderStrong,
              shadowColor: colors.text,
            },
            badgeAnimatedStyle,
          ]}
        >
          <Text style={[styles.letterPreviewText, { color: DASHBOARD_VALUE_GREEN }]}>
            {anchorLetter}
          </Text>
        </Animated.View>
      ) : null}

      <GestureDetector gesture={panGesture}>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel="Index alphabétique"
          accessibilityHint="Glisse le long des lettres pour naviguer par lettre"
          collapsable={false}
          style={styles.indexRail}
          onLayout={(event) => handleRailLayout(event.nativeEvent.layout.height)}
        >
          <View pointerEvents="none" style={styles.letterColumnWindow}>
            {visibleLetters.map((letter) => {
              const isHighlighted = letter === anchorLetter;
              return (
                <View key={letter} style={styles.letterSlot}>
                  <Text
                    style={[
                      styles.indexLetter,
                      { color: isHighlighted ? DASHBOARD_VALUE_GREEN : colors.textMuted },
                      isHighlighted && styles.indexLetterActive,
                    ]}
                  >
                    {letter}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

export function RegionPickerSheet({ visible, selectedId, onClose, onSelect }: Props) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<IndexedListItem>>(null);
  const isRailScrubbingRef = useRef(false);

  const [mode, setMode] = useState<ViewMode>('countries');
  const [activeCountryCode, setActiveCountryCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 200);
  const [locating, setLocating] = useState(false);
  const [locateHint, setLocateHint] = useState<string | null>(null);
  const [scrollAnchorLetter, setScrollAnchorLetter] = useState<string | null>('A');

  const backdropColor = useMemo(
    () => (isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)'),
    [isLight],
  );

  const resetState = useCallback(() => {
    setMode('countries');
    setActiveCountryCode(null);
    setSearchQuery('');
    setLocating(false);
    setLocateHint(null);
  }, []);

  useEffect(() => {
    if (!visible) {
      resetState();
    }
  }, [visible, resetState]);

  useEffect(() => {
    if (!visible || !isCountryOnlyRegionId(selectedId)) return;

    const { countryCode } = parseRegionId(selectedId);
    setActiveCountryCode(countryCode);
    setMode('regions');
    setLocateHint('Choisis ta province, état ou canton.');
  }, [visible, selectedId]);

  const isRootSearch = mode === 'countries' && debouncedSearchQuery.trim().length > 0;

  const listItems = useMemo(() => {
    if (mode === 'regions' && activeCountryCode) {
      return buildSubRegionList(activeCountryCode, debouncedSearchQuery);
    }
    if (isRootSearch) {
      return buildGlobalSearchList(debouncedSearchQuery);
    }
    return getCachedCountryList();
  }, [mode, activeCountryCode, debouncedSearchQuery, isRootSearch]);

  const letterIndex = useMemo(() => {
    if (mode !== 'countries') {
      return EMPTY_LETTER_INDEX;
    }
    const query = debouncedSearchQuery.trim();
    if (query) {
      const searchIndex = buildLetterIndex(buildGlobalSearchList(query));
      if (searchIndex.letters.length > 0) {
        return searchIndex;
      }
    }
    return getCachedCountryLetterIndex();
  }, [mode, debouncedSearchQuery]);

  const lettersKey = letterIndex.letters.join('\0');

  const defaultScrollAnchorLetter = useMemo(
    () => resolveDefaultRailAnchor(letterIndex.letters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lettersKey],
  );

  const showIndexRail = mode === 'countries';

  useEffect(() => {
    if (!visible || !showIndexRail) return;
    setScrollAnchorLetter((prev) => (prev === defaultScrollAnchorLetter ? prev : defaultScrollAnchorLetter));
  }, [debouncedSearchQuery, defaultScrollAnchorLetter, showIndexRail, visible]);

  const listRowLayout = useMemo(() => {
    let offset = 0;
    const offsets = listItems.map((item) => {
      const current = offset;
      offset += item.description ? LIST_ROW_HEIGHT_WITH_DESC : LIST_ROW_HEIGHT;
      return current;
    });
    const heights = listItems.map((item) =>
      item.description ? LIST_ROW_HEIGHT_WITH_DESC : LIST_ROW_HEIGHT,
    );
    return { offsets, heights };
  }, [listItems]);

  const getItemLayout = useCallback(
    (_list: ArrayLike<IndexedListItem> | null | undefined, index: number) => ({
      length: listRowLayout.heights[index] ?? LIST_ROW_HEIGHT,
      offset: listRowLayout.offsets[index] ?? index * LIST_ROW_HEIGHT,
      index,
    }),
    [listRowLayout],
  );

  const activeCountry = activeCountryCode ? getCountryByCode(activeCountryCode) : null;
  const sheetTitle =
    mode === 'regions' && activeCountry ? activeCountry.countryName : 'Région';

  const handleClose = useCallback(() => {
    tapHaptic();
    resetState();
    onClose();
  }, [onClose, resetState]);

  const handleBack = () => {
    tapHaptic();
    setMode('countries');
    setActiveCountryCode(null);
    setSearchQuery('');
    setLocateHint(null);
  };

  const handleSelectRegion = useCallback(
    (regionId: CountryRegion) => {
      tapHaptic();
      onSelect(regionId);
      handleClose();
    },
    [handleClose, onSelect],
  );

  const handleSelectCountry = useCallback(
    (countryCode: string) => {
      tapHaptic();
      const country = getCountryByCode(countryCode);
      if (country?.regions?.length) {
        setActiveCountryCode(countryCode);
        setMode('regions');
        setSearchQuery('');
        setLocateHint(null);
        return;
      }
      handleSelectRegion(countryCode as CountryRegion);
    },
    [handleSelectRegion],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: IndexedListItem; index: number }) => (
      <RegionPickerRow
        item={item}
        index={index}
        listLength={listItems.length}
        selectedId={selectedId}
        mode={mode}
        borderColor={colors.border}
        borderStrongColor={colors.borderStrong}
        textColor={colors.text}
        mutedColor={colors.textMuted}
        primaryColor={colors.primary}
        onSelectRegion={handleSelectRegion}
        onSelectCountry={handleSelectCountry}
      />
    ),
    [
      colors.border,
      colors.borderStrong,
      colors.primary,
      colors.text,
      colors.textMuted,
      handleSelectCountry,
      handleSelectRegion,
      listItems.length,
      mode,
      selectedId,
    ],
  );

  const handleLocateMe = async () => {
    tapHaptic();
    setLocating(true);
    setLocateHint(null);

    const result = await detectCountryRegion();
    setLocating(false);

    if (!result.regionId) {
      setLocateHint('Impossible de détecter ta région.');
      return;
    }

    const { countryCode, regionCode } = parseRegionId(result.regionId);
    const country = getCountryByCode(countryCode);

    if (country?.regions?.length && regionCode) {
      handleSelectRegion(result.regionId);
      return;
    }

    if (country?.regions?.length && !regionCode) {
      setActiveCountryCode(countryCode);
      setMode('regions');
      setSearchQuery('');
      setLocateHint('Pays détecté — choisis ta province ou état.');
      return;
    }

    handleSelectRegion(result.regionId);
  };

  const scrollToLetter = useCallback(
    (letter: string, animated = true) => {
      const index = letterIndex.indexByLetter[letter];
      if (index == null) return;
      tapHaptic();
      listRef.current?.scrollToIndex({ index, animated, viewOffset: 0 });
    },
    [letterIndex.indexByLetter],
  );

  const handleRailScrubbingChange = useCallback((scrubbing: boolean) => {
    isRailScrubbingRef.current = scrubbing;
  }, []);

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isRailScrubbingRef.current || !showIndexRail) return;

      const offsetY = event.nativeEvent.contentOffset.y;
      const { letters } = letterIndex;

      if (offsetY <= LIST_TOP_ANCHOR_THRESHOLD) {
        const topAnchor = resolveDefaultRailAnchor(letters);
        setScrollAnchorLetter((prev) => (prev === topAnchor ? prev : topAnchor));
        return;
      }

      const index = findFirstVisibleIndexForOffset(offsetY, listRowLayout.offsets);
      const item = listItems[index];
      if (!item) return;

      const letter = normalizeSortLetter(item.sortKey);
      if (!letters.includes(letter)) return;

      setScrollAnchorLetter((prev) => (prev === letter ? prev : letter));
    },
    // letterIndex is read from the render that produced lettersKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lettersKey, listItems, listRowLayout.offsets, showIndexRail],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <GestureHandlerRootView style={styles.modalRoot}>
        <View style={[styles.backdrop, { backgroundColor: backdropColor }]}>
          <RNPressable
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
            accessibilityLabel="Fermer"
          />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.containerBackground,
                borderColor: colors.containerBorder,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />

            <View style={styles.header} pointerEvents="box-none">
              {mode === 'regions' ? (
                <RNPressable
                  accessibilityRole="button"
                  accessibilityLabel="Retour aux pays"
                  onPress={handleBack}
                  hitSlop={HEADER_BUTTON_HIT_SLOP}
                  style={({ pressed }) => [
                    styles.backButton,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
                </RNPressable>
              ) : (
                <View style={styles.backPlaceholder} pointerEvents="none" />
              )}
              <Text
                style={[styles.title, { color: colors.text }]}
                numberOfLines={1}
                pointerEvents="none"
              >
                {sheetTitle}
              </Text>
              <RNPressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                onPress={handleClose}
                hitSlop={HEADER_BUTTON_HIT_SLOP}
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </RNPressable>
            </View>

            <View
              style={[
                styles.searchWrap,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Rechercher…"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
            </View>

            <RNPressable
              accessibilityRole="button"
              accessibilityLabel="Me localiser"
              disabled={locating}
              onPress={() => void handleLocateMe()}
              hitSlop={10}
              style={({ pressed }) => [
                styles.locateRow,
                pressed && styles.pressed,
                locating && styles.disabled,
              ]}
            >
              {locating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="locate-outline" size={18} color={colors.primary} />
              )}
              <Text style={[styles.locateLabel, { color: colors.primary }]}>Me localiser</Text>
            </RNPressable>

            {locateHint ? (
              <Text style={[styles.locateHint, { color: colors.textMuted }]}>{locateHint}</Text>
            ) : null}

            <View style={styles.listWrap} pointerEvents="box-none">
              <FlatList
                ref={listRef}
                style={[styles.list, showIndexRail && styles.listWithIndexRail]}
                data={listItems}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                getItemLayout={getItemLayout}
                initialNumToRender={16}
                maxToRenderPerBatch={12}
                windowSize={9}
                removeClippedSubviews={Platform.OS !== 'web'}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={handleListScroll}
                contentContainerStyle={[
                  styles.listContent,
                  showIndexRail && styles.listContentWithIndexRail,
                ]}
                onScrollToIndexFailed={({ index }) => {
                  const offset = listRowLayout.offsets[index] ?? index * LIST_ROW_HEIGHT;
                  listRef.current?.scrollToOffset({ offset, animated: true });
                }}
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                      Aucun résultat pour « {searchQuery} »
                    </Text>
                  </View>
                }
              />

              {showIndexRail ? (
                <AlphabetIndexRail
                  letters={letterIndex.letters}
                  scrollAnchorLetter={scrollAnchorLetter}
                  onScrollToLetter={scrollToLetter}
                  onScrubbingChange={handleRailScrubbingChange}
                  colors={colors}
                />
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboard: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.card + 4,
    borderTopRightRadius: radius.card + 4,
    borderWidth: 1,
    height: SHEET_HEIGHT_PERCENT,
    maxHeight: SHEET_HEIGHT_PERCENT,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    position: 'relative',
    zIndex: 10,
    elevation: 10,
  },
  backButton: {
    minWidth: HEADER_BUTTON_SIZE,
    minHeight: HEADER_BUTTON_SIZE,
    width: HEADER_BUTTON_SIZE,
    height: HEADER_BUTTON_SIZE,
    borderRadius: HEADER_BUTTON_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: HEADER_BUTTON_SIZE,
    height: HEADER_BUTTON_SIZE,
  },
  title: {
    ...interBoldText,
    fontSize: typography.body,
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    minWidth: HEADER_BUTTON_SIZE,
    minHeight: HEADER_BUTTON_SIZE,
    width: HEADER_BUTTON_SIZE,
    height: HEADER_BUTTON_SIZE,
    borderRadius: HEADER_BUTTON_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    ...interMediumText,
    fontSize: typography.body,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
  },
  locateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    minHeight: 36,
    paddingVertical: spacing.sm,
  },
  locateLabel: {
    ...interMediumText,
    fontSize: typography.meta,
  },
  locateHint: {
    ...interMediumText,
    fontSize: typography.micro,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  listWrap: {
    flex: 1,
    flexShrink: 1,
    minHeight: 280,
    position: 'relative',
    overflow: 'visible',
  },
  list: {
    flex: 1,
  },
  listWithIndexRail: {
    marginRight: INDEX_RAIL_COLUMN_WIDTH,
  },
  indexRailHost: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: INDEX_RAIL_COLUMN_WIDTH,
    zIndex: 10,
    elevation: 10,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  listContent: {
    paddingBottom: spacing.sm,
  },
  listContentWithIndexRail: {
    paddingRight: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: UNIFORM_ROW_MIN_HEIGHT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  optionLabel: {
    ...interSemiboldText,
    fontSize: typography.body,
  },
  optionDescription: {
    ...interMediumText,
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
  indexRail: {
    flex: 1,
    width: INDEX_RAIL_TOUCH_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  letterColumnWindow: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: INDEX_RAIL_LETTER_GAP,
  },
  letterSlot: {
    height: INDEX_RAIL_LETTER_SLOT_HEIGHT,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexLetter: {
    ...interSemiboldText,
    fontSize: 10,
    lineHeight: 12,
    opacity: 0.72,
  },
  indexLetterActive: {
    ...interBoldText,
    fontSize: 11,
    lineHeight: 13,
    opacity: 1,
  },
  letterPreview: {
    position: 'absolute',
    width: LETTER_PREVIEW_SIZE,
    height: LETTER_PREVIEW_SIZE,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  letterPreviewText: {
    ...interBoldText,
    fontSize: typography.heroStat,
    lineHeight: typography.heroStat + 2,
  },
  emptyWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...interMediumText,
    fontSize: typography.body,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.55,
  },
});

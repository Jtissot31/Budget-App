import { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import {
  DraggableSheetScrollView,
  DraggableSheetSurface,
} from '@/components/DraggableSheetSurface';
import { FormSheetModalBody, formSheetScrollViewStyle, useFormSheetHeight } from '@/lib/sheet/formSheetScroll';
import { RemoteLogoImage } from '@/components/IconFrame';
import { accentForKey } from '@/components/kit/charts';
import { PressScale, Reveal } from '@/components/kit/motion';
import { ProtoSearchField } from '@/components/proto/ProtoSearchToolbar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  jakartaBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  spacing,
  typography,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

/** Leading logo / glyph tile — must match `RemoteLogoImage` size for centered contain. */
export const PICKER_LEADING_TILE_SIZE = 40;
/** Closed `SettingsSelectField` trigger — matches budget category well. */
export const FIELD_LEADING_TILE_SIZE = 32;
/** Compact picker tiles need a larger logo fill than the default 68% well inset. */
const PICKER_LOGO_INSET_RATIO = 0.9;
/** Wide card-network wordmarks (Visa, etc.) read better with almost full-tile fill. */
const PICKER_CARD_NETWORK_LOGO_INSET_RATIO = 0.96;
/** Show the search field once a list is long enough that scanning gets slow. */
const SEARCH_THRESHOLD = 8;
/** Let the selection state register visually before the sheet slides away. */
const CLOSE_AFTER_SELECT_MS = 140;

const CARD_NETWORK_LOGO_URI_RE = /visa|mastercard|amex|americanexpress|discover/i;

function pickerLogoInsetRatio(logoUrl: string, label?: string | null): number {
  const haystack = `${logoUrl} ${label ?? ''}`;
  return CARD_NETWORK_LOGO_URI_RE.test(haystack)
    ? PICKER_CARD_NETWORK_LOGO_INSET_RATIO
    : PICKER_LOGO_INSET_RATIO;
}

/** Accent-insensitive, case-insensitive match (« epicerie » finds « Épicerie »). */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export type SettingsPickerOption<T extends string> = {
  id: T;
  label: string;
  description?: string;
  /**
   * Closed-field label for `SettingsSelectField` when `label` is the sheet
   * primary line (e.g. account name without last4).
   */
  fieldLabel?: string;
  /** Ionicons leading glyph for account / generic rows. */
  icon?: string | null;
  /** Institution / merchant logo URI — preferred over `icon` when available. */
  logoUrl?: string | null;
  /** Bundled require() module — preferred over logoUrl in release APKs. */
  logoAsset?: number | null;
  /** Renders a budget category glyph (tinted with the category accent). */
  budgetCategoryIcon?: {
    icon?: string | null;
    name?: string;
  };
};

type Props<T extends string> = {
  visible: boolean;
  title: string;
  options: SettingsPickerOption<T>[];
  selectedId: T;
  onClose: () => void;
  onSelect: (id: T) => void;
};

export function PickerLeadingTile({
  icon,
  logoUrl,
  logoAsset,
  label,
  iconColor,
  wellBackground,
  size = PICKER_LEADING_TILE_SIZE,
}: {
  icon?: string | null;
  logoUrl?: string | null;
  /** Bundled require() module — preferred in release APKs over logoUrl Asset URIs. */
  logoAsset?: number | null;
  label?: string | null;
  iconColor: string;
  wellBackground: string;
  /** @deprecated Wells are borderless now; kept so existing callers still type-check. */
  defaultBorder?: string;
  /** Tile edge length — sheet rows use 40, closed field uses 32. */
  size?: number;
}) {
  const uri = logoUrl?.trim() || null;
  const [logoFailed, setLogoFailed] = useState(false);
  const [assetFailed, setAssetFailed] = useState(false);
  const glyphSize = Math.round(size * 0.48);

  useEffect(() => {
    setLogoFailed(false);
    setAssetFailed(false);
  }, [uri, logoAsset]);

  const preferAsset = logoAsset != null && !assetFailed;
  const showLogo = preferAsset || (Boolean(uri) && !logoFailed);

  if (!showLogo && !icon) return null;

  // Remote logos sit on a transparent tile; glyph-only wells keep a soft fill.
  return (
    <View
      style={[
        styles.iconWell,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.3),
          backgroundColor: showLogo ? 'transparent' : wellBackground,
        },
      ]}
    >
      {preferAsset && logoAsset != null ? (
        <RemoteLogoImage
          asset={logoAsset}
          size={size}
          insetRatio={PICKER_CARD_NETWORK_LOGO_INSET_RATIO}
          onError={() => setAssetFailed(true)}
        />
      ) : showLogo && uri ? (
        <RemoteLogoImage
          uri={uri}
          size={size}
          insetRatio={pickerLogoInsetRatio(uri, label)}
          onError={() => setLogoFailed(true)}
        />
      ) : icon ? (
        <AppIcon family="ionicons" name={icon} size={glyphSize} color={iconColor} />
      ) : null}
    </View>
  );
}

/**
 * Bottom-sheet picker.
 * - Category options (all carry `budgetCategoryIcon`) → colour-coded icon grid,
 *   with the « Suggestion » option pinned as a one-tap shortcut.
 * - Everything else (accounts, settings) → one grouped list with a check on the selection.
 * Long lists get an accent-insensitive search field.
 */
export function SettingsPickerSheet<T extends string>({
  visible,
  title,
  options,
  selectedId,
  onClose,
  onSelect,
}: Props<T>) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sheetHeight = useFormSheetHeight(0.78);
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<T | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setPendingId(null);
  }, [visible]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const isCategoryGrid = options.length > 0 && options.every((option) => option.budgetCategoryIcon);
  const showSearch = options.length > SEARCH_THRESHOLD;
  const activeId = pendingId ?? selectedId;

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter(
      (option) =>
        normalize(option.label).includes(q) || (option.description ? normalize(option.description).includes(q) : false),
    );
  }, [options, query]);

  // Category suggestion (flagged by BudgetCategoryPicker) is pinned above the grid when not searching.
  const suggestion = isCategoryGrid && !query ? (filtered.find((o) => o.description === 'Suggestion') ?? null) : null;
  const gridOptions = suggestion ? filtered.filter((o) => o.id !== suggestion.id) : filtered;

  const backdropColor = isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)';
  const groupSurface = { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder };

  const handleSelect = (id: T) => {
    if (pendingId) return;
    tapHaptic();
    setPendingId(id);
    onSelect(id);
    closeTimer.current = setTimeout(onClose, CLOSE_AFTER_SELECT_MS);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.backdrop, { backgroundColor: backdropColor }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
          <FormSheetModalBody>
            <DraggableSheetSurface
              onClose={onClose}
              sheetHeight={sheetHeight}
              style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.containerBorder }]}
            >
              <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel="Fermer"
                  onPress={onClose}
                  hitSlop={12}
                  scaleTo={0.88}
                  style={[styles.closeButton, { backgroundColor: colors.surfaceElevated }]}
                >
                  <AppIcon family="ionicons" name="close" size={18} color={colors.text} />
                </PressScale>
              </View>

              {showSearch ? (
                <View style={styles.search}>
                  <ProtoSearchField
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Rechercher"
                    accessibilityLabel={`Rechercher dans ${title.toLowerCase()}`}
                  />
                </View>
              ) : null}

              <DraggableSheetScrollView
                style={[styles.list, formSheetScrollViewStyle()]}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: Math.max(insets.bottom, spacing.md) + 48 },
                ]}
              >
                {filtered.length === 0 ? (
                  <Text style={[styles.empty, { color: colors.textMuted }]}>Aucun résultat pour « {query.trim()} »</Text>
                ) : isCategoryGrid ? (
                  <>
                    {suggestion ? (
                      <Reveal index={0}>
                        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>Suggestion</Text>
                        <PressScale
                          accessibilityRole="button"
                          accessibilityState={{ selected: suggestion.id === activeId }}
                          accessibilityLabel={`${suggestion.label}, suggestion`}
                          onPress={() => handleSelect(suggestion.id)}
                          scaleTo={0.97}
                          style={[
                            styles.suggestion,
                            groupSurface,
                            suggestion.id === activeId && { borderColor: accentForKey(suggestion.id) },
                          ]}
                        >
                          <BudgetCategoryIcon
                            icon={suggestion.budgetCategoryIcon?.icon}
                            name={suggestion.budgetCategoryIcon?.name ?? suggestion.label}
                            id={suggestion.id}
                            tint={accentForKey(suggestion.id)}
                            wellSize={40}
                            glyphSize={19}
                          />
                          <View style={styles.rowCopy}>
                            <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                              {suggestion.label}
                            </Text>
                            <Text style={[styles.rowDescription, { color: colors.textMuted }]} numberOfLines={1}>
                              Suggérée pour cette transaction
                            </Text>
                          </View>
                          <SelectionMark selected={suggestion.id === activeId} color={colors.accentGreen} />
                        </PressScale>
                        <Text style={[styles.groupLabel, styles.groupLabelSpaced, { color: colors.textMuted }]}>
                          Toutes les catégories
                        </Text>
                      </Reveal>
                    ) : null}

                    <View style={styles.grid}>
                      {gridOptions.map((option, index) => {
                        const selected = option.id === activeId;
                        const accent = accentForKey(option.id);
                        return (
                          <Reveal key={option.id} index={index + 1} style={styles.gridCell}>
                            <PressScale
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                              accessibilityLabel={option.label}
                              onPress={() => handleSelect(option.id)}
                              scaleTo={0.94}
                              style={[
                                styles.tile,
                                groupSurface,
                                selected && { borderColor: accent, backgroundColor: `${accent}1F` },
                              ]}
                            >
                              <BudgetCategoryIcon
                                icon={option.budgetCategoryIcon?.icon}
                                name={option.budgetCategoryIcon?.name ?? option.label}
                                id={option.id}
                                tint={accent}
                                wellSize={44}
                                glyphSize={21}
                              />
                              <Text style={[styles.tileLabel, { color: colors.text }]} numberOfLines={2}>
                                {option.label}
                              </Text>
                              {selected ? (
                                <View style={[styles.tileCheck, { backgroundColor: accent }]}>
                                  <AppIcon family="ionicons" name="checkmark" size={12} color="#FFFFFF" />
                                </View>
                              ) : null}
                            </PressScale>
                          </Reveal>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <Reveal style={[styles.group, groupSurface]}>
                    {filtered.map((option, index) => {
                      const selected = option.id === activeId;
                      const isLast = index === filtered.length - 1;
                      return (
                        <PressScale
                          key={option.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={option.description ? `${option.label}, ${option.description}` : option.label}
                          onPress={() => handleSelect(option.id)}
                          scaleTo={0.98}
                          style={[styles.row, selected && { backgroundColor: colors.surfaceElevated }]}
                        >
                          {option.budgetCategoryIcon ? (
                            <BudgetCategoryIcon
                              icon={option.budgetCategoryIcon.icon}
                              name={option.budgetCategoryIcon.name ?? option.label}
                              id={option.id}
                              tint={accentForKey(option.id)}
                              wellSize={PICKER_LEADING_TILE_SIZE}
                              glyphSize={19}
                            />
                          ) : (
                            <PickerLeadingTile
                              icon={option.icon}
                              logoUrl={option.logoUrl}
                              logoAsset={option.logoAsset}
                              label={option.label}
                              iconColor={colors.text}
                              wellBackground={colors.surfaceElevated}
                            />
                          )}
                          <View style={styles.rowCopy}>
                            <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                              {option.label}
                            </Text>
                            {option.description ? (
                              <Text style={[styles.rowDescription, { color: colors.textMuted }]} numberOfLines={1}>
                                {option.description}
                              </Text>
                            ) : null}
                          </View>
                          <SelectionMark selected={selected} color={colors.accentGreen} />
                          {!isLast ? (
                            <View
                              pointerEvents="none"
                              style={[styles.divider, { backgroundColor: colors.borderSubtle }]}
                            />
                          ) : null}
                        </PressScale>
                      );
                    })}
                  </Reveal>
                )}
              </DraggableSheetScrollView>
            </DraggableSheetSurface>
          </FormSheetModalBody>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Check for the selected row; an equal-width spacer otherwise so labels never shift. */
function SelectionMark({ selected, color }: { selected: boolean; color: string }) {
  return (
    <View style={styles.mark}>
      {selected ? <AppIcon family="ionicons" name="checkmark-circle" size={22} color={color} /> : null}
    </View>
  );
}

const ROW_PAD_H = 14;

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1 },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  title: { ...jakartaBoldText, fontSize: 22, letterSpacing: -0.3, flexShrink: 1 },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  search: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  list: { flex: 1, minHeight: 0 },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: 2 },
  empty: { ...jakartaMediumText, fontSize: typography.meta, textAlign: 'center', paddingVertical: spacing.xl },
  groupLabel: { ...jakartaSemiboldText, fontSize: 12, letterSpacing: 0.2, marginBottom: spacing.sm, marginLeft: 2 },
  groupLabelSpaced: { marginTop: spacing.lg },

  /* Category grid */
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: ROW_PAD_H,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  gridCell: { width: '33.333%', paddingHorizontal: 5, paddingBottom: 10 },
  tile: {
    alignItems: 'center',
    gap: 8,
    minHeight: 104,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  tileLabel: { ...jakartaSemiboldText, fontSize: 12.5, lineHeight: 16, textAlign: 'center' },
  tileCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Grouped list */
  group: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: ROW_PAD_H,
    paddingVertical: 12,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { ...jakartaSemiboldText, fontSize: typography.body, flexShrink: 1 },
  rowDescription: { ...jakartaMediumText, fontSize: typography.micro, lineHeight: typography.micro + 4 },
  mark: { width: 22, alignItems: 'center' },
  divider: {
    position: 'absolute',
    left: ROW_PAD_H + PICKER_LEADING_TILE_SIZE + 12,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  iconWell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
});

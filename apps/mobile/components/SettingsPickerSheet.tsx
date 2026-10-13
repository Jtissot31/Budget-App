import { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { jakartaBoldText, jakartaMediumText, jakartaSemiboldText, spacing, typography } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

/** Leading logo / glyph tile — must match `RemoteLogoImage` size for centered contain. */
export const PICKER_LEADING_TILE_SIZE = 32;
/** Closed `SettingsSelectField` trigger — matches budget category well. */
export const FIELD_LEADING_TILE_SIZE = 24;
/** Compact picker tiles need a larger logo fill than the default 68% well inset. */
const PICKER_LOGO_INSET_RATIO = 0.9;
/** Wide card-network wordmarks (Visa, etc.) read better with almost full-tile fill. */
const PICKER_CARD_NETWORK_LOGO_INSET_RATIO = 0.96;
/** Show the search field once a list is long enough that scanning gets slow. */
const SEARCH_THRESHOLD = 8;
/** Let the check register visually before the sheet slides away. */
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
  size?: number;
}) {
  const uri = logoUrl?.trim() || null;
  const [logoFailed, setLogoFailed] = useState(false);
  const [assetFailed, setAssetFailed] = useState(false);
  const glyphSize = Math.round(size * 0.55);

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
 * Minimal bottom-sheet picker: plain rows on the sheet (no cards, borders or dividers),
 * a small leading glyph or logo, and a single check on the selection.
 * Categories get their accent colour on the glyph and the « Suggestion » pinned on top;
 * long lists get a quiet, accent-insensitive search pill.
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

  const isCategoryList = options.length > 0 && options.every((option) => option.budgetCategoryIcon);
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

  // Category suggestion (flagged by BudgetCategoryPicker) is pinned on top when not searching.
  const suggestion = isCategoryList && !query ? (filtered.find((o) => o.description === 'Suggestion') ?? null) : null;
  const rest = suggestion ? filtered.filter((o) => o.id !== suggestion.id) : filtered;

  const handleSelect = (id: T) => {
    if (pendingId) return;
    tapHaptic();
    setPendingId(id);
    onSelect(id);
    closeTimer.current = setTimeout(onClose, CLOSE_AFTER_SELECT_MS);
  };

  const renderRow = (option: SettingsPickerOption<T>) => {
    const selected = option.id === activeId;
    // Category hint text is redundant once it has its own « Suggestion » header.
    const description = isCategoryList ? undefined : option.description;
    return (
      <PressScale
        key={option.id}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={description ? `${option.label}, ${description}` : option.label}
        onPress={() => handleSelect(option.id)}
        scaleTo={0.98}
        style={styles.row}
      >
        <View style={styles.leading}>
          {option.budgetCategoryIcon ? (
            <BudgetCategoryIcon
              icon={option.budgetCategoryIcon.icon}
              name={option.budgetCategoryIcon.name ?? option.label}
              id={option.id}
              tint={accentForKey(option.id)}
              bare
              wellSize={PICKER_LEADING_TILE_SIZE}
              glyphSize={20}
            />
          ) : (
            <PickerLeadingTile
              icon={option.icon}
              logoUrl={option.logoUrl}
              logoAsset={option.logoAsset}
              label={option.label}
              iconColor={colors.textSecondary}
              wellBackground="transparent"
            />
          )}
        </View>
        <View style={styles.rowCopy}>
          <Text
            style={[selected ? styles.rowLabelSelected : styles.rowLabel, { color: colors.text }]}
            numberOfLines={1}
          >
            {option.label}
          </Text>
          {description ? (
            <Text style={[styles.rowDescription, { color: colors.textMuted }]} numberOfLines={1}>
              {description}
            </Text>
          ) : null}
        </View>
        <View style={styles.mark}>
          {selected ? <AppIcon family="ionicons" name="checkmark" size={20} color={colors.text} /> : null}
        </View>
      </PressScale>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.backdrop, { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
          <FormSheetModalBody>
            <DraggableSheetSurface
              onClose={onClose}
              sheetHeight={sheetHeight}
              style={[styles.sheet, { backgroundColor: colors.background }]}
            >
              <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onClose} hitSlop={14}>
                  <AppIcon family="ionicons" name="close" size={22} color={colors.textMuted} />
                </Pressable>
              </View>

              {showSearch ? (
                <View style={[styles.search, { backgroundColor: colors.surfaceElevated }]}>
                  <AppIcon family="ionicons" name="search" size={16} color={colors.textMuted} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Rechercher"
                    placeholderTextColor={colors.textMuted}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                    accessibilityLabel={`Rechercher dans ${title.toLowerCase()}`}
                    style={[styles.searchInput, { color: colors.text }]}
                  />
                  {query ? (
                    <Pressable accessibilityLabel="Effacer" hitSlop={10} onPress={() => setQuery('')}>
                      <AppIcon family="ionicons" name="close-circle" size={16} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <DraggableSheetScrollView
                style={[styles.list, formSheetScrollViewStyle()]}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.md) + 40 }}
              >
                <Reveal>
                  {filtered.length === 0 ? (
                    <Text style={[styles.empty, { color: colors.textMuted }]}>
                      Aucun résultat pour « {query.trim()} »
                    </Text>
                  ) : (
                    <>
                      {suggestion ? (
                        <>
                          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Suggestion</Text>
                          {renderRow(suggestion)}
                          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced, { color: colors.textMuted }]}>
                            Toutes les catégories
                          </Text>
                        </>
                      ) : null}
                      {rest.map(renderRow)}
                    </>
                  )}
                </Reveal>
              </DraggableSheetScrollView>
            </DraggableSheetSurface>
          </FormSheetModalBody>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const PAD_H = spacing.lg;

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: spacing.sm, marginBottom: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD_H,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  title: { ...jakartaBoldText, fontSize: 20, letterSpacing: -0.3, flexShrink: 1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    marginHorizontal: PAD_H,
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  searchInput: { flex: 1, ...jakartaMediumText, fontSize: typography.body, paddingVertical: 0 },
  list: { flex: 1, minHeight: 0 },
  empty: { ...jakartaMediumText, fontSize: typography.meta, textAlign: 'center', paddingVertical: spacing.xl },
  sectionLabel: {
    ...jakartaMediumText,
    fontSize: 12,
    paddingHorizontal: PAD_H,
    marginTop: spacing.xs,
    marginBottom: 2,
  },
  sectionLabelSpaced: { marginTop: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 54,
    paddingHorizontal: PAD_H,
    paddingVertical: 10,
  },
  leading: { width: PICKER_LEADING_TILE_SIZE, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: 1 },
  rowLabel: { ...jakartaMediumText, fontSize: typography.body },
  rowLabelSelected: { ...jakartaBoldText, fontSize: typography.body },
  rowDescription: { ...jakartaMediumText, fontSize: 12.5 },
  mark: { width: 22, alignItems: 'flex-end' },
  iconWell: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
});

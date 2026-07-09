import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { AppIcon } from '@/components/icons/AppIcon';
import { MdiIcon } from '@/components/MdiIcon';
import { RemoteLogoImage } from '@/components/IconFrame';
import type { IconName } from '@/constants/categoryOptions';
import { jakartaSemiboldText } from '@/constants/theme';
import { EXPENSE_DEFAULT_ICON, type ExpenseFallbackIcon } from '@/lib/expenseIcon';
import { isDesignSystemLucideIcon } from '@/lib/iconMigration/designSystemIconSelection';
import { resolveLucideNameForLegacy } from '@/lib/iconMigration/iconMap';
import { getMerchantLogoUrls, merchantInitials } from '@/lib/merchantLogo';
import {
  EXPENSE_MDI_ICON,
  resolveMdiOrLegacyIcon,
  resolveStoredIconToMdi,
  WELL_GLYPH_WHITE,
} from '@/lib/mdiIconCatalog';
import {
  logoIconWellStyle,
  normalizeUserIconColor,
  resolveUserPickedIconGlyphColor,
  userPickedIconGlyphSize,
  userPickedIconWellStyle,
} from '@/lib/userPickedIcon';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  icon: IconName | ExpenseFallbackIcon | string;
  color?: string | null;
  size?: number;
  iconSize?: number;
  /** Force white glyphs inside the well (debts, recurring payments). */
  wellGlyphWhite?: boolean;
  /** Pre-resolved logo URL (stored recurring logo or merchant favicon). */
  logoUrl?: string | null;
  /** Merchant label for multi-URL fallback chain (transaction history rows). */
  merchantLabel?: string | null;
  /** Full-bleed cover image (contact photos in transaction rows). */
  coverImageUri?: string | null;
  /**
   * Transparent frameless mode — no charcoal well, border, or logo clipping.
   * Remote logos use the full box with `contain` (calendar day markers).
   */
  noBackground?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Icon well rendering shared with transaction history (`TransactionAvatar`). */
export function UserPickedIconWell({
  icon,
  color,
  size = 38,
  iconSize,
  wellGlyphWhite = false,
  logoUrl,
  merchantLabel,
  coverImageUri,
  noBackground = false,
  style,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const trimmedCover = coverImageUri?.trim() ?? '';
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    setCoverFailed(false);
  }, [trimmedCover]);

  const chainUrls = useMemo(
    () => (merchantLabel ? getMerchantLogoUrls(merchantLabel) : []),
    [merchantLabel],
  );

  const urls = useMemo(() => {
    const direct = logoUrl?.trim();
    if (direct) return [direct];
    return chainUrls;
  }, [logoUrl, chainUrls]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [giveUp, setGiveUp] = useState(false);

  useEffect(() => {
    setSourceIndex(0);
    setGiveUp(false);
  }, [urls]);

  const uri = urls[sourceIndex];
  const showRemote = Boolean(uri) && !giveUp;
  const computedIconSize = userPickedIconGlyphSize(size, iconSize);
  const categoryTint = normalizeUserIconColor(color);
  const glyphColor = wellGlyphWhite
    ? WELL_GLYPH_WHITE
    : resolveUserPickedIconGlyphColor(categoryTint, isLight, colors);
  const mdiName = resolveStoredIconToMdi(icon) ?? resolveMdiOrLegacyIcon(icon);
  const materialCommunityLucide = resolveLucideNameForLegacy('material-community', icon);
  const useMaterialCommunityAppIcon =
    materialCommunityLucide != null && isDesignSystemLucideIcon(materialCommunityLucide);
  const isExpenseBag = icon === EXPENSE_DEFAULT_ICON || icon === EXPENSE_MDI_ICON;
  const bagSize = Math.round(size * 0.4);
  const showCover = Boolean(trimmedCover) && !coverFailed;
  const isKnownMerchant = chainUrls.length > 0;
  const showMerchantInitials =
    Boolean(merchantLabel?.trim()) &&
    isKnownMerchant &&
    !showCover &&
    !showRemote &&
    (giveUp || urls.length === 0);

  const wellStyle = useMemo(() => {
    if (noBackground) {
      return {
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        backgroundColor: 'transparent' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        overflow: 'visible' as const,
      };
    }

    const base =
      showRemote
        ? logoIconWellStyle(size, isLight)
        : userPickedIconWellStyle(size, isLight);
    const withCover = showCover ? { ...base, borderRadius: size / 2 } : base;
    return showRemote ? { ...withCover, position: 'relative' as const } : withCover;
  }, [isLight, noBackground, showCover, showRemote, size]);

  return (
    <View style={[wellStyle, styles.wrap, style]}>
      {showCover ? (
        <Image
          source={{ uri: trimmedCover }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={trimmedCover}
          onError={() => setCoverFailed(true)}
        />
      ) : showRemote && uri ? (
        <RemoteLogoImage
          uri={uri}
          size={size}
          fullSize={noBackground}
          recyclingKey={uri}
          onError={() => {
            if (sourceIndex < urls.length - 1) {
              setSourceIndex((i) => i + 1);
            } else {
              setGiveUp(true);
            }
          }}
        />
      ) : showMerchantInitials ? (
        <Text
          style={[
            styles.initials,
            jakartaSemiboldText,
            { color: colors.textMuted, fontSize: Math.max(11, size * 0.32) },
          ]}
          numberOfLines={1}
        >
          {merchantInitials(merchantLabel ?? '')}
        </Text>
      ) : isExpenseBag ? (
        <MdiIcon
          name={EXPENSE_MDI_ICON}
          size={bagSize}
          color={wellGlyphWhite ? WELL_GLYPH_WHITE : glyphColor}
        />
      ) : resolveStoredIconToMdi(icon) ? (
        <MdiIcon
          name={mdiName}
          size={mdiName === EXPENSE_MDI_ICON || mdiName === 'SwapHoriz' ? bagSize : computedIconSize}
          color={glyphColor}
        />
      ) : useMaterialCommunityAppIcon ? (
        <AppIcon
          family="material-community"
          name={icon}
          size={computedIconSize}
          color={glyphColor}
        />
      ) : (
        <AppIcon family="ionicons" name={icon as IconName} size={computedIconSize} color={glyphColor} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initials: {
    letterSpacing: -0.3,
    textAlign: 'center',
  },
});

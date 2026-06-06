import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { MdiIconGlyph } from '@/components/MdiIconGlyph';
import { getMerchantLogoUrls } from '@/lib/merchantLogo';
import { EXPENSE_MDI_ICON, resolveMdiOrLegacyIcon } from '@/lib/mdiIconCatalog';
import { ICON_WELL_SIZE } from '@/constants/theme';
import {
  logoIconWellStyle,
  userPickedIconGlyphSize,
  userPickedIconLogoSize,
  userPickedIconWellStyle,
} from '@/lib/userPickedIcon';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  name: string;
  logoUrl?: string | null;
  icon?: string | null;
  useAutoLogo?: boolean;
  size?: number;
};

export function MerchantLogo({
  name,
  logoUrl,
  icon,
  useAutoLogo = true,
  size = ICON_WELL_SIZE,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const autoUrls = useMemo(() => getMerchantLogoUrls(name), [name]);
  const resolvedIcon = resolveMdiOrLegacyIcon(icon ?? EXPENSE_MDI_ICON);

  const manualLogoUrl = !useAutoLogo ? logoUrl?.trim() || null : null;
  const remoteUrls = useMemo(() => {
    if (manualLogoUrl) return [manualLogoUrl];
    if (useAutoLogo) return autoUrls;
    return [];
  }, [autoUrls, manualLogoUrl, useAutoLogo]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [giveUp, setGiveUp] = useState(false);

  useEffect(() => {
    setSourceIndex(0);
    setGiveUp(false);
  }, [remoteUrls]);

  const uri = remoteUrls[sourceIndex];
  const showRemote = Boolean(uri) && !giveUp;
  const logoSize = userPickedIconLogoSize(size);
  const glyphSize = userPickedIconGlyphSize(size, Math.max(18, size * 0.56));
  const wellStyle = showRemote && uri
    ? logoIconWellStyle(size, isLight)
    : userPickedIconWellStyle(size, isLight);

  return (
    <View style={[wellStyle, styles.wrap]}>
      {showRemote && uri ? (
        <Image
          source={{ uri }}
          style={{ width: logoSize, height: logoSize }}
          contentFit="contain"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          onError={() => {
            if (sourceIndex < remoteUrls.length - 1) {
              setSourceIndex((i) => i + 1);
            } else {
              setGiveUp(true);
            }
          }}
        />
      ) : icon || !useAutoLogo ? (
        <MdiIconGlyph name={resolvedIcon} size={glyphSize} color={colors.textMuted} />
      ) : (
        <Ionicons name="storefront-outline" size={glyphSize} color={colors.textMuted} />
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
});

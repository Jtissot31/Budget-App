import { useEffect, useMemo, useState } from 'react';

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Image } from 'expo-image';

import { Ionicons } from '@expo/vector-icons';

import { MdiIcon } from '@/components/MdiIcon';

import type { IconName } from '@/constants/categoryOptions';

import { EXPENSE_DEFAULT_ICON, type ExpenseFallbackIcon } from '@/lib/expenseIcon';

import { getMerchantLogoUrls } from '@/lib/merchantLogo';

import {

  EXPENSE_MDI_ICON,

  resolveMdiOrLegacyIcon,

  resolveStoredIconToMdi,

  WELL_GLYPH_WHITE,

} from '@/lib/mdiIconCatalog';

import {

  normalizeUserIconColor,

  resolveUserPickedIconGlyphColor,

  userPickedIconGlyphSize,

  userPickedIconLogoSize,

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

  style,

}: Props) {

  const { colors, isLight } = useAppTheme();

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

  const logoSize = userPickedIconLogoSize(size);

  const mdiName = resolveStoredIconToMdi(icon) ?? resolveMdiOrLegacyIcon(icon);

  const isExpenseBag = icon === EXPENSE_DEFAULT_ICON || icon === EXPENSE_MDI_ICON;

  const bagSize = Math.round(size * 0.4);



  return (

    <View style={[userPickedIconWellStyle(size, isLight), styles.wrap, style]}>

      {showRemote && uri ? (

        <Image

          source={{ uri }}

          style={{ width: logoSize, height: logoSize }}

          contentFit="contain"

          transition={150}

          cachePolicy="memory-disk"

          recyclingKey={uri}

          onError={() => {

            if (sourceIndex < urls.length - 1) {

              setSourceIndex((i) => i + 1);

            } else {

              setGiveUp(true);

            }

          }}

        />

      ) : isExpenseBag ? (

        <MdiIcon name={EXPENSE_MDI_ICON} size={bagSize} color={WELL_GLYPH_WHITE} />

      ) : resolveStoredIconToMdi(icon) ? (

        <MdiIcon

          name={mdiName}

          size={mdiName === EXPENSE_MDI_ICON ? bagSize : computedIconSize}

          color={glyphColor}

        />

      ) : (

        <Ionicons name={icon as IconName} size={computedIconSize} color={glyphColor} />

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



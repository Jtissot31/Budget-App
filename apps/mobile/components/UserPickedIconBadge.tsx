import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { LogoIconFrame } from '@/components/IconFrame';

import { MdiIcon } from '@/components/MdiIcon';

import type { IconName } from '@/constants/categoryOptions';

import { EXPENSE_DEFAULT_ICON, type ExpenseFallbackIcon } from '@/lib/expenseIcon';

import {

  EXPENSE_MDI_ICON,

  resolveMdiOrLegacyIcon,

  resolveStoredIconToMdi,

  WELL_GLYPH_WHITE,

} from '@/lib/mdiIconCatalog';

import {

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

  wellGlyphWhite?: boolean;

  logoUrl?: string | null;

  style?: StyleProp<ViewStyle>;

};



export function UserPickedIconBadge({

  icon,

  color,

  size = 46,

  iconSize,

  wellGlyphWhite = false,

  logoUrl,

  style,

}: Props) {

  const { colors, isLight } = useAppTheme();

  const uri = logoUrl?.trim() || null;



  if (uri) {

    return <LogoIconFrame uri={uri} size={size} style={style} />;

  }



  const glyphColor = wellGlyphWhite

    ? WELL_GLYPH_WHITE

    : resolveUserPickedIconGlyphColor(color, isLight, colors);

  const computedIconSize = userPickedIconGlyphSize(size, iconSize);

  const mdiName = resolveStoredIconToMdi(icon) ?? resolveMdiOrLegacyIcon(icon);

  const isExpenseBag = icon === EXPENSE_DEFAULT_ICON || icon === EXPENSE_MDI_ICON;

  const bagSize = Math.round(size * 0.4);



  return (

    <View style={[userPickedIconWellStyle(size, isLight), style]}>

      {isExpenseBag ? (

        <MdiIcon name={EXPENSE_MDI_ICON} size={bagSize} color={glyphColor} />

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



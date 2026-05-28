import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LogoIconFrame } from '@/components/IconFrame';
import {
  resolveUserPickedIconGlyphColor,
  userPickedIconGlyphSize,
  userPickedIconWellStyle,
} from '@/lib/userPickedIcon';
import { useAppTheme } from '@/lib/themeContext';

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  icon: IconName;
  color?: string | null;
  size?: number;
  iconSize?: number;
  logoUrl?: string | null;
  style?: StyleProp<ViewStyle>;
};

export function UserPickedIconBadge({
  icon,
  color,
  size = 46,
  iconSize,
  logoUrl,
  style,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const uri = logoUrl?.trim() || null;

  if (uri) {
    return <LogoIconFrame uri={uri} size={size} style={style} />;
  }

  const glyphColor = resolveUserPickedIconGlyphColor(color, isLight, colors);
  const computedIconSize = userPickedIconGlyphSize(size, iconSize);

  return (
    <View style={[userPickedIconWellStyle(size, isLight), style]}>
      <Ionicons name={icon} size={computedIconSize} color={glyphColor} />
    </View>
  );
}

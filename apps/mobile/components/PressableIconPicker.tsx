import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { IconPickerSheet } from '@/components/IconPickerSheet';
import { LogoIconFrame } from '@/components/IconFrame';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import { tapHaptic } from '@/lib/haptics';
import type { MdiIconName } from '@/lib/mdiIconCatalog';

type Props = {
  icon: string;
  size?: number;
  iconSize?: number;
  logoUrl?: string | null;
  wellGlyphWhite?: boolean;
  color?: string | null;
  onIconChange: (icon: MdiIconName) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  pickerTitle?: string;
};

/** Tap the icon well to open the searchable MDI icon picker. */
export function PressableIconPicker({
  icon,
  size = 52,
  iconSize,
  logoUrl,
  wellGlyphWhite = false,
  color,
  onIconChange,
  accessibilityLabel = "Modifier l'icône",
  style,
  children,
  pickerTitle,
}: Props) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const uri = logoUrl?.trim() || null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          tapHaptic();
          setPickerVisible(true);
        }}
        style={({ pressed }) => [styles.wrap, style, pressed && styles.pressed]}
      >
        {children ?? (
          uri ? (
            <LogoIconFrame uri={uri} size={size} />
          ) : (
            <UserPickedIconBadge
              icon={icon}
              color={color}
              size={size}
              iconSize={iconSize}
              wellGlyphWhite={wellGlyphWhite}
            />
          )
        )}
      </Pressable>

      <IconPickerSheet
        visible={pickerVisible}
        selectedIcon={icon}
        title={pickerTitle}
        onClose={() => setPickerVisible(false)}
        onSelect={onIconChange}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
  },
  pressed: { opacity: 0.78 },
});

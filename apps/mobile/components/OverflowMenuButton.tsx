import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MODIFIER_ICON_NAME } from '@/components/ModifierButton';
import {
  destructiveTextActionStyle,
  FLOATING_NAV_CONTENT_PADDING,
  jakartaBoldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export type OverflowMenuItem = {
  key: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  items: OverflowMenuItem[];
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Three-dot overflow trigger that opens a themed bottom action sheet. */
export function OverflowMenuButton({
  items,
  accessibilityLabel = 'Options',
  style,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  const close = () => setVisible(false);

  const open = () => {
    tapHaptic();
    setVisible(true);
  };

  const onItemPress = (item: OverflowMenuItem) => {
    close();
    item.onPress();
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={12}
        onPress={open}
        style={({ pressed }) => [pressed && styles.pressed, style]}
      >
        <View style={[styles.trigger, { backgroundColor: colors.surfaceElevated }]}>
          <AppIcon family="ionicons" name="ellipsis-horizontal" size={18} color={colors.text} />
        </View>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View
          style={[
            styles.backdrop,
            { paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Fermer le menu" />
          <View
            style={[
              styles.sheet,
              {
                // Opaque — containerBackground is glass and shows through nested modals.
                backgroundColor: colors.modalSurface,
                borderColor: colors.containerBorder,
              },
            ]}
          >
            {items.map((item, index) => {
              const iconName =
                item.icon ?? (item.key === 'edit' ? MODIFIER_ICON_NAME : undefined);
              const iconColor = item.destructive
                ? String(destructiveTextActionStyle(isLight).color)
                : colors.text;

              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => onItemPress(item)}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <View
                    style={[
                      styles.menuRow,
                      index < items.length - 1 && {
                        borderBottomColor: colors.border,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    {iconName ? (
                      <View
                        style={[
                          styles.menuIcon,
                          { backgroundColor: item.destructive ? colors.dangerMuted : colors.modalAction },
                        ]}
                      >
                        <AppIcon family="ionicons" name={iconName} size={17} color={iconColor} />
                      </View>
                    ) : null}
                    <Text
                      style={[
                        styles.menuLabel,
                        { color: colors.text },
                        item.destructive && destructiveTextActionStyle(isLight),
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Annuler"
              onPress={close}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <View style={[styles.cancelRow, { backgroundColor: colors.modalAction }]}>
                <Text style={[styles.cancelLabel, { color: colors.text }]}>Annuler</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
  },
  sheet: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  menuRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  menuLabel: {
    ...jakartaBoldText,
    fontSize: typography.body,
  },
  cancelRow: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    margin: spacing.sm,
    borderRadius: 24,
  },
  cancelLabel: {
    ...jakartaBoldText,
    fontSize: typography.body,
  },
  pressed: {
    opacity: 0.76,
  },
});

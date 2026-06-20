import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MODIFIER_ICON_NAME, MODIFIER_ICON_SIZE } from '@/components/ModifierButton';
import { destructiveTextActionStyle, interMediumText, radius, spacing, typography } from '@/constants/theme';
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
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed, style]}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Fermer le menu" />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.containerBackground,
                borderColor: colors.containerBorder,
              },
            ]}
          >
            {items.map((item, index) => {
              const iconName =
                item.icon ?? (item.key === 'edit' ? MODIFIER_ICON_NAME : undefined);
              const iconColor = item.destructive
                ? destructiveTextActionStyle(isLight).color
                : colors.text;

              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => onItemPress(item)}
                  style={({ pressed }) => [
                    styles.menuRow,
                    index < items.length - 1 && {
                      borderBottomColor: colors.border,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  {iconName ? (
                    <Ionicons
                      name={iconName}
                      size={item.key === 'edit' ? MODIFIER_ICON_SIZE : 18}
                      color={iconColor}
                    />
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
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Annuler"
              onPress={close}
              style={({ pressed }) => [
                styles.cancelRow,
                { backgroundColor: colors.surfaceElevated },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.cancelLabel, { color: colors.textMuted }]}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minWidth: 38,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  sheet: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  menuRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  menuLabel: {
    ...interMediumText,
    fontSize: typography.body,
    fontWeight: '700',
  },
  cancelRow: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    borderRadius: radius.lg,
  },
  cancelLabel: {
    ...interMediumText,
    fontSize: typography.body,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.76,
  },
});

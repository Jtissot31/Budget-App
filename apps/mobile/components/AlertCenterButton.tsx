import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { jakartaBoldText, radius, spacing, typography } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  unreadCount: number;
  onPress: () => void;
};

export function AlertCenterButton({ unreadCount, onPress }: Props) {
  const { colors } = useAppTheme();
  const hasUnread = unreadCount > 0;

  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={
        hasUnread
          ? `Centre d'alertes, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
          : "Centre d'alertes"
      }
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
        pressed && styles.pressed,
      ]}
    >
      <AppIcon family="ionicons" name="notifications-outline" size={21} color={colors.textSecondary} />
      {hasUnread ? (
        <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.containerBackground }]}>
          <Text style={[styles.badgeText, { color: colors.background }]}>
            {unreadCount > 9 ? '9+' : String(unreadCount)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...jakartaBoldText,
    fontSize: typography.micro - 1,
    lineHeight: typography.micro,
    textAlign: 'center',
  },
});

/**
 * Shared Budget Proto section chrome — eyebrow + trailing action.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { typographyKit } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function ProtoSectionHeader({ title, actionLabel, onAction }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: colors.textMuted }]} numberOfLines={1}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          onPress={() => {
            tapHaptic();
            onAction();
          }}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.actionText, { color: colors.textMuted }]}>{actionLabel}</Text>
          <AppIcon family="ionicons" name="chevron-forward" size={13} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    ...typographyKit.eyebrow,
    fontSize: 11,
    letterSpacing: 0.8,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  actionText: {
    ...typographyKit.metaSemibold,
    fontSize: 11,
  },
});

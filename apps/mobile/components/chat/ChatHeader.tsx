import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  interMediumText,
  interRegularText,
  PAGE_PADDING_HORIZONTAL,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type AgentStatus = 'online' | 'thinking';

type Props = {
  status: AgentStatus;
  topInset: number;
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  online: 'En ligne',
  thinking: 'Réflexion…',
};

export function ChatHeader({ status, topInset }: Props) {
  const router = useRouter();
  const { colors, isLight } = useAppTheme();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: topInset + SCREEN_TOP_GUTTER,
          borderBottomColor: colors.border,
          backgroundColor: 'transparent',
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer le chat"
        hitSlop={12}
        onPress={() => {
          tapHaptic();
          router.back();
        }}
        style={({ pressed }) => [
          styles.iconButton,
          {
            backgroundColor: isLight ? colors.surface : colors.surfaceElevated,
            borderColor: colors.border,
          },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="close" size={20} color={colors.text} />
      </Pressable>

      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.text }, interMediumText]}>Fyn</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.status, { color: colors.textMuted }, interRegularText]}>
            {STATUS_LABELS[status]}
          </Text>
        </View>
      </View>

      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
    zIndex: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    marginHorizontal: spacing.sm,
  },
  title: {
    fontSize: typography.body,
    letterSpacing: -0.2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  status: {
    fontSize: typography.meta,
  },
  headerSpacer: {
    width: 40,
  },
  pressed: {
    opacity: 0.78,
  },
});

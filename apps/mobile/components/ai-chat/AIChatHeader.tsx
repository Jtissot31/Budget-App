import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { interBoldText, interRegularText, PAGE_PADDING_HORIZONTAL, spacing } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAIChatColors } from './theme';

type AgentStatus = 'online' | 'thinking';

type Props = {
  status: AgentStatus;
  statusLabel?: string;
  topInset: number;
  onMenuPress?: () => void;
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  online: 'En ligne',
  thinking: 'Réflexion…',
};

export function AIChatHeader({ status, statusLabel, topInset, onMenuPress }: Props) {
  const router = useRouter();
  const palette = useAIChatColors();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: topInset + spacing.sm,
          borderBottomColor: palette.border,
          backgroundColor: palette.background,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retour"
        hitSlop={12}
        onPress={() => {
          tapHaptic();
          router.back();
        }}
        style={styles.headerButton}
      >
        <MaterialCommunityIcons name="chevron-left" size={28} color={palette.text} />
      </Pressable>

      <View style={styles.headerTitleContainer}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <MaterialCommunityIcons name="sparkles" size={16} color={palette.primary} />
          </View>
          <View style={[styles.statusIndicator, { backgroundColor: palette.primary, borderColor: palette.background }]} />
        </View>
        <View>
          <Text style={[styles.headerTitle, { color: palette.text }, interBoldText]}>Fyn</Text>
          <Text style={[styles.headerStatus, { color: palette.primary }, interRegularText]}>
            {statusLabel ?? STATUS_LABELS[status]}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Paramètres Fyn"
        hitSlop={12}
        onPress={() => {
          tapHaptic();
          onMenuPress?.();
        }}
        style={styles.headerButton}
      >
        <MaterialCommunityIcons name="dots-vertical" size={24} color={palette.text} />
      </Pressable>
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
    borderBottomWidth: 1,
    flexShrink: 0,
  },
  headerButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: spacing.sm,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  headerTitle: {
    fontSize: 16,
  },
  headerStatus: {
    fontSize: 12,
  },
});

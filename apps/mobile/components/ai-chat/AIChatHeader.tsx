import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  interExtraBoldText,
  interMediumText,
  spacing,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { useAIChatColors } from './theme';

type AgentStatus = 'online' | 'thinking';

type Props = {
  status: AgentStatus;
  statusLabel?: string;
  topInset: number;
  showBackButton?: boolean;
  onMenuPress?: () => void;
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  online: 'En ligne',
  thinking: 'Réflexion…',
};

export function AIChatHeader({
  status,
  statusLabel,
  topInset,
  showBackButton = true,
  onMenuPress,
}: Props) {
  const router = useRouter();
  const palette = useAIChatColors();
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: topInset + SCREEN_TOP_GUTTER + (showBackButton ? spacing.md : 0),
          backgroundColor: palette.background,
        },
      ]}
    >
      {showBackButton ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={12}
          onPress={() => {
            tapHaptic();
            router.back();
          }}
          style={({ pressed }) => [styles.backHit, pressed && styles.pressed]}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
      ) : null}

      <View style={[styles.headerTitleContainer, !showBackButton && styles.headerTitleContainerTab]}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <MaterialCommunityIcons name="sparkles" size={16} color={palette.primary} />
          </View>
          <View style={[styles.statusIndicator, { backgroundColor: palette.primary, borderColor: palette.background }]} />
        </View>
        <View style={styles.titleCopy}>
          <Text style={[styles.headerTitle, { color: palette.text }, interExtraBoldText]}>Fyn</Text>
          <Text style={[styles.headerStatus, { color: palette.primary }, interMediumText]}>
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
        style={({ pressed }) => [styles.menuHit, pressed && styles.pressed]}
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
    flexShrink: 0,
  },
  backHit: {
    padding: spacing.xs,
  },
  menuHit: {
    padding: spacing.xs,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  headerTitleContainerTab: {
    marginLeft: 0,
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
  titleCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 20,
    letterSpacing: -0.3,
  },
  headerStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.78,
  },
});

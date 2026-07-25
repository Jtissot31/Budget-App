import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { useRouter } from 'expo-router';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { spacing } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { useAIChatColors } from './theme';

type AgentStatus = 'online' | 'thinking';

type Props = {
  /** @deprecated Center status UI removed — kept for call-site compatibility. */
  status?: AgentStatus;
  /** @deprecated Center status UI removed — kept for call-site compatibility. */
  statusLabel?: string;
  topInset: number;
  showBackButton?: boolean;
  onMenuPress?: () => void;
};

export function AIChatHeader({
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
      <View style={styles.side}>
        {showBackButton ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={() => {
              tapHaptic();
              router.back();
            }}
            style={({ pressed }) => [styles.iconHit, pressed && styles.pressed]}
          >
            <AppIcon family="material" name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.side, styles.sideEnd]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Paramètres Fyn"
          hitSlop={12}
          onPress={() => {
            tapHaptic();
            onMenuPress?.();
          }}
          style={({ pressed }) => [styles.iconHit, pressed && styles.pressed]}
        >
          <AppIcon family="ionicons" name="settings-outline" size={22} color={palette.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexShrink: 0,
  },
  side: {
    minWidth: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideEnd: {
    alignItems: 'flex-end',
  },
  iconHit: {
    padding: spacing.xs,
  },
  pressed: {
    opacity: 0.78,
  },
});

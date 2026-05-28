import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREEN_TOP_GUTTER, ghostCardShadow } from '@/constants/ghostUi';
import { colors, radius, spacing, typography } from '@/constants/theme';

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
      <View style={styles.frame}>
        <Ionicons name="scan" size={64} color={colors.primary} />
        <Text style={styles.title}>Smart Scan</Text>
        <Text style={styles.sub}>
          Scanne un reçu pour créer une transaction automatiquement. Cette fonctionnalité sera
          reliée à l'IA plus tard.
        </Text>
      </View>
      <Pressable style={styles.btn} onPress={() => router.back()}>
        <Text style={styles.btnText}>Fermer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  frame: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
    ...ghostCardShadow,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: typography.body, textAlign: 'center', lineHeight: 22 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

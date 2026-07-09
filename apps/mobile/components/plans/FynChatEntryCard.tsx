import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { useRouter } from 'expo-router';
import { FynAvatar } from '@/components/ai-chat/FynAvatar';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { planFinanceKit } from '@/constants/planFinanceKit';
import { interMediumText, interSemiboldText, spacing, typography } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';

export function FynChatEntryCard() {
  const router = useRouter();
  const pf = planFinanceKit.colors;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ouvrir le conseiller Fyn"
      onPress={() => {
        tapHaptic();
        router.push('/fyn-chat');
      }}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <PlanFinanceContainer style={styles.card}>
        <FynAvatar size={48} showStatus statusBorderColor={pf.background} />
        <View style={styles.copy}>
          <Text style={[styles.title, interSemiboldText, { color: pf.text }]}>Parler à Fyn</Text>
          <Text style={[styles.subtitle, interMediumText, { color: pf.textMuted }]}>
            Conseiller IA — budget, dettes et objectifs
          </Text>
        </View>
        <AppIcon family="material-community" name="chevron-right" size={22} color={pf.textMuted} />
      </PlanFinanceContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: typography.body,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.86,
  },
});

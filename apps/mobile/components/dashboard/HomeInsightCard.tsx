import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { PLAN_FINANCE_CONTAINER, planFinanceContainerPressedStyle } from '@/constants/planFinanceKit';
import { interMediumText, interSemiboldText, spacing, typography } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  title: string;
  message: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

export function HomeInsightCard({ title, message, onPress, accessibilityLabel }: Props) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Ouvrir l'alerte ${title}`}
      style={({ pressed }) => [pressed && planFinanceContainerPressedStyle()]}
    >
      <PlanFinanceContainer style={styles.card}>
        <View style={styles.badgeRow}>
          <AppIcon family="material" name="auto-awesome" size={13} color={colors.accentGreen} />
          <Text style={[styles.badgeText, { color: colors.accentGreen }, interSemiboldText]}>INSIGHT</Text>
        </View>

        <View style={styles.bodyRow}>
          <AppIcon family="material-community" name="alert-circle-outline" size={18} color={colors.warning} />
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }, interSemiboldText]} numberOfLines={2}>
              {title}
            </Text>
            <Text style={[styles.message, { color: colors.text }, interMediumText]} numberOfLines={3}>
              {message}
            </Text>
          </View>
        </View>
      </PlanFinanceContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    padding: PLAN_FINANCE_CONTAINER.padding.card,
    gap: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgeText: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.caption,
  },
  message: {
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
});

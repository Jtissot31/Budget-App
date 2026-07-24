import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { DashboardCard } from '@/components/DashboardCard';
import { pressableMotionStyle } from '@/constants/motionKit';
import { spacing, typographyKit } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  title: string;
  message?: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

export function HomeInsightCard({ title, onPress, accessibilityLabel }: Props) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Ouvrir l'alerte ${title}`}
      style={({ pressed }) => [styles.pressable, pressableMotionStyle(pressed)]}
    >
      <DashboardCard>
        <View style={styles.badgeRow}>
          <AppIcon family="material-community" name="brain" size={16} color={colors.primary} />
          <Text style={[typographyKit.eyebrow, { color: colors.primary }]}>INSIGHT</Text>
        </View>

        <Text
          style={[typographyKit.bodyBold, styles.title, { color: colors.text }]}
          numberOfLines={3}
        >
          {title}
        </Text>
        <Text style={[typographyKit.meta, { color: colors.primary }, styles.detailsLink]}>
          Voir détails ›
        </Text>
      </DashboardCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    minHeight: 44,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    marginTop: spacing.sm,
    flexShrink: 1,
    minWidth: 0,
  },
  detailsLink: {
    marginTop: spacing.xs,
  },
});

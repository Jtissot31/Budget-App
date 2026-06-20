import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { interMediumText, interSemiboldText, radius, spacing, typography } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  title: string;
  message: string;
};

export function HomeInsightCard({ title, message }: Props) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.containerBackground,
          borderColor: 'rgba(74,222,128,0.15)',
        },
      ]}
    >
      <View style={styles.badgeRow}>
        <MaterialIcons name="auto-awesome" size={13} color={colors.accentGreen} />
        <Text style={[styles.badgeText, { color: colors.accentGreen }, interSemiboldText]}>INSIGHT</Text>
      </View>

      <View style={styles.bodyRow}>
        <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.warning} />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }, interSemiboldText]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.message, { color: colors.text }, interMediumText]} numberOfLines={3}>
            {message}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
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
    alignItems: 'flex-start',
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

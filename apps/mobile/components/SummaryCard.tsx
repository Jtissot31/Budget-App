import { StyleSheet, Text, View } from 'react-native';
import { colors as defaultColors, radius, spacing, typography } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  title: string;
  value: string;
  valueColor?: string;
  subtitle?: string;
};

export function SummaryCard({ title, value, valueColor, subtitle }: Props) {
  const { colors, ghostCardShadow } = useAppTheme();
  return (
    <View style={[styles.card, ghostCardShadow, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textMuted }]}>{title}</Text>
      <Text style={[styles.value, { color: valueColor ?? colors.text }]}>{value}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: defaultColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: defaultColors.border,
    padding: spacing.md,
  },
  title: {
    fontSize: typography.micro,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.dashboardGreeting,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.micro,
    marginTop: spacing.xs,
  },
});

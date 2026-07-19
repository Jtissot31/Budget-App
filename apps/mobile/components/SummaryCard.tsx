import { StyleSheet, Text } from 'react-native';
import { SurfaceCard } from '@/components/SurfaceCard';
import { jakartaBoldText, jakartaRegularText, radius, spacing, typography } from '@/constants/theme';
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
    <SurfaceCard style={[styles.card, ghostCardShadow]} padding={spacing.md} borderRadius={radius.lg}>
      <Text style={[styles.title, { color: colors.textMuted }]}>{title}</Text>
      <Text style={[styles.value, { color: valueColor ?? colors.text }]}>{value}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  title: {
    ...jakartaRegularText,
    fontSize: typography.micro,
    marginBottom: spacing.xs,
  },
  value: {
    ...jakartaBoldText,
    fontSize: typography.dashboardGreeting,
  },
  subtitle: {
    ...jakartaRegularText,
    fontSize: typography.micro,
    marginTop: spacing.xs,
  },
});

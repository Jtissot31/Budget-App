import { StyleSheet, Text, View } from 'react-native';
import { typography } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import { portfolioNumericText } from '@/lib/textLayout';

export function calendarBoxParts(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  const month = date
    .toLocaleDateString('fr-FR', { month: 'short' })
    .replace('.', '')
    .toUpperCase();
  return { month, day: date.getDate() };
}

type DashboardDateBadgeProps = {
  /** ISO date key `YYYY-MM-DD` */
  dateKey: string;
};

export function DashboardDateBadge({ dateKey }: DashboardDateBadgeProps) {
  const { colors } = useAppTheme();
  const { month, day } = calendarBoxParts(dateKey);

  return (
    <View style={[styles.box, { backgroundColor: colors.surfaceElevated }]}>
      <Text style={[styles.month, { color: colors.primary }]}>{month}</Text>
      <Text style={[styles.day, { color: colors.text }]}>{day}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  month: {
    ...portfolioNumericText,
    fontSize: typography.micro - 4,
    letterSpacing: 0.5,
  },
  day: {
    ...portfolioNumericText,
    fontSize: typography.dashboardGreeting,
    lineHeight: typography.dashboardGreeting,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import { dashboardPalette, typography } from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
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
  const { month, day } = calendarBoxParts(dateKey);

  return (
    <View style={styles.box}>
      <Text style={styles.month}>{month}</Text>
      <Text style={styles.day}>{day}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: dashboardPalette.iconBox,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  month: {
    ...portfolioNumericText,
    fontSize: typography.micro - 4,
    color: dashboardPalette.green,
    letterSpacing: 0.5,
  },
  day: {
    ...portfolioNumericText,
    fontSize: typography.dashboardGreeting,
    color: dashboardPalette.text,
    lineHeight: typography.dashboardGreeting,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { DashboardCard } from '@/components/DashboardCard';
import { AppIcon } from '@/components/icons/AppIcon';
import { spacing, typographyKit } from '@/constants/theme';
import type { AlertCardData } from '@/types/aiWidgets';
import { useAIWidgetColors } from './theme';

type Props = {
  data: AlertCardData;
};

type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type SeverityStyle = {
  eyebrow: string;
  icon: MaterialIconName;
  accent: string;
};

function resolveSeverityStyle(
  severity: AlertCardData['severity'],
  palette: ReturnType<typeof useAIWidgetColors>,
): SeverityStyle {
  switch (severity) {
    case 'danger':
      return {
        eyebrow: 'ALERTE',
        icon: 'alert-circle-outline',
        accent: palette.red,
      };
    case 'warning':
      return {
        eyebrow: 'ALERTE',
        icon: 'alert-outline',
        accent: palette.warning,
      };
    case 'success':
      return {
        eyebrow: 'CONFIRMATION',
        icon: 'check-circle-outline',
        accent: palette.green,
      };
    case 'info':
    default:
      return {
        eyebrow: 'INFO',
        icon: 'information-outline',
        accent: palette.info,
      };
  }
}

/**
 * Alert card — same DashboardCard shell / typography language as Agenda
 * {@link AgendaCashHeroCard} (solde chèque), without any chart.
 */
export function AlertCardWidget({ data }: Props) {
  const palette = useAIWidgetColors();
  const severity = resolveSeverityStyle(data.severity, palette);

  return (
    <DashboardCard padding={spacing.lg} innerStyle={styles.cardInner}>
      <View style={styles.eyebrowRow}>
        <AppIcon
          family="material-community"
          name={severity.icon}
          size={14}
          color={severity.accent}
        />
        <Text style={[typographyKit.eyebrow, { color: severity.accent }]} numberOfLines={1}>
          {severity.eyebrow}
        </Text>
      </View>

      <Text
        style={[typographyKit.sectionTitle, styles.title, { color: palette.text }]}
        numberOfLines={3}
        ellipsizeMode="tail"
      >
        {data.title}
      </Text>

      <Text
        style={[typographyKit.metaMedium, { color: palette.textMuted }]}
        numberOfLines={5}
        ellipsizeMode="tail"
      >
        {data.message}
      </Text>

      {data.action ? (
        <Text
          style={[typographyKit.meta, styles.action, { color: severity.accent }]}
          accessibilityRole="button"
          accessibilityLabel={data.action.label}
        >
          {data.action.label} ›
        </Text>
      ) : null}
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  cardInner: {
    gap: spacing.md,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    letterSpacing: -0.4,
  },
  action: {
    marginTop: spacing.xs,
  },
});

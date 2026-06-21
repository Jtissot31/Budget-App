import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { jakartaBoldText, jakartaRegularText, jakartaSemiboldText } from '@/constants/theme';
import { useAIChatColors } from './theme';
import type { EmergencyFundProjection } from './types';

type Props = {
  projection: EmergencyFundProjection;
};

export function AIChatProjectionWidget({ projection }: Props) {
  const palette = useAIChatColors();

  return (
    <View
      style={[
        styles.widgetContainer,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={styles.widgetHeader}>
        <Text style={[styles.widgetTitle, { color: palette.textMuted }, jakartaBoldText]}>
          {projection.title ?? "PROJECTION FONDS D'URGENCE"}
        </Text>
        <MaterialCommunityIcons name="chart-timeline-variant" size={20} color={palette.primary} />
      </View>
      <View style={styles.widgetBody}>
        <View style={styles.widgetMainRow}>
          <Text style={[styles.widgetValue, { color: palette.text }, jakartaBoldText]}>{projection.value}</Text>
          <Text style={[styles.widgetTargetLabel, { color: palette.primary }, jakartaSemiboldText]}>
            {projection.targetLabel}
          </Text>
        </View>
        <View style={[styles.progressBarBg, { backgroundColor: palette.border }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: palette.primary,
                width: `${Math.min(100, Math.max(0, projection.progressPercent))}%`,
              },
            ]}
          />
        </View>
        <View style={styles.widgetFooter}>
          <MaterialCommunityIcons name="check-circle-outline" size={16} color={palette.primary} />
          <Text style={[styles.widgetFooterText, { color: palette.textMuted }, jakartaRegularText]}>
            {projection.footerText}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  widgetContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    alignSelf: 'stretch',
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  widgetTitle: {
    fontSize: 12,
    letterSpacing: 1,
  },
  widgetBody: {},
  widgetMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  widgetValue: {
    fontSize: 24,
  },
  widgetTargetLabel: {
    fontSize: 13,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  widgetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  widgetFooterText: {
    fontSize: 13,
    marginLeft: 8,
  },
});

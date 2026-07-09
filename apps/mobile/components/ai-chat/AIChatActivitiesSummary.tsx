import { useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { jakartaMediumText, jakartaRegularText } from '@/constants/theme';
import { type ActivityPhase, getActivityPhaseLabel } from '@/lib/ai/activityPhases';
import { tapHaptic } from '@/lib/haptics';
import { useAIChatColors } from './theme';

type Props = {
  phases: ActivityPhase[];
  showSeparator?: boolean;
};

const VISIBLE_PHASES: ActivityPhase[] = [
  'analyse_finances',
  'reflexion',
  'analyse',
  'redaction',
];

export function AIChatActivitiesSummary({ phases, showSeparator = true }: Props) {
  const palette = useAIChatColors();
  const [expanded, setExpanded] = useState(false);
  const visiblePhases = phases.filter((phase) => VISIBLE_PHASES.includes(phase));

  if (visiblePhases.length === 0) return null;

  return (
    <View
      style={[
        styles.container,
        showSeparator && { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => {
          tapHaptic();
          setExpanded((prev) => !prev);
        }}
        style={styles.toggleRow}
      >
        <Text style={[styles.toggleLabel, { color: palette.textMuted }, jakartaMediumText]}>
          Étapes effectuées
        </Text>
        <AppIcon family="ionicons" 
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={palette.textMuted}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.phaseList}>
          {visiblePhases.map((phase) => (
            <View key={phase} style={styles.phaseRow}>
              <Text style={[styles.phaseLabel, { color: palette.textMuted }, jakartaRegularText]}>
                {getActivityPhaseLabel(phase, true)}
              </Text>
              <Text style={[styles.checkmark, { color: palette.textMuted }]}>✓</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  toggleLabel: {
    fontSize: 12,
  },
  phaseList: {
    marginTop: 8,
    gap: 5,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  phaseLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  checkmark: {
    fontSize: 11,
    opacity: 0.7,
  },
});

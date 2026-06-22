import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { spacing } from '@/constants/theme';
import type { PlanFinancier } from '@/lib/dashboardPlansMock';
import { tapHaptic } from '@/lib/haptics';
import { PLAN_DETAIL, planDetailCardStyle, planDetailFonts } from './planDetailTheme';

type DetailRow = {
  label: string;
  value: string;
};

type Props = {
  plan: PlanFinancier;
};

export function PlanDetailsCollapsible({ plan }: Props) {
  const [expanded, setExpanded] = useState(false);

  const rows: DetailRow[] = [
    { label: 'Démarré', value: plan.startedAtLabel },
    { label: 'Objectif cible', value: plan.targetDateLabel },
    { label: 'Cadence', value: plan.contributionLabel },
  ];

  if (plan.linkedAccountLabel) {
    rows.push({ label: 'Compte lié', value: plan.linkedAccountLabel });
  }

  return (
    <View style={planDetailCardStyle.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => {
          tapHaptic();
          setExpanded((prev) => !prev);
        }}
        style={styles.headerRow}
      >
        <Text style={[planDetailFonts.sectionCaps, { color: PLAN_DETAIL.textMuted }]}>DÉTAILS DU PLAN</Text>
        <MaterialIcons
          name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={22}
          color={PLAN_DETAIL.textMuted}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.rows}>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={[planDetailFonts.detailLabel, { color: PLAN_DETAIL.textMuted }]}>{row.label}</Text>
              <Text style={[planDetailFonts.detailValue, { color: PLAN_DETAIL.text, flex: 1, textAlign: 'right' }]}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rows: {
    marginTop: spacing.md,
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PLAN_DETAIL.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});

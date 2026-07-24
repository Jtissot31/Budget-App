import { useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/constants/theme';
import type { PlanFinancier } from '@/lib/dashboardPlansMock';
import { tapHaptic } from '@/lib/haptics';
import {
  planDetailCardStyleFromTheme,
  planDetailFonts,
  usePlanDetailTheme,
} from './planDetailTheme';

type DetailRow = {
  label: string;
  value: string;
};

type Props = {
  plan: PlanFinancier;
};

export function PlanDetailsCollapsible({ plan }: Props) {
  const [expanded, setExpanded] = useState(false);
  const theme = usePlanDetailTheme();

  const rows: DetailRow[] = [
    { label: 'Démarré', value: plan.startedAtLabel },
    { label: 'Objectif cible', value: plan.targetDateLabel },
    { label: 'Cadence', value: plan.contributionLabel },
  ];

  if (plan.linkedAccountLabel) {
    rows.push({ label: 'Compte lié', value: plan.linkedAccountLabel });
  }

  return (
    <View style={planDetailCardStyleFromTheme(theme)}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => {
          tapHaptic();
          setExpanded((prev) => !prev);
        }}
        style={styles.headerRow}
      >
        <Text style={[planDetailFonts.sectionCaps, { color: theme.textMuted }]}>DÉTAILS DU PLAN</Text>
        <AppIcon
          family="material"
          name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={22}
          color={theme.textMuted}
        />
      </Pressable>

      {expanded ? (
        <View style={[styles.rows, { borderTopColor: theme.border }]}>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={[planDetailFonts.detailLabel, { color: theme.textMuted }]}>{row.label}</Text>
              <Text
                style={[planDetailFonts.detailValue, { color: theme.text, flex: 1, textAlign: 'right' }]}
              >
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});

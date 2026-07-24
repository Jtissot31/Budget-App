import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { interMediumText, interSemiboldText, spacing } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import {
  PLAN_DETAIL_LAYOUT,
  planDetailFonts,
  usePlanDetailTheme,
} from '@/components/plans/planDetailTheme';

export type PlanOptionId = 'toggle_pause' | 'edit' | 'archive';

type Props = {
  visible: boolean;
  onClose: () => void;
  isPaused: boolean;
  onSelect: (id: PlanOptionId) => void;
};

type OptionDef = {
  id: PlanOptionId;
  label: string;
  description: string;
  icon: 'pause' | 'play-arrow' | 'edit' | 'inventory-2';
  destructive?: boolean;
};

export function PlanOptionsSheet({ visible, onClose, isPaused, onSelect }: Props) {
  const { colors } = useAppTheme();
  const theme = usePlanDetailTheme();

  const options: OptionDef[] = [
    {
      id: 'toggle_pause',
      label: isPaused ? 'Reprendre le plan' : 'Mettre en pause',
      description: isPaused
        ? 'Réactive le suivi et les prochaines étapes.'
        : 'Suspend les contributions et étapes sans supprimer le plan.',
      icon: isPaused ? 'play-arrow' : 'pause',
    },
    {
      id: 'edit',
      label: 'Modifier',
      description: 'Ajuste le montant, la cadence ou les détails.',
      icon: 'edit',
    },
    {
      id: 'archive',
      label: 'Archiver',
      description: 'Retire le plan de Tes plans. Action définitive.',
      icon: 'inventory-2',
      destructive: true,
    },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Options du plan" scrollable={false}>
      <View style={styles.list}>
        {options.map((option, index) => {
          const isLast = index === options.length - 1;
          const labelColor = option.destructive ? colors.danger : theme.text;
          const iconColor = option.destructive ? colors.danger : colors.textSecondary;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              onPress={() => {
                tapHaptic();
                onSelect(option.id);
              }}
              style={({ pressed }) => [
                styles.row,
                !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.iconWell,
                  {
                    backgroundColor: option.destructive ? colors.dangerMuted : colors.surfaceElevated,
                    borderColor: theme.border,
                  },
                ]}
              >
                <AppIcon family="material" name={option.icon} size={20} color={iconColor} />
              </View>
              <View style={styles.copy}>
                <Text style={[planDetailFonts.stepLabel, interSemiboldText, { color: labelColor }]}>
                  {option.label}
                </Text>
                <Text style={[styles.description, interMediumText, { color: theme.textMuted }]}>
                  {option.description}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: PLAN_DETAIL_LAYOUT.radiusSmall,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.78,
  },
});

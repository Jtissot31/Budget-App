import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { MdiIcon } from '@/components/MdiIcon';
import {
  CHIP_BORDER_WIDTH,
  CHIP_PADDING_HORIZONTAL,
  interBoldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { chipLabelTextProps, singleLineLabelStyle } from '@/lib/textLayout';
import { tapHaptic } from '@/lib/haptics';
import { WELL_GLYPH_WHITE, type MdiIconName } from '@/lib/mdiIconCatalog';
import { useAppTheme } from '@/lib/themeContext';

export type TransferMode = 'accounts' | 'person' | 'person_from';

type TransferModeOption = {
  mode: TransferMode;
  icon: MdiIconName;
  label: string;
  accessibilityLabel: string;
};

const TRANSFER_MODE_OPTIONS: TransferModeOption[] = [
  {
    mode: 'accounts',
    icon: 'SwapHoriz',
    label: 'Mes comptes',
    accessibilityLabel: 'Transfert entre mes comptes',
  },
  {
    mode: 'person',
    icon: 'Payments',
    label: 'Vers contact',
    accessibilityLabel: 'Transfert vers un contact',
  },
  {
    mode: 'person_from',
    icon: 'Person',
    label: 'Depuis contact',
    accessibilityLabel: 'Transfert depuis un contact',
  },
];

type Props = {
  value: TransferMode;
  onChange: (mode: TransferMode) => void;
};

export function TransferModePicker({ value, onChange }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.section}>
      <DashboardSectionLabel>Provenance</DashboardSectionLabel>
      <View style={styles.grid}>
        {TRANSFER_MODE_OPTIONS.map(({ mode, icon, label, accessibilityLabel }) => {
          const selected = value === mode;
          return (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              accessibilityState={{ selected }}
              onPress={() => {
                tapHaptic();
                onChange(mode);
              }}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected ? colors.successMuted : colors.surfaceElevated,
                  borderColor: selected ? colors.primary : colors.border,
                  borderWidth: CHIP_BORDER_WIDTH,
                },
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.iconWell,
                  {
                    backgroundColor: selected ? colors.primary : colors.input,
                  },
                ]}
              >
                <MdiIcon
                  name={icon}
                  size={20}
                  color={selected ? WELL_GLYPH_WHITE : colors.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  singleLineLabelStyle,
                  { color: selected ? colors.primary : colors.text },
                ]}
                numberOfLines={2}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 88,
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    paddingHorizontal: CHIP_PADDING_HORIZONTAL,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.72,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...interBoldText,
    fontSize: typography.micro,
    lineHeight: 14,
    textAlign: 'center',
  },
});

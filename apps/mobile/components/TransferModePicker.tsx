import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { MdiIcon } from '@/components/MdiIcon';
import {
  CHIP_BORDER_WIDTH,
  CHIP_PADDING_HORIZONTAL,
  jakartaBoldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { singleLineLabelStyle } from '@/lib/textLayout';
import { tapHaptic } from '@/lib/haptics';
import { WELL_GLYPH_WHITE, type MdiIconName } from '@/lib/mdiIconCatalog';
import { useAppTheme } from '@/lib/themeContext';

export type TransferMode = 'accounts' | 'person' | 'person_from';

type ContactDirection = 'to' | 'from';

type TransferModeOption = {
  mode: TransferMode;
  icon?: MdiIconName;
  contactDirection?: ContactDirection;
  label: string;
  accessibilityLabel: string;
};

const TRANSFER_MODE_OPTIONS: TransferModeOption[] = [
  {
    mode: 'accounts',
    icon: 'SwapHoriz',
    label: 'Mes comptes',
    accessibilityLabel: 'Virement entre mes comptes',
  },
  {
    mode: 'person',
    contactDirection: 'to',
    label: 'Vers contact',
    accessibilityLabel: 'Envoyer de l’argent à un contact',
  },
  {
    mode: 'person_from',
    contactDirection: 'from',
    label: 'Depuis contact',
    accessibilityLabel: 'Recevoir de l’argent d’un contact',
  },
];

type ContactDirectionIconProps = {
  direction: ContactDirection;
  color: string;
  accentColor: string;
};

function ContactDirectionIcon({ direction, color, accentColor }: ContactDirectionIconProps) {
  const isSendToContact = direction === 'to';

  return (
    <View style={styles.contactIconWrap}>
      {isSendToContact ? (
        <Ionicons name="arrow-forward" size={11} color={accentColor} style={styles.contactArrowSend} />
      ) : null}
      <Ionicons
        name="person-outline"
        size={15}
        color={color}
        style={isSendToContact ? styles.contactPersonSend : styles.contactPersonReceive}
      />
      {!isSendToContact ? (
        <Ionicons name="arrow-forward" size={11} color={accentColor} style={styles.contactArrowReceive} />
      ) : null}
    </View>
  );
}

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
        {TRANSFER_MODE_OPTIONS.map(({ mode, icon, contactDirection, label, accessibilityLabel }) => {
          const selected = value === mode;
          const glyphColor = selected ? WELL_GLYPH_WHITE : colors.textSecondary;
          const accentColor =
            contactDirection === 'to'
              ? selected
                ? '#FFD0D0'
                : colors.danger
              : contactDirection === 'from'
                ? selected
                  ? '#C8F5DC'
                  : colors.success
                : glyphColor;

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
                {contactDirection ? (
                  <ContactDirectionIcon
                    direction={contactDirection}
                    color={glyphColor}
                    accentColor={accentColor}
                  />
                ) : (
                  <MdiIcon name={icon!} size={20} color={glyphColor} />
                )}
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
  contactIconWrap: {
    width: 28,
    height: 20,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactPersonSend: {
    marginLeft: 2,
  },
  contactPersonReceive: {
    marginRight: 2,
  },
  contactArrowSend: {
    marginRight: 1,
  },
  contactArrowReceive: {
    marginLeft: 1,
  },
  label: {
    ...jakartaBoldText,
    fontSize: typography.micro,
    lineHeight: 14,
    textAlign: 'center',
  },
});

import { StyleSheet, Text, View } from 'react-native';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { jakartaMediumText, spacing } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export type TransferMode = 'accounts' | 'person' | 'person_from';

/** Sending to someone is the most common transfer, so it leads (and is the form default). */
const TRANSFER_MODE_TABS: { id: TransferMode; label: string; icon: 'arrow-up' | 'arrow-down' | 'swap-horizontal' }[] = [
  { id: 'person', label: 'Envoyer', icon: 'arrow-up' },
  { id: 'person_from', label: 'Recevoir', icon: 'arrow-down' },
  { id: 'accounts', label: 'Mes comptes', icon: 'swap-horizontal' },
];

const CAPTIONS: Record<TransferMode, string> = {
  person: 'Tu envoies de l’argent à quelqu’un',
  person_from: 'Quelqu’un t’envoie de l’argent',
  accounts: 'Entre deux de tes comptes ou objectifs',
};

type Props = {
  value: TransferMode;
  onChange: (mode: TransferMode) => void;
};

/** Transfer direction toggle — same sliding segmented control as the rest of the app. */
export function TransferModePicker({ value, onChange }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.section}>
      <SegmentedTabs
        tabs={TRANSFER_MODE_TABS}
        active={value}
        onChange={(mode) => {
          if (mode === value) return;
          tapHaptic();
          onChange(mode);
        }}
        size="section"
        variant="section"
        showDivider={false}
      />
      <Text style={[styles.caption, { color: colors.textMuted }]}>{CAPTIONS[value]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  caption: { ...jakartaMediumText, fontSize: 12.5, marginLeft: 2 },
});

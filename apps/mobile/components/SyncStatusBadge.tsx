import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { radius, spacing } from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
import { useAppTheme } from '@/lib/themeContext';
import type { SyncStatus } from '@/types';

type Props = {
  status: SyncStatus;
  style?: object;
};

function getSyncMeta(status: SyncStatus): {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  colorKey: 'textMuted' | 'warning' | 'danger';
} {
  if (status === 'synced') {
    return { icon: 'cloud-done-outline', label: 'Synchronisé', colorKey: 'textMuted' };
  }
  if (status === 'failed') {
    return { icon: 'cloud-offline-outline', label: 'Sync échouée', colorKey: 'danger' };
  }
  return { icon: 'cloud-upload-outline', label: 'En attente de sync', colorKey: 'warning' };
}

export function SyncStatusBadge({ status, style }: Props) {
  const { colors } = useAppTheme();
  const meta = getSyncMeta(status);

  if (status === 'synced') return null;

  if (status === 'failed') {
    return (
      <ThemedFormMessage
        variant="error"
        title="Échec de synchronisation"
        message="Vérifie ta connexion et réessaie plus tard."
        style={style}
      />
    );
  }

  const tint = meta.colorKey === 'warning' ? colors.warning : colors.textMuted;

  return (
    <View style={[styles.row, style]}>
      <Ionicons name={meta.icon} size={13} color={tint} />
      <Text style={[styles.label, { color: tint }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
  },
  label: {
    ...typographyKit.microMedium,
  },
});
